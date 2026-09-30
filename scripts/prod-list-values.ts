import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { key } from '../apps/server/src/lib/identityKey'
import { ROOT, connect, die, loadCatalog, mapEntriesToLists } from './lib/listsDb'

// Read-only inspector: how many values each list offers, against a floor.
// Phase 1 of the list-filling workflow — see docs/list-values-runbook.md.
//
//   pnpm prod:list-values [filters] [--values] [--json] [--snapshot]
//   pnpm prod:list-values --selftest
//
// Target: production by default. Credentials come from the Railway CLI
// (MySQL MYSQL_PUBLIC_URL), or --url <mysql://…> as an override; either way the
// host:port must equal RAILWAY_DATEMEME_DATABASE_PROXY in .env or nothing runs.
// --local reads the local DATABASE_URL instead (for development).
//
// Safety: one mysql2 connection, `SET SESSION TRANSACTION READ ONLY`, every
// query inside `START TRANSACTION READ ONLY`, and before any read a probe write
// that must be refused (error 1792). Never writes to the database. Writes files
// only with --snapshot (catalog/review, gitignored).
//
// "values" = a list's CategoryEntity rows that are not excluded and whose
// entity is APPROVED and not merged. Pending submissions are counted apart.

const FLOOR_FILE = resolve(ROOT, 'catalog/value-floor.json')
const MAX_VALUE_LISTS = 10 // --values is the expensive output; make the caller narrow first

const USAGE = `usage: pnpm prod:list-values [options]
  --list <title|slug>    match lists by slug or title substring (repeatable)
  --group <slug>         CategoryGroup slug, exact (alias --group-slug; repeatable)
  --type <slug>          EntityType slug, exact (repeatable)
  --min N / --max N      value-count range
  --below-floor          only lists with values < floor (their depth target)
  --status <s>           shallow | depth-gap | complete | bounded (repeatable; see Row.status)
  --shallow              same as --status shallow
  --floor N              override every list's floor for this run
  --sort values|gap|takes|title   (default values)
  --limit N              print at most N rows (summary still counts all)
  --include-inactive     also match inactive lists
  --values               print value names (at most ${MAX_VALUE_LISTS} matched lists)
  --json                 print rows as JSON instead of the table
  --snapshot             write catalog/review/list-values.<target>.json + history
  --selftest             only verify target + read-only session, then exit
  --url <mysql://…>      explicit production URL (must match the proxy)
  --local                use the local DATABASE_URL from .env`

type Opts = {
  lists: string[]; groups: string[]; types: string[]
  min?: number; max?: number; floor?: number; limit?: number
  belowFloor: boolean; statuses: Status[]; includeInactive: boolean; values: boolean; json: boolean; snapshot: boolean; selftest: boolean; local: boolean
  sort: 'values' | 'gap' | 'takes' | 'title'; url?: string
}

function parseArgs(argv: string[]): Opts {
  const o: Opts = { lists: [], groups: [], types: [], belowFloor: false, statuses: [], includeInactive: false, values: false, json: false, snapshot: false, selftest: false, local: false, sort: 'values' }
  const args = argv.filter((a) => a !== '--')
  const int = (flag: string, v: string | undefined) => {
    if (v === undefined || !/^\d+$/.test(v)) die(`${flag} needs a whole number\n${USAGE}`)
    return Number(v)
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    const next = () => { const v = args[++i]; if (v === undefined || v.startsWith('--')) die(`${a} needs a value\n${USAGE}`); return v }
    switch (a) {
      case '--list': o.lists.push(next()); break
      case '--group': case '--group-slug': o.groups.push(next()); break
      case '--type': o.types.push(next()); break
      case '--min': o.min = int(a, args[++i]); break
      case '--max': o.max = int(a, args[++i]); break
      case '--floor': o.floor = int(a, args[++i]); break
      case '--limit': o.limit = int(a, args[++i]); break
      case '--sort': {
        const s = next()
        if (!['values', 'gap', 'takes', 'title'].includes(s)) die(`--sort must be values, gap, takes or title`)
        o.sort = s as Opts['sort']; break
      }
      case '--url': o.url = next(); break
      case '--below-floor': o.belowFloor = true; break
      case '--shallow': o.statuses.push('shallow'); break
      case '--status': {
        const v = next()
        if (!STATUSES.includes(v as Status)) die(`--status must be one of ${STATUSES.join(', ')}`)
        o.statuses.push(v as Status); break
      }
      case '--include-inactive': o.includeInactive = true; break
      case '--values': o.values = true; break
      case '--json': o.json = true; break
      case '--snapshot': o.snapshot = true; break
      case '--selftest': o.selftest = true; break
      case '--local': o.local = true; break
      case '--help': case '-h': console.log(USAGE); process.exit(0)
      default: die(`unknown option ${a}\n${USAGE}`)
    }
  }
  if (o.local && o.url) die('--local and --url are mutually exclusive')
  return o
}

