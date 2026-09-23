import { db } from '@project/db'
import { decodeOffsetCursor, encodeOffsetCursor, normalizeLimit } from '../lib/pagination'
import { ENTITY_SELECT, PROFILE_FULL_SELECT, serializeProfile, serializeEntity } from '../lib/serializers'
import { resolveEntitlements } from '../lib/entitlements'
import { computeAge } from '../lib/age'
import { normalizeSharedFavorites } from '../lib/sharedFavorites'
import type { AgeBucket } from '../lib/geo'
import { TaxonomyService } from './TaxonomyService'
import { ListService } from './ListService'
import { DiscoveryService, decodeDiscoveryCursor } from './DiscoveryService'

const taxonomyService = new TaxonomyService()
const listService = new ListService()
const discoveryService = new DiscoveryService()

type Metric = {
  type: string
  label: string
  value: string | number
  importance?: 'primary' | 'secondary' | 'tertiary'
}

function metric(type: string, label: string, value: string | number, importance?: Metric['importance']): Metric {
  return importance ? { type, label, value, importance } : { type, label, value }
}

// A short, stable per-page suffix for module ids that legitimately repeat
// across pages (e.g. "similar-taste" on page 3 as well as page 1) — keeps
// React keys unique without the id changing on every refetch of the same page.
function offsetKey(cursor?: string) {
  return cursor ?? 'first'
}

// Same "compelling enough to lead with" heuristic used to pick a spotlight candidate.
function featuredScore(category: any) {
  return (category.matchAnswerMultiplier ?? 0) * 1000 + category.popularityCount
}

function toCategoryUnit(category: any, opts: { completed: boolean; previewEntities?: any[] }) {
  const metrics: Metric[] = []
  if (category.popularityCount > 0) {
    metrics.push(metric('popularity', 'People ranked this', category.popularityCount, 'secondary'))
  }
  if (category.matchAnswerMultiplier && category.matchAnswerMultiplier >= 1.15) {
    metrics.push(
      metric('community-position', 'Your matches answer this', `${category.matchAnswerMultiplier.toFixed(1)}× more`, 'primary'),
    )
  }
  return {
    id: category.slug,
    kind: 'category' as const,
    title: category.shortLabel,
    subtitle: category.prompt,
    imageUrl: category.imageUrl ?? category.topPick?.imageUrl ?? null,
    imageCredit: category.imageCredit ?? category.topPick?.imageCredit ?? null,
    metrics,
    capabilities: { canRank: true },
    relationship: { completed: opts.completed },
    entity: category.topPick ?? null,
    ...(opts.previewEntities ? { previewEntities: opts.previewEntities } : {}),
  }
}

// The one transform from a Category (+ the viewer's own List, if any) to a
// rendered card — shared by every category-backed module on both Lists and
// Discover (topic groups, "Your lists"/"Your favorites" history, and Site
// Picks) so completed/in-progress state and ranked preview entities are
// never computed two different ways in two different places.
function categoryUnitFor(category: any, index: number, myListByCategoryId: Map<string, any>) {
  const list = myListByCategoryId.get(category.id)
  if (list && list.items.length) {
    return {
      ...toCategoryUnit(list.category ?? category, {
        completed: list.isComplete,
        previewEntities: list.items.slice(0, 3).map((item: any) => item.entity),
      }),
      position: index,
    }
  }
  return { ...toCategoryUnit(category, { completed: false }), position: index }
}

function toPersonUnit(candidate: any, index: number, alsoInto: any[] = []) {
  const metrics: Metric[] = [metric('overlap', 'Match', `${candidate.matchPercentage}%`, 'primary')]
  if (candidate.sharedItemsCount) {
    metrics.push(metric('popularity', 'Shared favorites', candidate.sharedItemsCount, 'secondary'))
  }
  return {
    id: candidate.profile.id,
    kind: 'person' as const,
    title: candidate.profile.displayName,
    subtitle: candidate.profile.locationLabel ?? undefined,
    imageUrl: candidate.profile.avatarUrl,
    metrics,
    capabilities: { canOpenProfile: true },
    profile: candidate.profile,
    age: candidate.age,
    sharedFavorites: candidate.sharedFavorites ?? [],
    alsoInto,
    insights: candidate.insights,
    position: index,
  }
}

