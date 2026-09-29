import { db, Prisma } from '@project/db'
export async function updateTaxonomyJob(payload: {
  addedEntities: string[]
  removedEntities: string[]
  categoryId: string
  isCompleteDiff: 1 | -1 | 0
  currentEntityIds?: string[]
}) {
  const { addedEntities, removedEntities, isCompleteDiff, currentEntityIds = [] } = payload
  let allAffectedEntities = Array.from(new Set([...addedEntities, ...removedEntities]))

  if (isCompleteDiff !== 0) {
    allAffectedEntities = Array.from(new Set([...allAffectedEntities, ...currentEntityIds]))
  }

  if (allAffectedEntities.length === 0) return

  const globalCounts = await db.$queryRaw<any[]>`
    SELECT li.entityId as entityId, COUNT(DISTINCT l.profileId) as usageCount
    FROM ListItem li
    JOIN List l ON l.id = li.listId
    WHERE li.entityId IN (${Prisma.join(allAffectedEntities)})
      AND l.isComplete = 1
    GROUP BY li.entityId
  `

  const categoryCounts = await db.$queryRaw<any[]>`
    SELECT li.entityId as entityId, l.categoryId as categoryId, COUNT(DISTINCT l.profileId) as usageCount
    FROM ListItem li
    JOIN List l ON l.id = li.listId
    WHERE li.entityId IN (${Prisma.join(allAffectedEntities)})
      AND l.isComplete = 1
    GROUP BY li.entityId, l.categoryId
  `

  const globalCountMap = new Map<string, number>()
  for (const r of globalCounts) {
    globalCountMap.set(r.entityId, Number(r.usageCount))
  }

  const categoryCountMap = new Map<string, Record<string, number>>()
  for (const r of categoryCounts) {
    if (!categoryCountMap.has(r.entityId)) categoryCountMap.set(r.entityId, {})
    categoryCountMap.get(r.entityId)![r.categoryId] = Number(r.usageCount)
  }

  // We loop to avoid massive transactions and handle each entity idempotently.
  for (const entityId of allAffectedEntities) {
    const distinctProfilesGlobal = globalCountMap.get(entityId) ?? 0
    const usageByCategory = categoryCountMap.get(entityId) ?? {}

    await db.$transaction(async (tx) => {
      await tx.entity.update({
        where: { id: entityId },
        data: { usageCount: distinctProfilesGlobal }
      })
      for (const [catId, count] of Object.entries(usageByCategory)) {
        await tx.entityCategoryStat.upsert({
          where: { entityId_categoryId: { entityId, categoryId: catId } },
          update: { usageCount: count },
          create: { entityId, categoryId: catId, usageCount: count }
        })
      }
    })
  }

  // Category.popularityCount / topPickEntityId are owned by RankingsRebuildJob
  // (one #1 across the app — the site ranking's), not recomputed here.
}