type Row = {
  id: string; slug: string; title: string; groupSlug: string; groupLabel: string; typeSlug: string
  isActive: boolean; maxItems: number; takes: number; values: number; pending: number; excluded: number; inactive: number
  adminEditedAt: string | null; floor: number; gap: number; file: string | null
  /** Pinned catalog entry synced before the latest Admin edit: its additions are skipped until re-synced. */
  stale: boolean
  /**
   * shallow: below the minimum (the builder shows 20 before search) — a product-quality problem.
   * depth-gap: at the minimum, below its depth target — incomplete, not broken.
   * complete: at or past its target.
   * bounded: a per-list floor below its normal target (a domain with few honest answers), and met.
   * A bounded list's own floor is also its minimum, so it is never shallow for being small.
   */
  status: Status
}

const STATUSES = ['shallow', 'depth-gap', 'complete', 'bounded'] as const
type Status = (typeof STATUSES)[number]

const LIST_SQL = `
  SELECT c.id, c.slug, c.shortLabel AS title, c.isActive, c.maxItems, c.popularityCount AS takes,
         g.slug AS groupSlug, g.label AS groupLabel, t.slug AS typeSlug,
         JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.adminEditedAt')) AS adminEditedAt,
         COALESCE(SUM(ce.isExcluded = 0 AND e.status = 'APPROVED' AND e.mergedIntoId IS NULL), 0) AS valueCount,
         COALESCE(SUM(ce.isExcluded = 0 AND e.status = 'PENDING' AND e.mergedIntoId IS NULL), 0) AS pendingCount,
         COALESCE(SUM(ce.isExcluded = 1), 0) AS excludedCount,
         COALESCE(SUM(ce.isExcluded = 0 AND (e.status NOT IN ('APPROVED', 'PENDING') OR e.mergedIntoId IS NOT NULL)), 0) AS inactiveCount
  FROM Category c
  JOIN CategoryGroup g ON g.id = c.groupId
  JOIN EntityType t ON t.id = c.entityTypeId
  LEFT JOIN CategoryEntity ce ON ce.categoryId = c.id
  LEFT JOIN Entity e ON e.id = ce.entityId
  GROUP BY c.id, c.slug, c.shortLabel, c.isActive, c.maxItems, c.popularityCount, g.slug, g.label, t.slug, c.metadata`

type FloorConfig = { minimum: number; default: number; groups: Record<string, number>; lists: Record<string, number> }

function readFloors(): FloorConfig {
  const raw = JSON.parse(readFileSync(FLOOR_FILE, 'utf8'))
  const cfg: FloorConfig = { minimum: raw.minimum ?? 0, default: raw.default, groups: raw.groups ?? {}, lists: raw.lists ?? {} }
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0
  if (!ok(cfg.minimum)) die(`${FLOOR_FILE}: "minimum" must be a whole number`)
  if (!ok(cfg.default)) die(`${FLOOR_FILE}: "default" must be a whole number`)
  for (const [k, v] of [...Object.entries(cfg.groups), ...Object.entries(cfg.lists)]) if (!ok(v)) die(`${FLOOR_FILE}: "${k}" must be a whole number`)
  return cfg
}

function statusOf(values: number, floor: number, bounded: boolean, minimum: number): Status {
  if (bounded) return values >= floor ? 'bounded' : values < Math.min(minimum, floor) ? 'shallow' : 'depth-gap'
  return values < minimum ? 'shallow' : values < floor ? 'depth-gap' : 'complete'
}

function stats(rows: Row[]) {
  const counts = rows.map((r) => r.values).sort((a, b) => a - b)
  const total = counts.reduce((s, n) => s + n, 0)
  const mid = counts.length >> 1
  return {
    lists: rows.length,
    values: total,
    avg: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0,
    median: !counts.length ? 0 : counts.length % 2 ? counts[mid]! : (counts[mid - 1]! + counts[mid]!) / 2,
    min: counts[0] ?? 0,
    max: counts[counts.length - 1] ?? 0,
    ...Object.fromEntries(STATUSES.map((st) => [st, rows.filter((r) => r.status === st).length])) as Record<Status, number>,
    belowFloor: rows.filter((r) => r.gap > 0).length,
    gapTotal: rows.reduce((s, r) => s + r.gap, 0),
  }
}

