import { db } from '@project/db'
import { CATEGORY_SELECT, serializeCategory } from './serializers'

const RELATED_LIMIT = 8
const LIST_SCORE = { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', window: 'ALL_TIME' } as const

export async function relatedRankings(groupId: string, categoryId: string) {
  const siblings = await db.category.findMany({
    where: { groupId, isActive: true, id: { not: categoryId } },
    select: CATEGORY_SELECT,
  })
  if (!siblings.length) return []

  const sets = await db.resultSet.findMany({
    where: { ...LIST_SCORE, takeCount: { gt: 0 }, scopeValue: { in: siblings.map((category) => category.id) } },
    include: { entries: { orderBy: { rank: 'asc' }, take: 1 } },
    orderBy: { takeCount: 'desc' },
    take: RELATED_LIMIT,
  })
  const topIds = sets.flatMap((set) => (set.entries[0] ? [set.entries[0].subjectId] : []))
  const entities = await db.entity.findMany({ where: { id: { in: topIds } }, select: { id: true, canonicalName: true } })
  const nameById = new Map(entities.map((entity) => [entity.id, entity.canonicalName]))
  const categoryById = new Map(siblings.map((category) => [category.id, serializeCategory(category)]))

  return sets.flatMap((set) => {
    const category = categoryById.get(set.scopeValue)
    const topPickName = set.entries[0] ? nameById.get(set.entries[0].subjectId) : undefined
    if (!category || !topPickName) return []
    return [{
      slug: category.slug,
      shortLabel: category.shortLabel,
      imageUrl: category.imageUrl,
      imageCardUrl: category.imageCardUrl,
      topPickName,
    }]
  })
}
