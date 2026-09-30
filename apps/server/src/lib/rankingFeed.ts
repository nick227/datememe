import { metric, toCategoryUnit } from '../services/ContentFeedService'

const COMPACT_SIZE = 3
const RAIL_SIZE = 10
const CLOSE_RACE_GAP = 0.15

type FeedEntry = {
  id: string
  subjectId: string
  rank: number
  previousRank: number | null
  score: number
  pickCount: number
}

type FeedCategory = {
  id: string
  slug: string
  shortLabel: string
  imageUrl?: string | null
  imageCardUrl?: string | null
}

export type RankingFeedSet<C extends FeedCategory = FeedCategory> = {
  takeCount: number
  category: C
  entries: FeedEntry[]
}

type Named = { canonicalName: string; imageUrl?: string | null }

export type ViewerList = {
  categoryId: string
  items: { entityId: string; rank: number; entity: { canonicalName: string } }[]
}

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function trendFor(rank: number, previousRank: number | null) {
  if (previousRank == null) return 'new'
  if (previousRank > rank) return `+${previousRank - rank}`
  if (previousRank < rank) return `${previousRank - rank}`
  return undefined
}

function gapOf(entries: FeedEntry[]) {
  const top = entries[0]
  const next = entries[1]
  if (!top || !next || top.score <= 0) return null
  return (top.score - next.score) / top.score
}

function isCloseRace(entries: FeedEntry[]) {
  const gap = gapOf(entries)
  return gap != null && gap <= CLOSE_RACE_GAP
}

function rail(id: string, title: string, items: object[]) {
  return { moduleKind: 'collection' as const, id, type: 'comparison' as const, title, suggestedStructure: 'rail' as const, items }
}

export function rankingModules<C extends FeedCategory, E extends Named>(input: {
  sets: RankingFeedSet<C>[]
  allSets: RankingFeedSet<C>[]
  entityById: Map<string, E>
  lists: ViewerList[]
}) {
  const { sets, allSets, entityById, lists } = input
  const taken = new Set(lists.filter((list) => list.items.length).map((list) => list.categoryId))

  function name(subjectId: string) {
    return entityById.get(subjectId)?.canonicalName ?? ''
  }

  function categoryUnit(rs: RankingFeedSet<C>, index: number, subtitle?: string) {
    const top = entityById.get(rs.entries[0]!.subjectId)!
    return {
      ...toCategoryUnit({ ...rs.category, topPick: top }, { completed: taken.has(rs.category.id), hasAnswered: taken.has(rs.category.id) }),
      subtitle: subtitle ?? `#1 ${top.canonicalName}`,
      metrics: [metric('popularity', 'answered', rs.takeCount, 'primary')],
      position: index,
    }
  }

  const yours = allSets.filter((rs) => taken.has(rs.category.id)).slice(0, RAIL_SIZE)
  const yoursModule = yours.length
    ? {
        moduleKind: 'collection' as const,
        id: 'rankings-yours',
        type: 'results' as const,
        title: 'My rankings',
        suggestedStructure: 'rail' as const,
        items: yours.map((rs, i) => categoryUnit(rs, i)),
      }
    : null

  const full = sets.filter((rs) => !isCloseRace(rs.entries))
  const races = sets.filter((rs) => isCloseRace(rs.entries))
  const lead = full[0] ?? races[0]
  const listsAfter = full[0] ? full.slice(1) : []
  const railRaces = full[0] ? races : races.slice(1)
  const modules: object[] = []
  if (lead) modules.push(previewModule(lead, entityById, taken.has(lead.category.id)))
  const raceRail = closeRaceRail(railRaces, categoryUnit, name)
  if (raceRail) modules.push(raceRail)
  listsAfter.forEach((rs) => modules.push(previewModule(rs, entityById, taken.has(rs.category.id))))
  return yoursModule ? [yoursModule, ...modules] : modules
}

function closeRaceRail<C extends FeedCategory>(
  races: RankingFeedSet<C>[],
  categoryUnit: (rs: RankingFeedSet<C>, index: number, subtitle?: string) => object,
  name: (subjectId: string) => string,
) {
  if (races.length < 2) return null
  return rail('rankings-close-races', 'Close races', races.map((rs, i) => ({
    ...categoryUnit(rs, i, rs.entries.slice(0, COMPACT_SIZE).map((entry, rank) => `${rank + 1}  ${name(entry.subjectId)}`).join('\n')),
    title: rs.category.shortLabel,
    imageUrl: rs.category.imageCardUrl || rs.category.imageUrl || null,
  })))
}

function previewModule<C extends FeedCategory, E extends Named>(rs: RankingFeedSet<C>, entityById: Map<string, E>, answered: boolean) {
  return {
    moduleKind: 'collection' as const,
    id: `rankings-top-${rs.category.slug}`,
    type: 'results' as const,
    title: rs.category.shortLabel,
    imageCardUrl: rs.category.imageCardUrl || null,
    imageUrl: rs.category.imageUrl || null,
    context: {
      zone: 'results' as const,
      takeCount: rs.takeCount,
      preview: 'full' as const,
      viewerHasAnswered: answered,
    },
    suggestedStructure: 'river' as const,
    items: rs.entries.map((entry, i) => {
      const entity = entityById.get(entry.subjectId)!
      return {
        id: entry.id,
        kind: 'result' as const,
        resultType: 'entity' as const,
        title: entity.canonicalName,
        subtitle: `${percent(entry.pickCount, rs.takeCount)}% picked it`,
        imageUrl: entity.imageUrl,
        rank: entry.rank,
        trend: trendFor(entry.rank, entry.previousRank),
        position: i,
        metrics: [],
        entity,
      }
    }),
  }
}