function table(rows: Row[]) {
  const head = ['values', 'floor', 'gap', 'status', 'takes', 'group', 'title', 'notes']
  const body = rows.map((r) => {
    const notes = [
      r.pending && `pending:${r.pending}`,
      r.excluded && `excluded:${r.excluded}`,
      r.adminEditedAt && 'admin-edited',
      !r.file && 'no-file',
      r.stale && 'stale',
      !r.isActive && 'inactive',
    ].filter(Boolean).join(',')
    return [String(r.values), String(r.floor), String(r.gap), r.status, String(r.takes), r.groupSlug, r.title, notes]
  })
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]!.length)))
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ').trimEnd()
  return [line(head), ...body.map(line)].join('\n')
}

async function main() {
  const o = parseArgs(process.argv.slice(2))
  const { target, conn } = await connect(o)
  if (o.selftest) {
    await conn.end()
    console.log(`LIST_VALUES_SELFTEST ${JSON.stringify({ target: target.name, readonly: true })}`)
    return
  }

  const floors = readFloors()
  let rows: Row[] = []
  let active: Row[] = []
  let matched: Row[] = []
  const valueNames = new Map<string, { approved: string[]; pending: string[] }>()
  try {
    await conn.query('START TRANSACTION READ ONLY')
    const [raw] = await conn.query(LIST_SQL) as [any[], unknown]
    rows = raw.map((r) => {
      const values = Number(r.valueCount)
      const floor = o.floor ?? floors.lists[r.slug] ?? floors.groups[r.groupSlug] ?? floors.default
      return {
        id: r.id, slug: r.slug, title: r.title, groupSlug: r.groupSlug, groupLabel: r.groupLabel, typeSlug: r.typeSlug,
        isActive: Boolean(r.isActive), maxItems: Number(r.maxItems), takes: Number(r.takes),
        values, pending: Number(r.pendingCount), excluded: Number(r.excludedCount), inactive: Number(r.inactiveCount),
        adminEditedAt: r.adminEditedAt && r.adminEditedAt !== 'null' ? r.adminEditedAt : null,
        floor, gap: Math.max(0, floor - values), file: null, stale: false,
        status: statusOf(values, floor, floors.lists[r.slug] !== undefined && floors.lists[r.slug]! < (floors.groups[r.groupSlug] ?? floors.default), floors.minimum),
      }
    })
    const entries = mapEntriesToLists(loadCatalog(), rows)
    for (const r of rows) {
      const ref = entries.get(r.slug)
      r.file = ref?.file.name ?? null
      r.stale = !!ref?.entry.categorySlug && (ref.entry.adminEditedAt ?? null) !== r.adminEditedAt
    }

    // Unknown slugs in the filters or the floor file are mistakes, not empty results.
    const groupSlugs = new Set(rows.map((r) => r.groupSlug))
    const typeSlugs = new Set(rows.map((r) => r.typeSlug))
    const listSlugs = new Set(rows.map((r) => r.slug))
    for (const g of o.groups) if (!groupSlugs.has(g)) die(`unknown group slug "${g}"; groups: ${[...groupSlugs].sort().join(', ')}`)
    for (const t of o.types) if (!typeSlugs.has(t)) die(`unknown type slug "${t}"`)
    for (const g of Object.keys(floors.groups)) if (!groupSlugs.has(g)) console.error(`⚠ value-floor.json: unknown group "${g}"`)
    for (const l of Object.keys(floors.lists)) if (!listSlugs.has(l)) console.error(`⚠ value-floor.json: unknown list "${l}"`)

    active = rows.filter((r) => r.isActive)
    matched = rows.filter((r) =>
      (o.includeInactive || r.isActive)
      && (!o.lists.length || o.lists.some((q) => r.slug === q || r.title.toLowerCase().includes(q.toLowerCase()) || r.slug.includes(key(q))))
      && (!o.groups.length || o.groups.includes(r.groupSlug))
      && (!o.types.length || o.types.includes(r.typeSlug))
      && (o.min === undefined || r.values >= o.min)
      && (o.max === undefined || r.values <= o.max)
      && (!o.belowFloor || r.gap > 0)
      && (!o.statuses.length || o.statuses.includes(r.status)))
    const cmp: Record<Opts['sort'], (a: Row, b: Row) => number> = {
      values: (a, b) => a.values - b.values || a.title.localeCompare(b.title),
      gap: (a, b) => b.gap - a.gap || a.title.localeCompare(b.title),
      takes: (a, b) => b.takes - a.takes || a.title.localeCompare(b.title),
      title: (a, b) => a.title.localeCompare(b.title),
    }
    matched.sort(cmp[o.sort])
    for (const q of o.lists) if (!rows.some((r) => r.slug === q || r.title.toLowerCase().includes(q.toLowerCase()) || r.slug.includes(key(q)))) console.error(`⚠ no list matches "${q}"`)

    if (o.values) {
      const shown = matched.slice(0, o.limit ?? matched.length)
      if (shown.length > MAX_VALUE_LISTS) die(`--values would print ${shown.length} lists; narrow with --list/--group or --limit ${MAX_VALUE_LISTS}`)
      const ids = shown.map((r) => r.id)
      if (ids.length) {
        const [names] = await conn.query(
          `SELECT ce.categoryId, e.canonicalName AS name, e.status
             FROM CategoryEntity ce JOIN Entity e ON e.id = ce.entityId
            WHERE ce.categoryId IN (?) AND ce.isExcluded = 0 AND e.mergedIntoId IS NULL AND e.status IN ('APPROVED', 'PENDING')
            ORDER BY ce.categoryId, ce.sortOrder, e.canonicalName`, [ids]) as [any[], unknown]
        for (const n of names) {
          const entry = valueNames.get(n.categoryId) ?? { approved: [], pending: [] }
          ;(n.status === 'APPROVED' ? entry.approved : entry.pending).push(n.name)
          valueNames.set(n.categoryId, entry)
        }
      }
    }
    await conn.query('COMMIT')
  } finally {
    await conn.end()
  }

  const s = stats(active)
  const shown = matched.slice(0, o.limit ?? matched.length)
  const strip = ({ id: _id, ...r }: Row) => r
  const n = (x: number) => x.toLocaleString('en-US')
  console.log(`LISTS ${s.lists}  VALUES ${n(s.values)}  AVG ${s.avg.toFixed(2)}  MEDIAN ${s.median}  MIN ${s.min}  MAX ${s.max}  SHALLOW ${s.shallow}  DEPTH_GAP ${s['depth-gap']}  COMPLETE ${s.complete}  BOUNDED ${s.bounded}  GAP ${n(s.gapTotal)}  (active lists; minimum ${floors.minimum}, floor default ${o.floor ?? floors.default})`)

  if (o.json) {
    console.log(JSON.stringify(shown.map((r) => {
      const names = valueNames.get(r.id)
      return names ? { ...strip(r), valueNames: names.approved, pendingNames: names.pending } : strip(r)
    })))
  } else if (shown.length) {
    console.log(table(shown))
    for (const r of shown) {
      const names = valueNames.get(r.id)
      if (!names) continue
      console.log(`\n${r.title} [${r.slug}] (${names.approved.length}): ${names.approved.join(' | ')}`)
      if (names.pending.length) console.log(`  pending (${names.pending.length}): ${names.pending.join(' | ')}`)
    }
  }
  if (shown.length < matched.length) console.log(`… ${matched.length - shown.length} more (raise --limit)`)

  const marker = { target: target.name, lists: s.lists, values: s.values, avg: s.avg, median: s.median, min: s.min, max: s.max, shallow: s.shallow, depthGap: s['depth-gap'], complete: s.complete, bounded: s.bounded, minimum: floors.minimum, belowFloor: s.belowFloor, gap: s.gapTotal, floor: o.floor ?? floors.default, matched: matched.length, shown: shown.length }

  if (o.snapshot) {
    const dir = resolve(ROOT, 'catalog/review')
    mkdirSync(dir, { recursive: true })
    const at = new Date().toISOString()
    writeFileSync(resolve(dir, `list-values.${target.name}.json`), JSON.stringify({ at, summary: s, floors, lists: active.map(strip) }, null, 2) + '\n')
    appendFileSync(resolve(dir, `list-values.${target.name}.history.jsonl`), JSON.stringify({ at, ...s, minimum: floors.minimum, floor: floors.default }) + '\n')
    console.error(`snapshot: catalog/review/list-values.${target.name}.json (+ .history.jsonl)`)
  }
  console.log(`LIST_VALUES ${JSON.stringify(marker)}`)
}

main().catch((error) => die(String(error?.message ?? error)))
