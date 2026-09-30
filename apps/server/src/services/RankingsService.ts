import { db } from '@project/db'
import { CATEGORY_SELECT, ENTITY_SELECT, serializeCategory, serializeEntity } from '../lib/serializers'
import { ListService } from './ListService'
import { metric, toCategoryUnit } from './ContentFeedService'
import { groupIdsWithResults } from '../lib/resultGroups'
import { relatedRankings } from '../lib/relatedRankings'

const listService = new ListService()

// The one aggregate ranking RankingsRebuildJob rebuilds per category. Only
// published categories (enough answers — the worker's RANKINGS_MIN_TAKES)
// have a set at all, so nothing here needs to know the threshold.
const LIST_SCORE_SET = { subjectType: 'ENTITY', metric: 'LIST_SCORE', scopeType: 'CATEGORY', window: 'ALL_TIME' } as const

const RIVER_PREVIEW_SIZE = 3
const RAIL_SIZE = 10
const DETAIL_ENTRY_LIMIT = 50
// "Closest race" = #2 within this fraction of #1's score.
const CLOSE_RACE_GAP = 0.15
// Rows are the page; a rail interrupts after this many ranking blocks.
const RAIL_EVERY = 3

// Same arrow convention ResultUnitCard renders: "+2" up, "-1" down, "new".
function trendFor(rank: number, previousRank: number | null) {
  if (previousRank == null) return 'new'
  if (previousRank > rank) return `+${previousRank - rank}`
  if (previousRank < rank) return `${previousRank - rank}`
  return undefined
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function voteLine(takeCount: number, entries: { rank: number; score: number; previousRank: number | null }[]) {
  const votes = `${takeCount} ${takeCount === 1 ? 'vote' : 'votes'}`
  const top = entries[0]
  const next = entries[1]
  if (!top || !next || top.score <= 0) return votes
  const lead = top.score - next.score
  if (lead <= 1 || lead / top.score <= CLOSE_RACE_GAP) return `${votes} · close race`
  if (top.previousRank != null && top.previousRank > top.rank) return `${votes} · ↑ ${top.previousRank - top.rank} since yesterday`
  return votes
}

async function scoreTotalBySet(resultSetIds: string[]) {
  if (!resultSetIds.length) return new Map<string, number>()
  const rows = await db.resultEntry.groupBy({
    by: ['resultSetId'],
    where: { resultSetId: { in: resultSetIds } },
    _sum: { score: true },
  })
  return new Map(rows.map((row) => [row.resultSetId, row._sum.score ?? 0]))
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
        include: { entries: { orderBy: { rank: 'asc' }, take: RIVER_PREVIEW_SIZE } },
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

    const takenCategoryIds = new Set(myLists.filter((l: any) => l.items.length).map((l: any) => l.categoryId))
    const scoreTotals = await scoreTotalBySet(allSets.map((rs) => rs.id))

    function categoryUnit(rs: (typeof sets)[number], index: number, subtitle?: string) {
      const top = entityById.get(rs.entries[0]!.subjectId)!
      return {
        ...toCategoryUnit({ ...rs.category, topPick: top }, { completed: takenCategoryIds.has(rs.category.id), hasAnswered: takenCategoryIds.has(rs.category.id) }),
        subtitle: subtitle ?? `#1 ${top.canonicalName}`,
        metrics: [metric('popularity', 'answered', rs.takeCount, 'primary')],
        position: index,
      }
    }

    // The "rankings-top-" prefix is the client's contract for "this module
    // is one category's ranking" — the slug after it routes to the full page.
    const rowModules = sets.map((rs) => ({
      moduleKind: 'collection',
      id: `rankings-top-${rs.category.slug}`,
      type: 'results',
      // shortLabel already reads as a title ("Top Athletes", "Favorite Authors").
      title: rs.category.shortLabel,
      imageCardUrl: rs.category.imageCardUrl || null,
      imageUrl: rs.category.imageUrl || null,
      context: { zone: 'results', reason: voteLine(rs.takeCount, rs.entries) },
      suggestedStructure: 'river',
      items: rs.entries.map((entry, i) => {
        const entity = entityById.get(entry.subjectId)!
        return {
          id: entry.id,
          kind: 'result',
          resultType: 'entity',
          title: entity.canonicalName,
          imageUrl: entity.imageUrl,
          rank: entry.rank,
          trend: trendFor(entry.rank, entry.previousRank),
          position: i,
          metrics: [metric('percentile', 'of points', percent(entry.score, scoreTotals.get(rs.id) ?? 0), 'primary')],
          entity,
        }
      }),
    }))

    // The viewer's own taken rankings stay a top rail, even when a topic
    // filter narrows the public rows below.
    const yoursModule = allSets.some((rs) => takenCategoryIds.has(rs.category.id))
      ? {
          moduleKind: 'collection' as const,
          id: 'rankings-yours',
          type: 'results' as const,
          title: 'My rankings',
          suggestedStructure: 'rail' as const,
          items: allSets.filter((rs) => takenCategoryIds.has(rs.category.id)).slice(0, RAIL_SIZE).map((rs, i) => categoryUnit(rs, i)),
        }
      : null

    // Occasional interruptions, in this order, each only if it has content.
    const rails: any[] = []
    const races = sets
      .filter((rs) => rs.entries.length >= 2 && rs.entries[0]!.score > 0)
      .map((rs) => ({ rs, gap: (rs.entries[0]!.score - rs.entries[1]!.score) / rs.entries[0]!.score }))
      .filter((r) => r.gap <= CLOSE_RACE_GAP)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, RAIL_SIZE)
    if (races.length) {
      rails.push({
        moduleKind: 'collection',
        id: 'rankings-close-races',
        type: 'comparison',
        title: 'Closest races',
        suggestedStructure: 'rail',
        items: races.map(({ rs }, i) => {
          const margin = rs.entries[0]!.score - rs.entries[1]!.score
          return {
            ...categoryUnit(rs, i, `${rs.category.shortLabel} · ${margin === 0 ? 'Tied' : `${margin} pts apart`}`),
            title: `${entityById.get(rs.entries[0]!.subjectId)!.canonicalName} vs ${entityById.get(rs.entries[1]!.subjectId)!.canonicalName}`,
          }
        }),
      })
    }

    // Rows lead, and a rail only ever breaks up a run of RAIL_EVERY of them.
    const modules: any[] = []
    rowModules.forEach((row, i) => {
      modules.push(row)
      if ((i + 1) % RAIL_EVERY === 0 && rails.length) modules.push(rails.shift())
    })

    return {
      summary: {
        title: 'Rankings',
        subtitle: 'What everyone picked',
        stats: [{ value: sets.length, label: sets.length === 1 ? 'ranking' : 'rankings' }],
      },
      chips: chipGroups.length ? [{ id: 'top', label: 'All' }, ...chipGroups.map((g) => ({ id: g.slug, label: g.label }))] : [],
      data: yoursModule ? [yoursModule, ...modules] : modules,
      meta: { hasMore: false, nextCursor: null },
    }
  }

  async getCategoryRankings(viewerProfileId: string, categorySlug: string) {
    const categoryRow = await db.category.findUnique({ where: { slug: categorySlug }, select: CATEGORY_SELECT })
    if (!categoryRow) throw { statusCode: 404, message: 'Category not found' }
    const categoryId = categoryRow.id

    const [resultSet, viewerList, related] = await Promise.all([
      db.resultSet.findUnique({
        where: { idx_result_set_unique: { ...LIST_SCORE_SET, scopeValue: categoryId } },
        include: { entries: { orderBy: { rank: 'asc' }, take: DETAIL_ENTRY_LIMIT } },
      }),
      db.list.findUnique({
        where: { profileId_categoryId: { profileId: viewerProfileId, categoryId } },
        select: { items: { select: { entityId: true, rank: true } } },
      }),
      relatedRankings(categoryRow.groupId, categoryId),
    ])

    const viewerItems = viewerList?.items ?? []
    const viewerRankById = new Map(viewerItems.map((i) => [i.entityId, i.rank]))
    const base = {
      category: serializeCategory(categoryRow),
      viewerHasTaken: viewerItems.length > 0,
    }

    if (!resultSet) {
      return { ...base, isPublished: false, takeCount: null, updatedAt: null, viewerTopPickPercent: null, related, entries: [] }
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
