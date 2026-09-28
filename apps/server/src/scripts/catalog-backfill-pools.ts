import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { db } from '@project/db'
import { ListSeedInputV1 } from '../services/ListImporterService'
import { key, legacyAsciiKey } from '../lib/identityKey'

// One-off repair for lists published before the importer scoped choices:
// they were created as FILTERED with no tags, so each offered every entity of
// its type ("Top Documentaries" offered all movies). For each list file whose
// category is like that, make it CURATED with the file's values as its choices.
// DB-only; dry run unless --apply:
//
//   DATABASE_URL=<target> pnpm --filter server exec tsx src/scripts/catalog-backfill-pools.ts [--apply]
//
// Existing user picks outside the list are kept as choices too, so no saved
// list becomes invalid; they are reported so they can be reviewed.
const apply = process.argv.includes('--apply')
const DIR = resolve(__dirname, '../../../../catalog/lists')

async function main() {
  const lists = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
    .flatMap((f) => { const p = JSON.parse(readFileSync(join(DIR, f), 'utf8')); return Array.isArray(p) ? p : [p] })
    .map((raw) => ListSeedInputV1.parse(raw))
    .filter((l) => l.pool === 'curated')

  let changed = 0, skipped = 0
  for (const list of lists) {
    // Found the way the importer finds it: by slug, else by displayed title.
    const select = { id: true, shortLabel: true, poolMode: true, entityTypeId: true, _count: { select: { requiredTags: true } } } as const
    const category = await db.category.findFirst({ where: { slug: { in: [...new Set([key(list.title), legacyAsciiKey(list.title)])] } }, select })
      ?? await db.category.findFirst({ where: { shortLabel: list.title }, select })
    if (!category || category.poolMode === 'CURATED' || category._count.requiredTags) { skipped++; continue }

    const ids: string[] = []
    const unresolved: string[] = []
    for (const name of list.values) {
      const matches = await db.entity.findMany({
        where: { entityTypeId: category.entityTypeId, OR: [{ slug: { in: [...new Set([key(name), legacyAsciiKey(name)])] } }, { canonicalName: name }, { aliases: { some: { alias: name } } }] },
        select: { id: true, mergedIntoId: true },
      })
      const found = [...new Set(matches.map((m) => m.mergedIntoId ?? m.id))]
      if (found.length === 1) ids.push(found[0]!)
      else unresolved.push(`${name} (${found.length} matches)`)
    }
    if (unresolved.length) {
      console.log(`✗ ${category.shortLabel}: cannot resolve ${unresolved.join(', ')} — left unchanged`)
      skipped++
      continue
    }
    const listed = new Set(ids)
    const picks = await db.listItem.findMany({ where: { list: { categoryId: category.id } }, select: { entityId: true, entity: { select: { canonicalName: true } } } })
    const offList = [...new Map(picks.filter((p) => !listed.has(p.entityId)).map((p) => [p.entityId, p.entity.canonicalName])).entries()]
    const all = await db.entity.count({ where: { entityTypeId: category.entityTypeId, status: 'APPROVED', mergedIntoId: null } })
    console.log(`${apply ? '✓' : '→'} ${category.shortLabel}: ${all} choices -> ${ids.length + offList.length}${offList.length ? ` (keeps existing picks: ${offList.map(([, n]) => n).join(', ')})` : ''}`)
    changed++
    if (!apply) continue
    await db.$transaction(async (tx) => {
      await tx.categoryEntity.createMany({
        data: [...ids, ...offList.map(([id]) => id)].map((entityId, sortOrder) => ({ categoryId: category.id, entityId, sortOrder })),
        skipDuplicates: true,
      })
      await tx.category.update({ where: { id: category.id }, data: { poolMode: 'CURATED' } })
    })
  }
  console.log(`BACKFILL ${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', lists: lists.length, changed, skipped })}`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
