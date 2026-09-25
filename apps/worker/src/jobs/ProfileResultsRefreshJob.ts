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
    }))
    
    await updateGenericResultSet('PROFILE', 'MOST_LIKED', 'GLOBAL', null, window, sortedProfiles, 0)
    
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
    }))
    
    await updateGenericResultSet('PROFILE', 'MOST_ACTIVE', 'GLOBAL', null, window, sortedProfiles, 0)
    
  } else if (metric === 'RISING') {
    // POC: Profiles created recently or gaining recent likes (Mocked for POC by reusing MOST_LIKED with a "velocity" twist)
    const swipeAgg = await db.swipe.groupBy({
      by: ['targetProfileId'],
      where: { action: 'LIKE' },
      _count: { targetProfileId: true },
      orderBy: { _count: { targetProfileId: 'desc' } },
      take: 100
    })
    
    // Simulate "Rising" by shuffling the top results or heavily weighting recent ones
    const sortedProfiles = swipeAgg.map((agg, i) => ({
      profileId: agg.targetProfileId,
      score: Math.round(((agg._count as any).targetProfileId ?? 0) * (1 + (Math.random() * 0.5)))
    })).sort((a, b) => b.score - a.score)
    
    await updateGenericResultSet('PROFILE', 'RISING', 'GLOBAL', null, window, sortedProfiles, 0)

  } else if (metric === 'MOST_COMPATIBLE') {
    // POC: Count profiles with the most shared lists (or just a generic high-engagement group)
    const lists = await db.list.findMany({ where: { isComplete: true }, select: { profileId: true } })
    const counts = new Map<string, number>()
    lists.forEach(l => counts.set(l.profileId, (counts.get(l.profileId) || 0) + Math.round(Math.random() * 5 + 5)))
    
    const sortedProfiles = Array.from(counts.entries())
      .map(([profileId, score]) => ({ profileId, score }))
      .sort((a, b) => b.score - a.score).slice(0, 100)
      
    await updateGenericResultSet('PROFILE', 'MOST_COMPATIBLE', 'GLOBAL', null, window, sortedProfiles, 0)

  } else if (metric === 'MOST_DISTINCTIVE') {
    // POC: Profiles with lists that deviate from consensus.
    const lists = await db.list.findMany({ where: { isComplete: true }, select: { profileId: true } })
    const counts = new Map<string, number>()
    lists.forEach(l => counts.set(l.profileId, (counts.get(l.profileId) || 0) + Math.round(Math.random() * 100)))
    
    const sortedProfiles = Array.from(counts.entries())
      .map(([profileId, score]) => ({ profileId, score }))
      .sort((a, b) => b.score - a.score).slice(0, 100)
      
    await updateGenericResultSet('PROFILE', 'MOST_DISTINCTIVE', 'GLOBAL', null, window, sortedProfiles, 0)
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
    // Upsert the result set safely without unique constraint on nullable field
    let resultSet = await tx.resultSet.findFirst({
      where: { subjectType, metric, scopeType, scopeValue, window }
    })
    if (resultSet) {
      resultSet = await tx.resultSet.update({
        where: { id: resultSet.id },
        data: { takeCount }
      })
    } else {
      resultSet = await tx.resultSet.create({
        data: { subjectType, metric, scopeType, scopeValue, window, takeCount }
      })
    }

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
