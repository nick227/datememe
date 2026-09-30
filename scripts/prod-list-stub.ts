import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { key, legacyAsciiKey } from '../apps/server/src/lib/identityKey'
import { LISTS_DIR, connect, die, formatJson, loadCatalog, mapEntriesToLists, serializeCatalogFile, type CatalogFile, type Entry } from './lib/listsDb'

// Syncs lists' catalog entries from the database, so filling a list is only
// appending names to its one entry (docs/list-values-runbook.md, Phase 2).
//
//   pnpm prod:list-stub --list <slug> [--list <slug>…] [--dry-run]
//   pnpm prod:list-stub --no-file [--dry-run]       adopt every active list no file defines
//
// Reads the database read-only (same target check as prod:list-values) and
// writes only catalog/lists files. For each list:
//   - pins the entry: categorySlug (the list, whatever its title) and
//     adminEditedAt (the Admin edit it was synced from; the importer adds values
//     to an Admin-edited list only while this still matches)
//   - values = the list's current values in its order (keeping the file's
//     spelling where it names the same value), then the entry's not-yet-published
//     additions — unless the list was edited in Admin since the entry was last
//     synced, in which case those names may be Admin removals and are dropped
//   - a list no file defines is added to catalog/lists/adopted-lists.json
// Publishing an entry straight after a sync adds nothing: validate shows it unchanged.

const ADOPT_FILE = 'adopted-lists.json'
const MIN_VALUES = 8 // ListSeedInputV1

type Opts = { lists: string[]; noFile: boolean; dryRun: boolean; local: boolean; url?: string }

function parseArgs(argv: string[]): Opts {
  const o: Opts = { lists: [], noFile: false, dryRun: false, local: false }
  const args = argv.filter((a) => a !== '--')
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    const next = () => { const v = args[++i]; if (v === undefined || v.startsWith('--')) die(`${a} needs a value`); return v }
    switch (a) {
      case '--list': o.lists.push(next()); break
      case '--no-file': o.noFile = true; break
      case '--dry-run': o.dryRun = true; break
      case '--local': o.local = true; break
      case '--url': o.url = next(); break
      default: die(`unknown option ${a}\nusage: pnpm prod:list-stub (--list <category slug>… | --no-file) [--dry-run] [--local | --url <mysql://…>]`)
    }
  }
  if (!o.lists.length && !o.noFile) die('name lists with --list <category slug> (exact slugs from prod:list-values --json), or --no-file')
  if (o.local && o.url) die('--local and --url are mutually exclusive')
  return o
}

type ListRow = { id: string; slug: string; title: string; isActive: number; prompt: string; axes: unknown; metadata: unknown; groupSlug: string; typeSlug: string; entityTypeId: string }

const nameOf = (v: unknown) => (typeof v === 'string' ? v : (v as { name?: string })?.name ?? '').trim()

