import { db, Prisma } from '@project/db'

// Results are visible after the first eligible vote; featuring thresholds
// are separate from result visibility. Empty snapshots retain their revision.
const PUBLISHED_LIST_SCORE = {
  subjectType: 'ENTITY',
  metric: 'LIST_SCORE',
  scopeType: 'CATEGORY',
  window: 'ALL_TIME',
  takeCount: { gt: 0 },
} as const

export async function groupIdsWithResults(client: Prisma.TransactionClient = db) {
  const sets = await client.resultSet.findMany({
    where: PUBLISHED_LIST_SCORE,
    select: { scopeValue: true, entries: { select: { id: true }, take: 1 } },
  })
  const categoryIds = sets.filter((set) => set.entries.length > 0).map((set) => set.scopeValue)
  if (!categoryIds.length) return new Set<string>()
  const categories = await client.category.findMany({
    where: { id: { in: categoryIds }, isActive: true },
    select: { groupId: true },
  })
  return new Set(categories.map((category) => category.groupId))
}
