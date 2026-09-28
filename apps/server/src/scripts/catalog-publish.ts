import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { db } from '@project/db'
import { ListImporterService, type ImportReport, type ListSeedInput } from '../services/ListImporterService'
import { key } from '../lib/identityKey'

// Imports catalog list files into whatever DATABASE_URL points at. DB-only —
// safe to run locally against production through the MySQL proxy.
//
//   pnpm --filter server catalog:validate [paths…]   (--dry-run: no writes)
//   pnpm --filter server catalog:publish [paths…]
//
// Paths default to catalog/lists; a directory means every *.json in it. A file
// holds one list or an array of lists. Re-running is safe: existing
// categories and entities are reused, never modified. Exits 1 on any error;
// with errors, nothing is written (validation runs first for every list).
const DEFAULT_DIR = resolve(__dirname, '../../../../catalog/lists')

function listFiles(paths: string[]) {
  return paths.flatMap((p) => statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => f.endsWith('.json')).sort().map((f) => join(p, f))
    : [p])
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const files = listFiles(args.length ? args.map((a) => resolve(a)) : [DEFAULT_DIR])
  const lists: { file: string; list: ListSeedInput }[] = []
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    for (const list of Array.isArray(parsed) ? parsed : [parsed]) lists.push({ file, list })
  }
  // Lists that create an entity type publish first, so a list relying on that
  // type (validated via the batch manifest) finds it regardless of file order.
  lists.sort((a, b) => (a.list.createEntityType || a.list.createGroup ? 0 : 1) - (b.list.createEntityType || b.list.createGroup ? 0 : 1))

  const importer = new ListImporterService()
  const titles = new Map<string, string>()
  const reports: (ImportReport & { file: string })[] = []
  
  const batchManifest = {
    entityTypeSlugs: new Set<string>(),
    groupSlugs: new Set<string>(),
  }
  for (const { list } of lists) {
    if (list.createEntityType) batchManifest.entityTypeSlugs.add(list.entityTypeSlug)
    if (list.createGroup) batchManifest.groupSlugs.add(list.groupSlug)
  }

  // Validate everything first so a bad file can't leave a half-published run.
  for (const { file, list } of lists) {
    const report = { ...(await importer.importList(list, true, batchManifest)), file }
    const titleKey = key(String(list.title ?? ''))
    if (titles.has(titleKey)) report.errors.push(`Title duplicates "${titles.get(titleKey)}"`), report.status = 'ERROR'
    titles.set(titleKey, `${list.title} (${file.split('/').pop()})`)
    reports.push(report)
  }
  const invalid = reports.filter((r) => r.status === 'ERROR')

  if (!dryRun && !invalid.length) {
    for (const [i, { list }] of lists.entries()) reports[i] = { ...(await importer.importList(list)), file: reports[i]!.file }
  }

  for (const r of reports) {
    if (r.status === 'ERROR') console.log(`✗ ${r.title ?? '(invalid)'} [${r.file.split('/').pop()}]\n    ${r.errors.join('\n    ')}`)
    else if (r.categoryCreated || r.entitiesCreated.length || r.choicesAdded) console.log(`${dryRun ? '+' : '✓'} ${r.title}: ${r.categoryCreated ? 'new category, ' : ''}${r.entitiesCreated.length} new / ${r.entitiesReused.length} existing entities${r.choicesAdded ? `, ${r.choicesAdded} choices added` : ''}`)
    for (const w of r.status === 'ERROR' ? [] : r.warnings) console.log(`! ${r.title}: ${w}`)
  }
  const summary = {
    mode: dryRun ? 'validate' : invalid.length ? 'aborted' : 'publish',
    files: files.length,
    lists: reports.length,
    errors: invalid.length,
    newCategories: reports.filter((r) => r.status !== 'ERROR' && r.categoryCreated).length,
    newEntities: reports.reduce((n, r) => n + (r.status === 'ERROR' ? 0 : r.entitiesCreated.length), 0),
    choicesAdded: reports.reduce((n, r) => n + (r.status === 'ERROR' ? 0 : r.choicesAdded), 0),
    warnings: reports.reduce((n, r) => n + (r.status === 'ERROR' ? 0 : r.warnings.length), 0),
    unchangedLists: reports.filter((r) => r.status !== 'ERROR' && !r.categoryCreated && !r.entitiesCreated.length && !r.choicesAdded).length,
  }
  console.log(`CATALOG ${JSON.stringify(summary)}`)
  if (invalid.length) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