async function main() {
  const o = parseArgs(process.argv.slice(2))
  const { target, conn } = await connect(o)
  const files = loadCatalog()
  const touched = new Set<CatalogFile>()
  const results: string[] = []
  const counts = { synced: 0, adopted: 0, unchanged: 0, dropped: 0, skipped: 0 }
  try {
    await conn.query('START TRANSACTION READ ONLY')
    const [all] = await conn.query(`
      SELECT c.id, c.slug, c.shortLabel AS title, c.isActive, c.prompt, c.axes, c.metadata, c.entityTypeId, g.slug AS groupSlug, t.slug AS typeSlug
        FROM Category c JOIN CategoryGroup g ON g.id = c.groupId JOIN EntityType t ON t.id = c.entityTypeId`) as [ListRow[], unknown]
    const bySlug = new Map(all.map((l) => [l.slug, l]))
    const entries = mapEntriesToLists(files, all)

    for (const s of o.lists) if (!bySlug.has(s)) die(`no list with slug "${s}" (use exact slugs; prod:list-values --list "<title>" --json shows them)`)
    const slugs = [...new Set([...o.lists, ...(o.noFile ? all.filter((l) => l.isActive && !entries.has(l.slug)).map((l) => l.slug) : [])])]

    for (const slug of slugs) {
      const l = bySlug.get(slug)!
      const meta = (typeof l.metadata === 'string' ? JSON.parse(l.metadata) : l.metadata) as Record<string, any> | null
      const adminEditedAt: string | null = meta?.adminEditedAt ?? null
      // Every row of the list (excluded and pending too), in the list's order.
      const [rows] = await conn.query(`
        SELECT e.id, e.canonicalName AS name, e.status, e.mergedIntoId, ce.isExcluded
          FROM CategoryEntity ce JOIN Entity e ON e.id = ce.entityId
         WHERE ce.categoryId = ? ORDER BY ce.sortOrder, e.canonicalName`, [l.id]) as [any[], unknown]
      const current = rows.filter((r) => !r.isExcluded && r.status === 'APPROVED' && !r.mergedIntoId)
      const onList = new Set(rows.map((r) => r.id as string))

      const ref = entries.get(slug)
      const fileNames = (ref?.entry.values ?? []).map(nameOf).filter(Boolean)
      // What each file name resolves to, the way the importer resolves it (key, legacy key, exact name, exact alias; following merges).
      const resolvedTo = new Map<string, string[]>()
      if (fileNames.length) {
        const keys = [...new Set(fileNames.flatMap((n) => [key(n), legacyAsciiKey(n)]).filter(Boolean))]
        const [ents] = await conn.query(`
          SELECT e.id, e.slug, e.canonicalName, e.mergedIntoId, a.alias
            FROM Entity e LEFT JOIN EntityAlias a ON a.entityId = e.id
           WHERE e.entityTypeId = ? AND (e.slug IN (?) OR e.canonicalName IN (?) OR a.alias IN (?))`, [l.entityTypeId, keys, fileNames, fileNames]) as [any[], unknown]
        for (const n of fileNames) {
          const k = new Set([key(n), legacyAsciiKey(n)])
          const ids = ents.filter((e) => k.has(e.slug) || e.canonicalName === n || e.alias === n).map((e) => (e.mergedIntoId ?? e.id) as string)
          resolvedTo.set(n, [...new Set(ids)])
        }
      }
      const spelling = new Map<string, string>() // entity id → the file's name for it
      for (const n of fileNames) { const ids = resolvedTo.get(n)!; if (ids.length === 1 && !spelling.has(ids[0]!)) spelling.set(ids[0]!, n) }
      // Names on the file that are not on the list at all: unpublished additions, or Admin removals.
      const extras = fileNames.filter((n) => !resolvedTo.get(n)!.some((id) => onList.has(id)))
      const synced = ref ? (ref.entry.categorySlug ? (ref.entry.adminEditedAt ?? null) === adminEditedAt : !adminEditedAt) : true
      const kept = synced ? extras : []
      const values = [...current.map((r) => spelling.get(r.id) ?? r.name), ...kept]

      if (current.length + kept.length < MIN_VALUES) {
        counts.skipped++
        results.push(`✗ ${slug}: only ${current.length} values; the catalog format needs ${MIN_VALUES} — fill it in Admin first`)
        continue
      }
      if (!synced && extras.length) counts.dropped += extras.length

      if (ref) {
        // Pin fields right after schemaVersion; every other key keeps its place in the entry.
        const { schemaVersion, categorySlug: _p, adminEditedAt: _a, ...rest } = ref.entry
        const pinned: Entry = { schemaVersion, categorySlug: slug, adminEditedAt, ...rest, groupSlug: l.groupSlug, entityTypeSlug: l.typeSlug, title: l.title, values }
        const changed = JSON.stringify(pinned) !== JSON.stringify(ref.entry)
        ref.file.entries[ref.file.entries.indexOf(ref.entry)] = pinned
        if (changed) touched.add(ref.file)
        changed ? counts.synced++ : counts.unchanged++
        results.push(`${changed ? '~' : '='} ${slug}: ${current.length} values${kept.length ? ` + ${kept.length} unpublished` : ''}${!synced && extras.length ? `, dropped ${extras.length} (edited in Admin since last sync: ${extras.slice(0, 3).join(', ')}${extras.length > 3 ? ', …' : ''})` : ''} → ${ref.file.name}`)
      } else {
        const axes = typeof l.axes === 'string' ? JSON.parse(l.axes) : l.axes
        let adopt = files.find((f) => f.name === ADOPT_FILE)
        if (!adopt) {
          adopt = { name: ADOPT_FILE, path: resolve(LISTS_DIR, ADOPT_FILE), array: true, entries: [], style: 'std', exact: true }
          files.push(adopt)
        }
        adopt.entries.push({
          schemaVersion: 1, categorySlug: slug, adminEditedAt, groupSlug: l.groupSlug, entityTypeSlug: l.typeSlug, title: l.title, prompt: l.prompt,
          axes: Array.isArray(axes) && axes.length ? axes : ['general'], values, isAbstract: meta?.mediaKind === 'ICON',
        })
        touched.add(adopt)
        counts.adopted++
        results.push(`+ ${slug}: ${current.length} values${l.isActive ? '' : ' (inactive)'} → ${ADOPT_FILE} (adopted)`)
      }
    }
    await conn.query('COMMIT')
  } finally {
    await conn.end()
  }

  for (const r of results) console.log(r)
  for (const f of touched) {
    if (!f.exact) console.error(`⚠ ${f.name}: original formatting not recognised; rewritten as ${f.style}`)
    if (!o.dryRun) writeFileSync(f.path, f.name === ADOPT_FILE ? formatJson(f.entries, 'std') : serializeCatalogFile(f))
  }
  if (touched.size) console.log(`${o.dryRun ? 'would write' : 'wrote'}: ${[...touched].map((f) => `catalog/lists/${f.name}`).join(', ')}`)
  if (touched.size && !o.dryRun) console.log(`next: DATABASE_URL=<${target.name}> pnpm --filter server catalog:validate — a fresh sync must show 0 choices added`)
  console.log(`LIST_STUB ${JSON.stringify({ target: target.name, dryRun: o.dryRun, ...counts, files: [...touched].map((f) => f.name) })}`)
}

main().catch((error) => die(String(error?.message ?? error)))
