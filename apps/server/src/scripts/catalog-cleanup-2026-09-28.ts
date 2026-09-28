import { db } from '@project/db'

// One-off catalog cleanup from the 2026-09-28 gap audit (docs/catalog-gap-audit.md).
// Dry run unless --apply. DB-only. Idempotent. Group merges are separate:
// apps/worker/src/scripts/merge-category-groups.ts.
//
//   1. Retire one list of each duplicate pair (isActive=false; history kept) —
//      the one without completed lists, or the broad one when neither has any.
//   2. Add a "History & Politics" group for the lists misfiled under Craft.
//   3. Delete three orphaned entity types left by lists that were imported
//      under the wrong type (no category, no picks).
const apply = process.argv.includes('--apply')

const RETIRE = ['top-hip-hop-artists', 'top-comedians', 'top-athletes', 'favorite-sports-franchises', 'favorite-pizza-toppings', 'top-streaming-services']
const HISTORY_GROUP = { slug: 'history-politics', label: 'History & Politics' }
const TO_HISTORY = ['most-impactful-us-presidents', 'most-influential-historical-figures', 'top-political-commentators']
const ORPHAN_TYPES = ['festival', 'social-media-creator', 'video-game-console']

async function main() {
  const report: string[] = []

  for (const slug of RETIRE) {
    const c = await db.category.findUnique({ where: { slug }, select: { id: true, isActive: true } })
    if (!c || !c.isActive) { report.push(`retire ${slug}: already done`); continue }
    const complete = await db.list.count({ where: { categoryId: c.id, isComplete: true } })
    if (complete) { report.push(`retire ${slug}: SKIPPED — has ${complete} completed lists`); continue }
    report.push(`retire ${slug}`)
    if (apply) await db.category.update({ where: { id: c.id }, data: { isActive: false } })
  }

  let group = await db.categoryGroup.findUnique({ where: { slug: HISTORY_GROUP.slug } })
  if (!group) {
    const last = await db.categoryGroup.aggregate({ _max: { sortOrder: true } })
    report.push(`create group ${HISTORY_GROUP.slug}`)
    if (apply) group = await db.categoryGroup.create({ data: { ...HISTORY_GROUP, sortOrder: (last._max.sortOrder ?? 0) + 1 } })
  }
  for (const slug of TO_HISTORY) {
    const c = await db.category.findUnique({ where: { slug }, select: { id: true, group: { select: { slug: true } } } })
    if (!c || c.group.slug === HISTORY_GROUP.slug) continue
    report.push(`move ${slug}: ${c.group.slug} -> ${HISTORY_GROUP.slug}`)
    if (apply) await db.category.update({ where: { id: c.id }, data: { groupId: group!.id } })
  }

  for (const slug of ORPHAN_TYPES) {
    const t = await db.entityType.findUnique({ where: { slug }, select: { id: true, _count: { select: { categories: true, entities: true } } } })
    if (!t) { report.push(`delete type ${slug}: already gone`); continue }
    const picks = await db.listItem.count({ where: { entity: { entityTypeId: t.id } } })
    if (t._count.categories || picks) { report.push(`delete type ${slug}: SKIPPED — ${t._count.categories} categories, ${picks} picks`); continue }
    report.push(`delete type ${slug} and its ${t._count.entities} entities`)
    if (apply) await db.$transaction([db.entity.deleteMany({ where: { entityTypeId: t.id } }), db.entityType.delete({ where: { id: t.id } })])
  }

  console.log(report.map((r) => `${apply ? '✓' : '→'} ${r}`).join('\n'))
  console.log(apply ? '\nApplied.' : '\nDry run — nothing written. Re-run with --apply.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
