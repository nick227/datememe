import { execFileSync } from 'child_process'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import mysql from 'mysql2/promise'
import { key, legacyAsciiKey } from '../apps/server/src/lib/identityKey'

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

const ROOT = resolve(__dirname, '..')
const FLOOR_FILE = resolve(ROOT, 'catalog/value-floor.json')
const LISTS_DIR = resolve(ROOT, 'catalog/lists')
const MAX_VALUE_LISTS = 10 // --values is the expensive output; make the caller narrow first

const USAGE = `usage: pnpm prod:list-values [options]
  --list <title|slug>    match lists by slug or title substring (repeatable)
  --group <slug>         CategoryGroup slug, exact (alias --group-slug; repeatable)
  --type <slug>          EntityType slug, exact (repeatable)
  --min N / --max N      value-count range
  --below-floor          only lists with values < floor
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
  belowFloor: boolean; includeInactive: boolean; values: boolean; json: boolean; snapshot: boolean; selftest: boolean; local: boolean
  sort: 'values' | 'gap' | 'takes' | 'title'; url?: string
}

function die(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function parseArgs(argv: string[]): Opts {
  const o: Opts = { lists: [], groups: [], types: [], belowFloor: false, includeInactive: false, values: false, json: false, snapshot: false, selftest: false, local: false, sort: 'values' }
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

/** Minimal .env reader: this script only needs two keys and must not depend on dotenv. */
function readEnvFile(): Record<string, string> {
  const file = resolve(ROOT, '.env')
  if (!existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

function hostPort(url: string) {
  const u = new URL(url)
  return `${u.hostname}:${u.port || '3306'}`
}

/** Resolves the database URL and proves it is the intended target. Never prints credentials. */
function resolveTarget(o: Opts) {
  const env = { ...readEnvFile(), ...process.env } as Record<string, string | undefined>
  if (o.local) {
    const url = env.DATABASE_URL
    if (!url) die('--local: no DATABASE_URL in .env')
    if (hostPort(url) === env.RAILWAY_DATEMEME_DATABASE_PROXY) die('--local: DATABASE_URL points at the production proxy; drop --local')
    return { name: 'local', url, where: `db=${hostPort(url)}` }
  }
  const proxy = env.RAILWAY_DATEMEME_DATABASE_PROXY
  if (!proxy) die('RAILWAY_DATEMEME_DATABASE_PROXY is not set in .env; cannot verify the target')
  let url = o.url
  if (!url) {
    try {
      url = execFileSync('railway', ['variables', '--service', 'MySQL', '--environment', 'production', '--kv'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        .split('\n').find((l) => l.startsWith('MYSQL_PUBLIC_URL='))?.slice('MYSQL_PUBLIC_URL='.length).trim()
    } catch (error: any) {
      die(`railway CLI failed (${String(error.stderr ?? error.message).trim().split('\n').pop()}); run \`railway login\` / \`railway link\`, or pass --url`)
    }
    if (!url) die('MySQL in production has no MYSQL_PUBLIC_URL (enable public networking) — or pass --url')
  }
  let actual: string
  try { actual = hostPort(url) } catch { die('the database URL is not a valid mysql:// URL') }
  if (actual !== proxy) die(`target mismatch: URL points at ${actual}, RAILWAY_DATEMEME_DATABASE_PROXY is ${proxy}. Refusing to run.`)
  return { name: 'production', url, where: `proxy=${proxy}` }
}

/** Opens one connection, locks it read-only, and proves a write is refused. */
async function openReadOnly(url: string) {
  const conn = await mysql.createConnection({ uri: url, connectTimeout: 15000, dateStrings: true, supportBigNumbers: true, bigNumberStrings: false })
  await conn.query('SET SESSION TRANSACTION READ ONLY')
  // A write that matches no rows, so it is harmless even if the lock failed.
  // Under a read-only session MySQL/MariaDB refuse it before looking at rows.
  try {
    await conn.query(`UPDATE Category SET slug = slug WHERE id = '__list_values_readonly_probe__'`)
  } catch (error: any) {
    if (error.errno === 1792) return conn // ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION
    await conn.end()
    throw new Error(`read-only probe failed unexpectedly: ${error.code ?? error.message}`)
  }
  await conn.end()
  throw new Error('read-only probe was NOT refused — this session can write. Aborting before any read.')
}

type Row = {
  id: string; slug: string; title: string; groupSlug: string; groupLabel: string; typeSlug: string
  isActive: boolean; maxItems: number; takes: number; values: number; pending: number; excluded: number; inactive: number
  adminEditedAt: string | null; floor: number; gap: number; file: string | null
}

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

type FloorConfig = { default: number; groups: Record<string, number>; lists: Record<string, number> }