export class ContentFeedService {
  /**
   * The Lists page as a PageSummary + FeedModule stream — see
   * docs/shared-content-system-proposal.md §8. Grouped by CategoryGroup
   * ("Music", "Movies & TV", ...) rather than by completion status: answered
   * and unanswered categories sit side by side within a group, with the
   * card itself carrying the completed/prompt state. The full beat order
   * (personal history → Quick Picks → Grid/Rail/River, repeating) is built
   * once, then paginated — real cursor pagination through real categories,
   * not synthetic infinite content, but paced so the page unfolds a few
   * beats at a time rather than dumping everything on page one.
   */
  async getListsFeed(viewerProfileId: string, opts: { cursor?: string; limit?: number; groupSlugs?: string[] } = {}) {
    const limit = normalizeLimit(opts.limit, 20, 4)
    const offset = decodeOffsetCursor(opts.cursor)
    const isFirstPage = !opts.cursor
    // Multi-select categories (OR'd) — a real server-side filter, same
    // shape and query param as GET /discover/feed's groupSlugs. null means
    // unfiltered (the "All" chip).
    const selectedGroupSlugs = opts.groupSlugs?.length ? new Set(opts.groupSlugs) : null

    const [categories, myLists, groups, sitePickGroups] = await Promise.all([
      taxonomyService.listCategories(viewerProfileId),
      listService.getMyLists(viewerProfileId),
      db.categoryGroup.findMany({ orderBy: { sortOrder: 'asc' } }),
      // Always the full unscoped set now — a selected group filter no
      // longer narrows the ambient Explore rhythm (see the Results/Explore
      // split below), so there's no longer a cheaper filtered variant of
      // this query worth doing.
      db.sitePickGroup.findMany({
        where: { isActive: true },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      }),
    ])

    const myListByCategoryId = new Map(myLists.map((l: any) => [l.categoryId, l]))

    function unitFor(category: any, index: number) {
      return categoryUnitFor(category, index, myListByCategoryId)
    }

    // Reuses the `categories`/`myListByCategoryId` already fetched above —
    // buildSitePicksModules used to re-fetch both independently (a second
    // full listCategories() call, itself a 3-5 query chain via
    // getMatchAnswerMultipliers), doubling real DB round trips on every
    // Lists request for data this method already had in hand.
    const sitePicksBeats = this.buildSitePicksModules(categories, myListByCategoryId, sitePickGroups)

    const categoriesByGroupId = new Map<string, any[]>()
    for (const c of categories) {
      if (!categoriesByGroupId.has(c.groupId)) categoriesByGroupId.set(c.groupId, [])
      categoriesByGroupId.get(c.groupId)!.push(c)
    }

    // Grid is the baseline; a small group reads better as a Rail than a
    // half-empty grid row — this is what gives topic sections visual rhythm
    // instead of an unbroken wall of identical grids (proposal §1/§5). Always
    // built from every group, filter or no — this is Explore content now
    // (see the Results/Explore split below), and Explore stays the same
    // ambient rhythm regardless of what's selected in the chips.
    const groupModules = groups
      .flatMap((group: any) => {
        const cats = categoriesByGroupId.get(group.id) ?? []
        if (!cats.length) return []
        return Array.from({ length: Math.ceil(cats.length / 6) }, (_, chunk) => {
        const items = cats.slice(chunk * 6, (chunk + 1) * 6)
        const isSmall = items.length <= 3
        return {
          moduleKind: 'collection',
          id: chunk === 0 ? group.slug : `${group.slug}-${chunk}`,
          type: 'lists',
          title: chunk === 0 ? group.label : `${group.label} · continued`,
          context: { groupSlug: group.slug },
          suggestedStructure: isSmall ? 'rail' : 'grid',
          options: isSmall ? undefined : { columns: 2 },
          items: items.map((c: any, i: number) => unitFor(c, chunk * 6 + i)),
        }
        })
      })
      .filter(Boolean) as any[]

    const completedLists = myLists.filter((l: any) => l.isComplete)
    const inProgressLists = myLists.filter((l: any) => !l.isComplete && l.items.length > 0)
    const incompleteSorted = categories
      .filter((c: any) => !myListByCategoryId.has(c.id))
      .sort((a: any, b: any) => featuredScore(b) - featuredScore(a))

    const beats: any[] = []

    // Personal history — in-progress lists surface first (there's something
    // to finish), then completed ones. A persistent record, not a
    // recommendation; mirrors Discover's "Your favorites" Rail in the same
    // position so the two pages read as siblings.
    const historyLists = [
      ...inProgressLists.slice().sort((a: any, b: any) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
      ...completedLists.slice().sort((a: any, b: any) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    ]
    if (historyLists.length) {
      beats.push({
        moduleKind: 'collection',
        id: 'your-lists',
        type: 'lists',
        title: 'Your lists',
        suggestedStructure: 'rail',
        items: historyLists.map((l: any, i: number) => ({
          ...toCategoryUnit(l.category, {
            completed: l.isComplete,
            previewEntities: l.items.slice(0, 3).map((item: any) => item.entity),
          }),
          position: i,
        })),
      })
    } else if (incompleteSorted.length) {
      // Empty state: introduce the action that will populate this collection
      // rather than leaving it blank or faking history (proposal correction).
      beats.push({
        moduleKind: 'collection',
        id: 'your-lists',
        type: 'lists',
        title: 'Answer your first list',
        suggestedStructure: 'rail',
        items: incompleteSorted.slice(0, 2).map((c: any, i: number) => ({ ...toCategoryUnit(c, { completed: false }), position: i })),
      })
    }

    // Quick Picks — a real, persisted, infinite feature (QuickPicksService),
    // not a visual placeholder. The feed only ever emits a marker; the
    // frontend drives the actual quiz loop against /quick-picks/next+choice.
    function quickPicksBeat(id: string) {
      return { moduleKind: 'collection', id, type: 'quiz', title: 'Quick Picks', suggestedStructure: 'spotlight', items: [] }
    }

    // Filtered ("categories" chips, multi-select — see GroupSlugs in the
    // spec): a dedicated Results module leads — every category in the
    // selected group(s), one canonical shape, the obvious direct answer to
    // the click. It's only ever built on page 1 (beats.slice below confines
    // it there regardless, but there's no reason to recompute it per page).
    if (selectedGroupSlugs && isFirstPage) {
      const resultsModule = this.buildResultsModule(categories, groups, selectedGroupSlugs, myListByCategoryId)
      if (resultsModule) beats.push(resultsModule)
    }

    // Explore: the full ambient rhythm — Site Picks x12 -> Quick Picks ->
    // every topic section, interleaved with periodic recommendation/
    // comparison/quiz beats — always, whether or not a filter is active
    // (reported live as "quick picks always at top" / filtered results
    // getting buried under nudges — this is now a stable, unscoped browse
    // feed that sits *after* Results rather than pretending to answer the
    // filter itself).
    beats.push(...sitePicksBeats, quickPicksBeat('quick-picks-0'))

    const spotlightPick = incompleteSorted.find((c: any) => (c.matchAnswerMultiplier ?? 0) >= 1.5 || c.popularityCount >= 20)
    const comparisonCategories = categories
      .filter((c: any) => c.matchAnswerMultiplier != null && Math.abs(c.matchAnswerMultiplier - 1) >= 0.15)
      .slice(0, 5)

    let quizCount = 1
    groupModules.forEach((m: any, i: number) => {
      beats.push(m)
      if (i === 0 && incompleteSorted.length) {
        beats.push({
          moduleKind: 'collection',
          id: 'add-more',
          type: 'prompt',
          title: 'More',
          context: { reason: 'Picked from popularity and how often your matches answer it' },
          suggestedStructure: 'rail',
          items: incompleteSorted.slice(0, 6).map((c: any, i2: number) => ({ ...toCategoryUnit(c, { completed: false }), position: i2 })),
        })
      }
      if (i === 1 && spotlightPick) {
        beats.push({
          moduleKind: 'collection',
          id: 'taste-spotlight',
          type: 'recommendations',
          title: 'Taste spotlight',
          context: {
            reason:
              (spotlightPick.matchAnswerMultiplier ?? 0) >= 1.5
                ? 'Your matches really care about this one'
                : 'The community has spoken',
            sourceEntityId: spotlightPick.id,
          },
          suggestedStructure: 'spotlight',
          items: [{ ...toCategoryUnit(spotlightPick, { completed: false }), position: 0 }],
        })
      }
      if (i === 3 && comparisonCategories.length) {
        beats.push({
          moduleKind: 'collection',
          id: 'how-you-compare',
          type: 'comparison',
          title: 'How you compare',
          suggestedStructure: 'river',
          items: comparisonCategories.map((c: any, i2: number) => ({
            id: c.slug,
            kind: 'insight' as const,
            title: c.shortLabel,
            subtitle:
              c.matchAnswerMultiplier > 1
                ? `Your matches answer this ${c.matchAnswerMultiplier.toFixed(1)}× more than the community average.`
                : `Your matches answer this ${(1 / c.matchAnswerMultiplier).toFixed(1)}× less than the community average.`,
            metrics: [metric('community-position', 'vs. community', `${c.matchAnswerMultiplier.toFixed(1)}×`, 'primary')],
            position: i2,
          })),
        })
      }
      // A repeat Quick Picks beat every few groups keeps the interactive
      // interruption recurring as the feed unfolds, not a one-time novelty.
      if (i > 0 && i % 4 === 0) beats.push(quickPicksBeat(`quick-picks-${quizCount++}`))
    })

    // Explore must feel additive, not recycled: a category that's already
    // the direct answer to the filter (Results) shouldn't also turn up as an
    // ordinary card further down in the same response. Presentation-only —
    // taxonomy/eligibility (usageCount, "seen" state, etc.) are untouched;
    // this just strips duplicate category-kind items from Explore modules
    // and drops a module entirely if that empties it out (e.g. the selected
    // group's own topic section, whose items are the exact same categories
    // Results just showed). Applied on every page of a filtered session, not
    // just page 1 — Explore keeps unfolding across pages, and the same
    // category set stays excluded throughout. `how-you-compare`'s
    // kind:'insight' items are deliberately untouched — a comparison stat
    // about a category isn't the same "recycled card" as the category's
    // ordinary List/Grid card.
    const prunedBeats = selectedGroupSlugs
      ? (() => {
          const resultCategorySlugs = this.resultCategorySlugsFor(categories, groups, selectedGroupSlugs)
          return beats
            .map((m: any) => {
              if (m.id === 'results' || m.id === 'your-lists') return m
              const keptItems = (m.items ?? []).filter((item: any) => !(item.kind === 'category' && resultCategorySlugs.has(item.id)))
              if (keptItems.length === (m.items ?? []).length) return m
              return keptItems.length ? { ...m, items: keptItems } : null
            })
            .filter(Boolean)
        })()
      : beats

    const hasMore = offset + limit < prunedBeats.length
    const page = prunedBeats.slice(offset, offset + limit)
    const nextCursor = hasMore ? encodeOffsetCursor(offset + limit) : null

    return {
      ...(isFirstPage
        ? {
            summary: {
              title: 'Share your preferences',
              stats: [
                { label: 'lists completed', value: completedLists.length },
                { label: 'picks ranked', value: myLists.reduce((sum: number, l: any) => sum + l.items.length, 0) },
              ],
              featuredEntity: this.mostRecentPick(completedLists),
            },
            chips: [{ id: 'top', label: 'All' }, ...groups.map((g: any) => ({ id: g.slug, label: g.label }))],
          }
        : {}),
      data: page,
      meta: { hasMore, nextCursor },
    }
  }

  /**
   * The dedicated Results module for a filtered getListsFeed request — every
   * active category belonging to a selected CategoryGroup, flattened into
   * one module, always `suggestedStructure: 'grid'` regardless of how many
   * categories that comes out to (no isSmall/Rail branching — Results gets
   * one canonical shape, full stop, so clicking a chip has an immediate,
   * visually stable answer). Returns null when the selection resolves to
   * zero categories rather than emitting an empty placeholder module — the
   * caller (and the frontend) treat "module absent" the same as "module
   * present with no items."
   */
  private resultCategorySlugsFor(categories: any[], groups: any[], selectedGroupSlugs: Set<string>): Set<string> {
    const groupIds = new Set(groups.filter((g: any) => selectedGroupSlugs.has(g.slug)).map((g: any) => g.id))
    return new Set(categories.filter((c: any) => groupIds.has(c.groupId)).map((c: any) => c.slug))
  }

  private buildResultsModule(categories: any[], groups: any[], selectedGroupSlugs: Set<string>, myListByCategoryId: Map<string, any>): any | null {
    const selectedGroups = groups.filter((g: any) => selectedGroupSlugs.has(g.slug))
    const resultSlugs = this.resultCategorySlugsFor(categories, groups, selectedGroupSlugs)
    const items = categories
      .filter((c: any) => resultSlugs.has(c.slug))
      .map((c: any, i: number) => categoryUnitFor(c, i, myListByCategoryId))
    if (!items.length) return null

    const labels = selectedGroups.map((g: any) => g.label)
    const title = labels.length > 2 ? `${labels.length} topics` : labels.join(' + ')

    return {
      moduleKind: 'collection',
      id: 'results',
      type: 'lists',
      title,
      context: { zone: 'results' },
      suggestedStructure: 'grid',
      items,
    }
  }

  /**
   * The Site Picks composition — up to 12 admin-curated groups of 4 existing
   * List Definitions each (SitePickGroup/SitePickItem, see the admin Lists >
   * Site Picks screen) — as a ready-to-insert array of Grid FeedModules, in
   * group sortOrder. Reuses categoryUnitFor() for completion-state-aware
   * cards instead of forking its own copy of that transform. Takes
   * `categories`/`myListByCategoryId` from the caller rather than
   * re-fetching them — getListsFeed already has both in hand, and
   * listCategories() alone is a 3-5 query chain (getMatchAnswerMultipliers),
   * not worth doubling. `sitePickGroups` is likewise the caller's own fetch
   * — always the full unscoped set now (getListsFeed no longer filters it,
   * since Site Picks are Explore content and Explore is unscoped by any
   * active group filter). A group referencing a since-deactivated category
   * (excluded from taxonomyService.listCategories) simply renders fewer than
   * 4 cards rather than throwing; a group that resolves to zero cards is
   * dropped entirely.
   */
  private buildSitePicksModules(categories: any[], myListByCategoryId: Map<string, any>, sitePickGroups: any[]): any[] {
    const categoryById = new Map(categories.map((c: any) => [c.id, c]))

    const modules: any[] = []
    for (const group of sitePickGroups) {
      const items = group.items
        .map((item: any, i: number) => {
          const category = categoryById.get(item.categoryId)
          return category ? categoryUnitFor(category, i, myListByCategoryId) : null
        })
        .filter(Boolean)
      if (!items.length) continue
      modules.push({
        moduleKind: 'collection',
        id: `site-picks-${group.slug}`,
        type: 'lists',
        title: group.label,
        suggestedStructure: 'grid',
        options: { columns: 2 },
        items,
      })
    }
    return modules
  }

  private mostRecentPick(completedLists: any[]) {
    const mostRecent = completedLists
      .slice()
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]
    return mostRecent?.items?.[0]?.entity ?? null
  }

  /** "View all" pagination for a single topic (CategoryGroup) — proposal §9. */
  async getListsFeedCollection(viewerProfileId: string, collectionId: string, opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    const offset = decodeOffsetCursor(opts.cursor)

    const group = await db.categoryGroup.findUnique({ where: { slug: collectionId } })
    if (!group) throw { statusCode: 404, message: 'Collection not found' }

    const [categories, myLists] = await Promise.all([
      taxonomyService.listCategories(viewerProfileId, collectionId),
      listService.getMyLists(viewerProfileId),
    ])
    const completedListByCategoryId = new Map(myLists.filter((l: any) => l.isComplete).map((l: any) => [l.categoryId, l]))

    const units = categories.map((c: any) => {
      const completedList = completedListByCategoryId.get(c.id)
      if (completedList) {
        return toCategoryUnit(completedList.category ?? c, {
          completed: true,
          previewEntities: completedList.items.slice(0, 3).map((item: any) => item.entity),
        })
      }
      return toCategoryUnit(c, { completed: false })
    })

    const hasMore = offset + limit < units.length
    const page = units.slice(offset, offset + limit).map((u: any, i: number) => ({ ...u, position: offset + i }))
    return { data: page, meta: { hasMore, nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null } }
  }

  /**
   * Discover: Your favorites (Rail, personal history) → People Grid →
   * Highly compatible (Spotlight) → Quick Picks → Similar Taste (Rail) →
   * shared-interest River — see docs/shared-content-system-proposal.md §8.
   * Real results lead, on purpose: unlike getListsFeed, no Site Picks block
   * here, and Quick Picks is folded in *after* the People Grid rather than
   * pinned ahead of it — either one burying the real results made the
   * filter chips above look broken (their only visible effect stayed
   * off-screen) and read as "Discover shows lists/quizzes, not users".
   */
  async getDiscoverFeed(
    viewerUserId: string,
    viewerProfileId: string,
    opts: { cursor?: string; limit?: number; groupSlugs?: string[]; nearMe?: boolean; ageBucket?: AgeBucket },
  ) {
    const isFirstPage = !opts.cursor
    // Whether any real filter is active — gates the Results/Explore split
    // (see the people-grid module below) the same way Lists' selectedGroupSlugs does.
    const isFiltered = !!(opts.groupSlugs?.length || opts.nearMe || opts.ageBucket)
    // Which page this is, purely to vary grammar/density as the feed
    // continues (proposal correction: an "infinite" feed that's the same
    // Grid→Rail→River shape on every page reads as a rigid rotation, not a
    // living feed). Not used for eligibility — DiscoveryService's own
    // offset/limit pagination is the source of truth for what's already seen.
    const pageIndex = decodeDiscoveryCursor(opts.cursor)?.page ?? 0
    // Resolved once and threaded through both call sites below that need it
    // (DiscoveryService's own candidate serialization, and
    // getFavoritedCandidates) — resolveEntitlements is a 4-query chain;
    // each of those used to resolve it independently, doubling that cost on
    // every first-page Discover request for the same viewer.
    const fullPhotoAccess = (await resolveEntitlements(viewerUserId))['profile.fullPhotoAccess']
    const page = await discoveryService.getDiscoveryFeed(viewerUserId, viewerProfileId, {
      ...opts,
      taste: opts.groupSlugs?.length ? opts.groupSlugs.map((slug) => `group:${slug}`) : undefined,
      fullPhotoAccess,
    })

    const alsoIntoByProfileId = await this.getAlsoIntoByProfileId(page.data)
    const candidateUnits = page.data.map((c: any, i: number) => toPersonUnit(c, i, alsoIntoByProfileId.get(c.profile.id) ?? []))
    const modules: any[] = []

    // Discover's chips are real filters, not jump anchors (unlike Lists' —
    // see getListsFeed): a handful of demographic axes (near me, age) plus
    // the CategoryGroup taxonomy reused as a *taste* axis — "people with
    // real engagement in Music", not "things tagged Music" (proposal
    // correction: people need people-shaped categorization, not the list
    // taxonomy copy-pasted with no function).
    let summaryAndChips: { summary: any; chips: any[] } | null = null
    let favorited: any[] = []
    // Distinct from the generic 'People' fallback so a chip's effect is
    // legible even when the filtered candidates happen to overlap with the
    // unfiltered top of the list (reported live as "we don't see the
    // filtering occurring" — the request did change, but nothing on
    // screen said so).
    let peopleGridTitle = 'People'

    if (isFirstPage) {
      const [groups, matchCount, favoritedResult] = await Promise.all([
        db.categoryGroup.findMany({ orderBy: { sortOrder: 'asc' } }),
        db.conversationParticipant.count({ where: { profileId: viewerProfileId } }),
        this.getFavoritedCandidates(viewerUserId, viewerProfileId, fullPhotoAccess),
      ])
      favorited = favoritedResult

      // Demographic and category filters are combinable (see
      // DiscoverFeedFilters) — the title has to say both, not just
      // whichever branch happened to be checked first, or picking a group
      // *and* an age bucket together silently dropped one of them from
      // what the screen told the viewer had changed.
      {
        const bucketLabel: Record<AgeBucket, string> = { '20s': 'in their 20s', '30s': 'in their 30s', '40s': 'in their 40s', '50plus': '50+' }
        const demographicPhrase = opts.nearMe ? 'near you' : opts.ageBucket ? bucketLabel[opts.ageBucket] : null
        const groupLabels = opts.groupSlugs?.length
          ? opts.groupSlugs.map((slug) => groups.find((g: any) => g.slug === slug)?.label).filter((l): l is string => !!l)
          : []
        const groupPhrase = groupLabels.length ? `into ${groupLabels.length > 2 ? `${groupLabels.length} topics` : groupLabels.join(' + ')}` : null
        peopleGridTitle = ['People', demographicPhrase, groupPhrase].filter(Boolean).join(' ')
      }
      summaryAndChips = {
        summary: {
          title: 'Discover people',
          stats: [
            { label: 'favorites', value: favorited.length },
            { label: 'matches', value: matchCount },
          ],
        },
        chips: [
          { id: 'top', label: 'All' },
          { id: 'near-me', label: 'Near me' },
          { id: 'age-20s', label: '20s' },
          { id: 'age-30s', label: '30s' },
          { id: 'age-40s', label: '40s' },
          { id: 'age-50plus', label: '50+' },
          ...groups.map((g: any) => ({ id: g.slug, label: g.label })),
        ],
      }

      if (favorited.length) {
        const favoritedAlsoInto = await this.getAlsoIntoByProfileId(favorited)
        modules.push({
          moduleKind: 'collection',
          id: 'your-favorites',
          type: 'favorites',
          title: 'Your favorites',
          suggestedStructure: 'rail',
          items: favorited.map((c: any, i: number) => ({
            ...toPersonUnit(c, i, favoritedAlsoInto.get(c.profile.id) ?? []),
            relationship: { favorited: true },
          })),
        })
      } else if (candidateUnits.length) {
        // Empty state: introduce the action that populates this collection
        // (liking someone) rather than leaving the slot blank (proposal correction).
        modules.push({
          moduleKind: 'collection',
          id: 'your-favorites',
          type: 'favorites',
          title: 'Like people to start your favorites',
          suggestedStructure: 'rail',
          items: candidateUnits.slice(0, 3).map((u: any, i: number) => ({ ...u, position: i })),
        })
      }

      // Site Picks (buildSitePicksModules) deliberately does NOT appear
      // here — Discover's job is people (see the summary title above), and
      // Lists already owns that exact content. Bundling it in here as a
      // shared "opening grammar" with Lists (an earlier design) buried the
      // real People grid under 12 list-card modules and made the filter
      // chips above look inert, since a chip's actual effect (a narrower
      // people-grid) stayed hidden 13 sections down — reported live as
      // "Discover shows lists instead of users" / "filtering isn't working".
    }

    if (candidateUnits.length) {
      // Density varies with depth (2 vs 3 columns) so the back half of the
      // feed doesn't read as an identical grid repeated forever — a real,
      // if modest, grammar change rather than a purely cosmetic one.
      const columns = isFirstPage || pageIndex % 2 === 0 ? 2 : 3
      modules.push({
        moduleKind: 'collection',
        id: isFirstPage ? 'people-grid' : `people-grid-${offsetKey(opts.cursor)}`,
        type: 'recommendations',
        title: isFirstPage ? peopleGridTitle : null,
        ...(isFiltered ? { context: { zone: 'results' } } : {}),
        suggestedStructure: 'grid',
        options: { columns },
        items: candidateUnits.map((u: any, i: number) => ({ ...u, position: i })),
      })
    }

    if (isFirstPage) {
      // Real results lead; Quick Picks is folded in right after them (and
      // recurs later at the same periodic cadence as every other page) —
      // never pinned ahead of the actual People grid (reported live as
      // "quick picks are always at top, results should come before").
      const topCandidate = page.data[0]
      if (topCandidate && topCandidate.matchPercentage >= 90) {
        modules.push({
          moduleKind: 'collection',
          id: 'highly-compatible',
          type: 'recommendations',
          title: 'Highly compatible',
          suggestedStructure: 'spotlight',
          items: [
            { ...toPersonUnit(topCandidate, 0, alsoIntoByProfileId.get(topCandidate.profile.id) ?? []), position: 0 },
          ],
        })
      }

      // Same shared feature as Lists, same shape container — Quick Picks
      // isn't a Lists-only widget, it's a site-wide taste-graph signal.
      modules.push({ moduleKind: 'collection', id: 'quick-picks-quiz-0', type: 'quiz', title: 'Quick Picks', suggestedStructure: 'spotlight', items: [] })
      // The InteractiveModule CTA linking out to the full-screen swipe
      // experience (QuickPicksScreen) is deliberately NOT pushed here
      // anymore — reported live as a non-standard dead-end ("useless as a
      // slideup"). QuickPicksModule/QuickPicksScreen stay in the codebase
      // shelved for a future reuse of the swipe interaction itself; the
      // inline QuickPicksSpotlight comparison card above is unaffected.
    } else if (pageIndex > 0 && pageIndex % 3 === 0) {
      // Quick Picks recurs occasionally as the feed continues — an
      // interruption within the flow (like Lists' own repeat cadence), never
      // the structure the rest of the page hangs off of.
      modules.push({
        moduleKind: 'collection',
        id: `quick-picks-quiz-${pageIndex}`,
        type: 'quiz',
        title: 'Quick Picks',
        suggestedStructure: 'spotlight',
        items: [],
      })
    }

    // Rail and River variety continue on every page, not just the first — a
    // long "infinite" feed that's only ever Grid after page one isn't the
    // rhythm we're after (proposal correction). Both draw on the taste graph
    // (ranked-#1 list picks + Quick Picks winners together), not just lists.
    if (page.data.length) {
      let similarTasteModule: any = null
      let sharedInterestModule: any = null

      const tasteEntityIds = await this.getTasteGraphEntityIds(viewerProfileId)
      if (tasteEntityIds.length) {
        const candidateProfileIds = page.data.map((c: any) => c.profile.id)
        const [sharedListPicks, sharedQuickPicks] = await Promise.all([
          db.listItem.findMany({
            where: { entityId: { in: tasteEntityIds }, rank: 1, list: { profileId: { in: candidateProfileIds } } },
            select: { entityId: true, list: { select: { profileId: true } } },
          }),
          db.quickPickSignal.findMany({
            where: { winnerId: { in: tasteEntityIds }, profileId: { in: candidateProfileIds } },
            select: { winnerId: true, profileId: true },
          }),
        ])
        const sharedRows = [
          ...sharedListPicks.map((r: any) => ({ entityId: r.entityId, profileId: r.list.profileId })),
          ...sharedQuickPicks.map((r: any) => ({ entityId: r.winnerId, profileId: r.profileId })),
        ]

        const countByEntity = new Map<string, number>()
        for (const row of sharedRows) countByEntity.set(row.entityId, (countByEntity.get(row.entityId) ?? 0) + 1)
        const headlineEntityId = [...countByEntity.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        const sharedProfileIds = new Set(sharedRows.map((r) => r.profileId))
        const similarUnits = candidateUnits.filter((_: any, idx: number) => sharedProfileIds.has(page.data[idx]?.profile.id))

        if (similarUnits.length && headlineEntityId) {
          const topEntity = await db.entity.findUnique({ where: { id: headlineEntityId }, select: ENTITY_SELECT })
          similarTasteModule = {
            moduleKind: 'collection',
            id: `similar-taste-${offsetKey(opts.cursor)}`,
            type: 'recommendations',
            title: topEntity ? `Because you ranked ${topEntity.canonicalName} #1` : 'Similar taste',
            context: topEntity ? { reason: `You ranked ${topEntity.canonicalName} #1`, sourceEntityId: headlineEntityId } : undefined,
            suggestedStructure: 'rail',
            items: similarUnits.map((u: any, i: number) => ({ ...u, position: i })),
          }
        }
      }

      const storyCandidates = page.data.filter((c: any) => (c.insights ?? []).length > 0 || (c.sharedFavorites ?? []).length > 0).slice(0, 4)
      if (storyCandidates.length) {
        sharedInterestModule = {
          moduleKind: 'collection',
          id: `shared-interest-stories-${offsetKey(opts.cursor)}`,
          type: 'comparison',
          title: 'Shared interests',
          suggestedStructure: 'river',
          items: storyCandidates.map((c: any, i: number) => ({
            ...toPersonUnit(c, i, alsoIntoByProfileId.get(c.profile.id) ?? []),
            position: i,
          })),
        }
      }

      // Order alternates by page so a long session doesn't settle into the
      // same Grid→Rail→River shape every single time (proposal correction) —
      // both are still gated on real data existing, only the order varies.
      const variety = pageIndex % 2 === 0 ? [similarTasteModule, sharedInterestModule] : [sharedInterestModule, similarTasteModule]
      for (const m of variety) if (m) modules.push(m)
    }

    return { ...(summaryAndChips ?? {}), data: modules, meta: page.meta, ...(page.filterNotice ? { filterNotice: page.filterNotice } : {}) }
  }

  /**
   * The taste graph this method traverses: entities the viewer has ranked #1
   * in a completed list, *plus* entities they've picked in Quick Picks. Lists
   * build the graph; Discover traverses people through it — a Quick Pick
   * counts exactly the same as a ranked #1 for matching purposes.
   */
  private async getTasteGraphEntityIds(viewerProfileId: string): Promise<string[]> {
    const [rankedItems, quickPickWins] = await Promise.all([
      db.listItem.findMany({ where: { rank: 1, list: { profileId: viewerProfileId, isComplete: true } }, select: { entityId: true } }),
      db.quickPickSignal.findMany({ where: { profileId: viewerProfileId }, select: { winnerId: true } }),
    ])
    return Array.from(new Set([...rankedItems.map((i: any) => i.entityId), ...quickPickWins.map((s: any) => s.winnerId)]))
  }

  /**
   * "Your favorites" — profiles the viewer has previously liked, most recent
   * first. This is personal history, not a recommendation: it mirrors
   * getListsFeed's "Your lists" Rail in the same position, using the real
   * Swipe record rather than any inferred signal.
   */
  private async getFavoritedCandidates(viewerUserId: string, viewerProfileId: string, fullPhotoAccess: boolean, limit = 10) {
    const likes = await db.swipe.findMany({
      where: { actorProfileId: viewerProfileId, action: 'LIKE' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { targetProfileId: true },
    })
    const targetIds = likes.map((l: any) => l.targetProfileId)
    if (!targetIds.length) return []

    const [profiles, scores] = await Promise.all([
      db.profile.findMany({
        where: {
          id: { in: targetIds },
          NOT: [
            { blocksMade: { some: { blockedProfileId: viewerProfileId } } },
            { blocksReceived: { some: { blockerProfileId: viewerProfileId } } },
          ],
        },
        select: { ...PROFILE_FULL_SELECT, birthdate: true },
      }),
      db.compatibilityScore.findMany({
        where: { OR: targetIds.map((id: string) => ({ OR: [{ profileIdA: viewerProfileId, profileIdB: id }, { profileIdA: id, profileIdB: viewerProfileId }] })) },
        select: { profileIdA: true, profileIdB: true, score: true, sharedItemsCount: true, sharedFavorites: true, insights: true },
      }),
    ])

    const profilesById = new Map(profiles.map((p: any) => [p.id, p]))
    const scoreByProfileId = new Map(scores.map((s: any) => [s.profileIdA === viewerProfileId ? s.profileIdB : s.profileIdA, s]))

    return targetIds.flatMap((id: string) => {
      const profile: any = profilesById.get(id)
      if (!profile) return []
      const score: any = scoreByProfileId.get(id)
      return [
        {
          profile: serializeProfile(profile, { revealPhoto: fullPhotoAccess }),
          age: computeAge(profile.birthdate),
          matchPercentage: score?.score ?? 0,
          sharedItemsCount: score?.sharedItemsCount ?? 0,
          sharedFavorites: normalizeSharedFavorites(score?.sharedFavorites),
          insights: score?.insights ?? [],
        },
      ]
    })
  }

  /**
   * "Also into" — up to 3 of each candidate's own top-ranked (rank=1) picks
   * outside their overlap with the viewer ("You both ranked" already covers
   * the overlap; this is supporting texture, not the headline — proposal
   * correction from the Discover review). Batched across the whole page,
   * not per-card, to avoid N+1.
   */
  private async getAlsoIntoByProfileId(candidates: any[]): Promise<Map<string, any[]>> {
    const candidateProfileIds = candidates.map((c) => c.profile.id)
    if (!candidateProfileIds.length) return new Map()

    const sharedNamesByProfileId = new Map<string, Set<string>>(
      candidates.map((c) => [c.profile.id, new Set((c.sharedFavorites ?? []).map((f: any) => f.entityName))]),
    )

    const topPicks = await db.listItem.findMany({
      where: { rank: 1, list: { profileId: { in: candidateProfileIds }, isComplete: true } },
      select: { entity: { select: ENTITY_SELECT }, list: { select: { profileId: true } } },
    })

    const byProfileId = new Map<string, any[]>()
    for (const row of topPicks) {
      const profileId = row.list.profileId
      const sharedNames = sharedNamesByProfileId.get(profileId) ?? new Set()
      if (sharedNames.has(row.entity.canonicalName)) continue
      const existing = byProfileId.get(profileId) ?? []
      if (existing.length < 3) existing.push(serializeEntity(row.entity))
      byProfileId.set(profileId, existing)
    }
    return byProfileId
  }

  /** "View all" pagination for a single Discover-feed collection (proposal §9). */
  async getDiscoverFeedCollection(
    viewerUserId: string,
    viewerProfileId: string,
    collectionId: string,
    opts: { cursor?: string; limit?: number },
  ) {
    if (collectionId !== 'people-grid') throw { statusCode: 404, message: 'Collection not found' }
    const page = await discoveryService.getDiscoveryFeed(viewerUserId, viewerProfileId, opts)
    const alsoIntoByProfileId = await this.getAlsoIntoByProfileId(page.data)
    return {
      data: page.data.map((c: any, i: number) => toPersonUnit(c, i, alsoIntoByProfileId.get(c.profile.id) ?? [])),
      meta: page.meta,
    }
  }
}
