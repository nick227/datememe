import { db } from '@project/db'

export async function listResultsRefreshJob(payload: { categoryId: string }) {
  const { categoryId } = payload

  // Get all completed lists for this category
  const completedLists = await db.list.findMany({
    where: { categoryId, isComplete: true },
    include: { items: true },
  })

  const takeCount = completedLists.length
  if (takeCount === 0) {
    await db.resultSet.deleteMany({
      where: { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', scopeValue: categoryId, window: 'ALL_TIME' }
    })
    return
  }

  // Calculate scores (Standard Borda count-ish logic)
  const scoreMap = new Map<string, number>()
  for (const list of completedLists) {
    for (const item of list.items) {
      const points = Math.max(1, 10 - item.rank)
      scoreMap.set(item.entityId, (scoreMap.get(item.entityId) || 0) + points)
    }
  }

  const sortedEntities = Array.from(scoreMap.entries())
    .map(([entityId, score]) => ({ entityId, score }))
    .sort((a, b) => b.score - a.score)

  // We need to fetch the existing entries to get previous ranks
  const existingSet = await db.resultSet.findFirst({
    where: { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', scopeValue: categoryId, window: 'ALL_TIME' },
    include: { entries: true }
  })

  const previousRanks = new Map<string, number>()
  if (existingSet) {
    for (const entry of existingSet.entries) {
      previousRanks.set(entry.subjectId, entry.rank)
    }
  }

  // We do it in a transaction
  await db.$transaction(async (tx) => {
    // Upsert the result set
    const resultSet = await tx.resultSet.upsert({
      where: { 
        idx_result_set_unique: { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', scopeValue: categoryId, window: 'ALL_TIME' }
      },
      update: { takeCount },
      create: { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', scopeValue: categoryId, window: 'ALL_TIME', takeCount }
    })

    // Delete old entries
    await tx.resultEntry.deleteMany({
      where: { resultSetId: resultSet.id }
    })

    // Create new entries
    const entriesToCreate = sortedEntities.map((item, index) => {
      const rank = index + 1
      const previousRank = previousRanks.get(item.entityId)
      return {
        resultSetId: resultSet.id,
        subjectId: item.entityId,
        rank,
        previousRank: previousRank !== undefined ? previousRank : null,
        score: item.score
      }
    })

    if (entriesToCreate.length > 0) {
      await tx.resultEntry.createMany({
        data: entriesToCreate
      })
    }
  })
}