function readFloors(): FloorConfig {
  const raw = JSON.parse(readFileSync(FLOOR_FILE, 'utf8'))
  const cfg: FloorConfig = { default: raw.default, groups: raw.groups ?? {}, lists: raw.lists ?? {} }
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0
  if (!ok(cfg.default)) die(`${FLOOR_FILE}: "default" must be a whole number`)
  for (const [k, v] of [...Object.entries(cfg.groups), ...Object.entries(cfg.lists)]) if (!ok(v)) die(`${FLOOR_FILE}: "${k}" must be a whole number`)
  return cfg
}

/** slug → catalog file for every list a file defines (by key, legacy key or exact title, as the importer matches). */
function catalogFiles() {
  const bySlug = new Map<string, string>()
  const byTitle = new Map<string, string>()
  for (const f of readdirSync(LISTS_DIR).filter((n) => n.endsWith('.json')).sort()) {
    const parsed = JSON.parse(readFileSync(resolve(LISTS_DIR, f), 'utf8'))
    for (const l of Array.isArray(parsed) ? parsed : [parsed]) {
      if (typeof l?.title !== 'string') continue
      bySlug.set(key(l.title), f)
      bySlug.set(legacyAsciiKey(l.title), f)
      byTitle.set(l.title, f)
    }
  }
  return (slug: string, title: string) => bySlug.get(slug) ?? byTitle.get(title) ?? null
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
    belowFloor: rows.filter((r) => r.gap > 0).length,
    gapTotal: rows.reduce((s, r) => s + r.gap, 0),
  }
}

function table(rows: Row[]) {
  const head = ['values', 'floor', 'gap', 'takes', 'group', 'title', 'notes']
  const body = rows.map((r) => {
    const notes = [
      r.pending && `pending:${r.pending}`,
      r.excluded && `excluded:${r.excluded}`,
      r.adminEditedAt && 'admin-edited',
      !r.file && 'no-file',
      !r.isActive && 'inactive',
    ].filter(Boolean).join(',')
    return [String(r.values), String(r.floor), String(r.gap), String(r.takes), r.groupSlug, r.title, notes]
  })
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]!.length)))
  const line = (cells: string[]) => cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]!))).join('  ').trimEnd()
  return [line(head), ...body.map(line)].join('\n')
}

async function main() {
  const o = parseArgs(process.argv.slice(2))
  const target = resolveTarget(o)

  let conn: Awaited<ReturnType<typeof openReadOnly>>
  try {
    conn = await openReadOnly(target.url)
  } catch (error: any) {
    die(String(error.message).replace(/mysql:\/\/[^@\s]*@/g, 'mysql://***@'))
  }
  console.log(`target=${target.name} ${target.where} readonly=verified`)
  if (o.selftest) {
    await conn.end()
    console.log(`LIST_VALUES_SELFTEST ${JSON.stringify({ target: target.name, readonly: true })}`)
    return
  }

  const floors = readFloors()
  const fileFor = catalogFiles()
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
        floor, gap: Math.max(0, floor - values), file: fileFor(r.slug, r.title),
      }
    })

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
      && (!o.belowFloor || r.gap > 0))
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
  console.log(`LISTS ${s.lists}  VALUES ${n(s.values)}  AVG ${s.avg.toFixed(2)}  MEDIAN ${s.median}  MIN ${s.min}  MAX ${s.max}  BELOW_FLOOR ${s.belowFloor}  GAP ${n(s.gapTotal)}  (active lists; floor default ${o.floor ?? floors.default})`)

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

  const marker = { target: target.name, lists: s.lists, values: s.values, avg: s.avg, median: s.median, min: s.min, max: s.max, belowFloor: s.belowFloor, gap: s.gapTotal, floor: o.floor ?? floors.default, matched: matched.length, shown: shown.length }

  if (o.snapshot) {
    const dir = resolve(ROOT, 'catalog/review')
    mkdirSync(dir, { recursive: true })
    const at = new Date().toISOString()
    writeFileSync(resolve(dir, `list-values.${target.name}.json`), JSON.stringify({ at, summary: s, floors, lists: active.map(strip) }, null, 2) + '\n')
    appendFileSync(resolve(dir, `list-values.${target.name}.history.jsonl`), JSON.stringify({ at, ...s, floor: floors.default }) + '\n')
    console.error(`snapshot: catalog/review/list-values.${target.name}.json (+ .history.jsonl)`)
  }
  console.log(`LIST_VALUES ${JSON.stringify(marker)}`)
}

main().catch((error) => die(String(error?.message ?? error).replace(/mysql:\/\/[^@\s]*@/g, 'mysql://***@')))
