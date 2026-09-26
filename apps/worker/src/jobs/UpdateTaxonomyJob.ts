import { db } from '@project/db'

export async function updateTaxonomyJob(payload: {
  addedEntities: string[]
  removedEntities: string[]
  categoryId: string
  isCompleteDiff: 1 | -1 | 0
  currentEntityIds?: string[]
}) {
  const { addedEntities, removedEntities, categoryId, isCompleteDiff, currentEntityIds = [] } = payload
  let allAffectedEntities = Array.from(new Set([...addedEntities, ...removedEntities]))

  if (isCompleteDiff !== 0) {
    allAffectedEntities = Array.from(new Set([...allAffectedEntities, ...currentEntityIds]))
  }

  // We loop to avoid massive transactions and handle each entity idempotently.
  for (const entityId of allAffectedEntities) {
    const items = await db.listItem.findMany({
      where: { entityId, list: { isComplete: true } },
      select: { list: { select: { profileId: true, categoryId: true } } }
    })
    const distinctProfilesGlobal = new Set(items.map(item => item.list.profileId)).size
    
    const usageByCategory: Record<string, number> = {}
    // Group by categoryId, then count distinct profiles
    const categoryProfiles = new Map<string, Set<string>>()
    for (const item of items) {
      const catId = item.list.categoryId
      if (!categoryProfiles.has(catId)) categoryProfiles.set(catId, new Set())
      categoryProfiles.get(catId)!.add(item.list.profileId)
    }
    for (const [catId, profiles] of categoryProfiles.entries()) {
      usageByCategory[catId] = profiles.size
    }

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

  const completedListCount = await db.list.count({
    where: { categoryId, isComplete: true }
  })

  // "Most common #1 pick" — the entity most often ranked first within this category.
  const [topPick] = await db.listItem.groupBy({
    by: ['entityId'],
    where: { rank: 1, list: { categoryId } },
    _count: { entityId: true },
    orderBy: { _count: { entityId: 'desc' } },
    take: 1,
  })

  await db.category.update({
    where: { id: categoryId },
    data: { popularityCount: completedListCount, topPickEntityId: topPick?.entityId ?? null }
  })
}

