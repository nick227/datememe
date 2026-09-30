import { db } from '@project/db'
import { CATEGORY_SELECT, ENTITY_SELECT, serializeCategory, serializeEntity } from '../lib/serializers'
import { ListService } from './ListService'
import { groupIdsWithResults } from '../lib/resultGroups'
import { relatedRankings } from '../lib/relatedRankings'
import { pollFaces } from '../lib/pollFaces'
import { rankingModules, type ViewerList } from '../lib/rankingFeed'

const listService = new ListService()

// The one aggregate ranking RankingsRebuildJob rebuilds per category. Only
// published categories (enough answers — the worker's RANKINGS_MIN_TAKES)
// have a set at all, so nothing here needs to know the threshold.
const LIST_SCORE_SET = { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', window: 'ALL_TIME' } as const

const DETAIL_ENTRY_LIMIT = 50

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/**
 * The Rankings tab: "what did everybody pick?" — the site-wide counterpart to
 * Lists ("what do I pick?") and a profile's list cards ("what did this person
 * pick?"). Deliberately dumb: every count, rank and trend is read straight
 * from RankingsRebuildJob's output; only the viewer's own marks are live.
 */
export class RankingsService {
  async getRankingsFeed(viewerProfileId: string, opts: { groupSlugs?: string[] } = {}) {
    const [resultSets, myLists, groups, publishedGroupIds] = await Promise.all([
      db.resultSet.findMany({
        where: { ...LIST_SCORE_SET, takeCount: { gt: 0 } },
        include: { entries: { orderBy: { rank: 'asc' }, take: DETAIL_ENTRY_LIMIT } },
        orderBy: [{ takeCount: 'desc' }, { scopeValue: 'asc' }],
      }),
      listService.getMyLists(viewerProfileId),
      db.categoryGroup.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, label: true } }),
      groupIdsWithResults(),
    ])

    const categoryRows = await db.category.findMany({
      where: { id: { in: resultSets.map((rs) => rs.scopeValue) }, isActive: true },
      select: CATEGORY_SELECT,
    })
    const categoryById = new Map(categoryRows.map((c) => [c.id, serializeCategory(c)]))

    const entityRows = await db.entity.findMany({
      where: { id: { in: resultSets.flatMap((rs) => rs.entries.map((e) => e.subjectId)) } },
      select: ENTITY_SELECT,
    })
    const entityById = new Map(entityRows.map((e) => [e.id, serializeEntity(e)]))

    // Only sets whose category is still live and whose entries still resolve.
    const allSets = resultSets
      .map((rs) => ({ ...rs, category: categoryById.get(rs.scopeValue), entries: rs.entries.filter((e) => entityById.has(e.subjectId)) }))
      .filter((rs): rs is typeof rs & { category: NonNullable<typeof rs.category> } => !!rs.category && rs.entries.length > 0)

    // Same bar as Lists and Discover: only groups with a published ranking.
    const chipGroups = groups.filter((g) => publishedGroupIds.has(g.id))
    const selected = opts.groupSlugs?.length ? new Set(opts.groupSlugs) : null
    const selectedGroupIds = selected ? new Set(groups.filter((g) => selected.has(g.slug)).map((g) => g.id)) : null
    const sets = selectedGroupIds ? allSets.filter((rs) => selectedGroupIds.has(rs.category.groupId)) : allSets

    return {
      summary: {
        title: 'Rankings',
        subtitle: 'What everyone picked',
        stats: [{ value: sets.length, label: sets.length === 1 ? 'ranking' : 'rankings' }],
      },
      chips: chipGroups.length ? [{ id: 'top', label: 'All' }, ...chipGroups.map((g) => ({ id: g.slug, label: g.label }))] : [],
      data: rankingModules({ sets, allSets, entityById, lists: myLists as ViewerList[] }),
      meta: { hasMore: false, nextCursor: null },
    }
  }

  async getCategoryRankings(viewerProfileId: string, categorySlug: string) {
    const categoryRow = await db.category.findUnique({ where: { slug: categorySlug }, select: CATEGORY_SELECT })
    if (!categoryRow) throw { statusCode: 404, message: 'Category not found' }
    const categoryId = categoryRow.id

    const [resultSet, viewerList, related, faces] = await Promise.all([
      db.resultSet.findUnique({
        where: { idx_result_set_unique: { ...LIST_SCORE_SET, scopeValue: categoryId } },
        include: { entries: { orderBy: { rank: 'asc' }, take: DETAIL_ENTRY_LIMIT } },
      }),
      db.list.findUnique({
        where: { profileId_categoryId: { profileId: viewerProfileId, categoryId } },
        select: { items: { select: { entityId: true, rank: true } } },
      }),
      relatedRankings(categoryRow.groupId, categoryId),
      pollFaces(viewerProfileId, categoryId),
    ])

    const viewerItems = viewerList?.items ?? []
    const viewerRankById = new Map(viewerItems.map((i) => [i.entityId, i.rank]))
    const base = {
      category: serializeCategory(categoryRow),
      viewerHasTaken: viewerItems.length > 0,
    }

    if (!resultSet) {
      return { ...base, isPublished: false, takeCount: null, updatedAt: null, viewerTopPickPercent: null, related, faces, entries: [] }
    }

    const entityRows = await db.entity.findMany({ where: { id: { in: resultSet.entries.map((e) => e.subjectId) } }, select: ENTITY_SELECT })
    const entityById = new Map(entityRows.map((e) => [e.id, serializeEntity(e)]))

    // "31% of people put Target at #1" — straight from the rebuild's
    // firstPlaceCount (the viewer's #1 may sit outside the top 50 shown).
    // Unranked lists have no real #1, only tap order.
    let viewerTopPickPercent: number | null = null
    const viewerTop = viewerItems.find((i) => i.rank === 1)
    if (viewerTop && categoryRow.orderingMode === 'RANKED') {
      const entry =
        resultSet.entries.find((e) => e.subjectId === viewerTop.entityId) ??
        (await db.resultEntry.findUnique({ where: { resultSetId_subjectId: { resultSetId: resultSet.id, subjectId: viewerTop.entityId } } }))
      viewerTopPickPercent = percent(entry?.firstPlaceCount ?? 0, resultSet.takeCount)
    }

    return {
      ...base,
      isPublished: true,
      takeCount: resultSet.takeCount,
      updatedAt: resultSet.updatedAt,
      viewerTopPickPercent,
      related,
      faces,
      entries: resultSet.entries
        .filter((e) => entityById.has(e.subjectId))
        .map((e) => ({
          rank: e.rank,
          previousRank: e.previousRank,
          score: e.score,
          pickCount: e.pickCount,
          firstPlaceCount: e.firstPlaceCount,
          pickPercent: percent(e.pickCount, resultSet.takeCount),
          viewerRank: viewerRankById.get(e.subjectId) ?? null,
          entity: entityById.get(e.subjectId)!,
        })),
    }
  }
}
