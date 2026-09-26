import { db, ResultSubjectType, ResultMetric, ResultScopeType, ResultWindow } from '@project/db'

export async function profileResultsRefreshJob(payload: { metric: ResultMetric, window: ResultWindow }) {
  const { metric, window } = payload
  
  if (metric === 'MOST_LIKED') {
    const swipeAgg = await db.swipe.groupBy({
      by: ['targetProfileId'],
      where: { action: 'LIKE' },
      _count: { targetProfileId: true },
      orderBy: { _count: { targetProfileId: 'desc' } },
      take: 100
    })
    
    const sortedProfiles = swipeAgg.map(agg => ({
      profileId: agg.targetProfileId,
      score: (agg._count as any).targetProfileId ?? 0
    })).sort((a, b) => b.score - a.score || a.profileId.localeCompare(b.profileId))
    
    await updateGenericResultSet('PROFILE', 'MOST_LIKED', 'GLOBAL', '_GLOBAL_', window, sortedProfiles, 0)
    
  } else if (metric === 'MOST_ACTIVE') {
    const listAgg = await db.list.groupBy({
      by: ['profileId'],
      where: { isComplete: true },
      _count: { profileId: true },
      orderBy: { _count: { profileId: 'desc' } },
      take: 100
    })
    
    const sortedProfiles = listAgg.map(agg => ({
      profileId: agg.profileId,
      score: (agg._count as any).profileId ?? 0
    })).sort((a, b) => b.score - a.score || a.profileId.localeCompare(b.profileId))
    
    await updateGenericResultSet('PROFILE', 'MOST_ACTIVE', 'GLOBAL', '_GLOBAL_', window, sortedProfiles, 0)
    
  } else if (metric === 'RISING' || metric === 'MOST_COMPATIBLE' || metric === 'MOST_DISTINCTIVE') {
    // Do not surface these global rankings as authoritative yet. They are POC approximations.
    return
  }
}

async function updateGenericResultSet(
  subjectType: ResultSubjectType,
  metric: ResultMetric,
  scopeType: ResultScopeType,
  scopeValue: string | null,
  window: ResultWindow,
  sortedSubjects: Array<{ profileId: string, score: number }>,
  takeCount: number
) {
  // Fetch existing
  const existingSet = await db.resultSet.findFirst({
    where: { subjectType, metric, scopeType, scopeValue, window },
    include: { entries: true }
  })

  const previousRanks = new Map<string, number>()
  if (existingSet) {
    for (const entry of existingSet.entries) {
      previousRanks.set(entry.subjectId, entry.rank)
    }
  }

  await db.$transaction(async (tx) => {
    // Upsert the result set safely preventing duplicate constraints concurrently
    const resultSet = await tx.resultSet.upsert({
      where: { 
        idx_result_set_unique: { subjectType, metric, scopeType, scopeValue: scopeValue as any, window }
      },
      update: { takeCount },
      create: { subjectType, metric, scopeType, scopeValue, window, takeCount }
    })

    // Delete old entries
    await tx.resultEntry.deleteMany({
      where: { resultSetId: resultSet.id }
    })

    // Create new entries
    const entriesToCreate = sortedSubjects.map((item, index) => {
      const rank = index + 1
      const previousRank = previousRanks.get(item.profileId)
      return {
        resultSetId: resultSet.id,
        subjectId: item.profileId,
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
