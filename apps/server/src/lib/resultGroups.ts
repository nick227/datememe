import { db } from '@project/db'

// A published site ranking: RankingsRebuildJob only writes a ResultSet once a
// category clears RANKINGS_MIN_TAKES, so takeCount > 0 is "has results".
const PUBLISHED_LIST_SCORE = {
  subjectType: 'ENTITY',
  metric: 'LIST_SCORE',
  scopeType: 'CATEGORY',
  window: 'ALL_TIME',
  takeCount: { gt: 0 },
} as const

export async function groupIdsWithResults() {
  const sets = await db.resultSet.findMany({
    where: PUBLISHED_LIST_SCORE,
    select: { scopeValue: true, entries: { select: { id: true }, take: 1 } },
  })
  const categoryIds = sets.filter((set) => set.entries.length > 0).map((set) => set.scopeValue)
  if (!categoryIds.length) return new Set<string>()
  const categories = await db.category.findMany({
    where: { id: { in: categoryIds }, isActive: true },
    select: { groupId: true },
  })
  return new Set(categories.map((category) => category.groupId))
}
