import { db } from '@project/db'

export async function updateTaxonomyJob(payload: {
  addedEntities: string[]
  removedEntities: string[]
  categoryId: string
  isCompleteDiff: 1 | -1 | 0
}) {
  const { addedEntities, removedEntities, categoryId } = payload
  const allAffectedEntities = Array.from(new Set([...addedEntities, ...removedEntities]))

  // We loop to avoid massive transactions and handle each entity idempotently.
  for (const entityId of allAffectedEntities) {
    const count = await db.listItem.count({
      where: { entityId }
    })
    await db.entity.update({
      where: { id: entityId },
      data: { usageCount: count }
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

