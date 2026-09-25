import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useDiscoverFeed, type DiscoverFeedFilters } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { PageHeader } from '../../../ui/content/PageHeader'
import { FilterChipsRow } from '../../../ui/content/FilterChipsRow'
import { FeedModuleRenderer } from '../../../ui/content/FeedModuleRenderer'
import { FeedListFooter } from '../../../ui/content/FeedListFooter'
import { ExploreBoundary } from '../../../ui/content/ExploreBoundary'
import { TOP_CHIP_ID, useGroupFilterChips } from '../../../ui/content/useGroupFilterChips'
import type { ContentUnit, FeedModule } from '../../../ui/content/types'
import { CANVAS_WIDTH, spacing } from '../../../theme'
import type { DiscoveryStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<DiscoveryStackParamList, 'Discover'>

type Row =
  | { rowId: string; kind: 'chips' }
  | { rowId: string; kind: 'empty' }
  | { rowId: string; kind: 'boundary' }
  | { rowId: string; kind: 'module'; module: FeedModule }

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Row>)

// Discover as a People Grid baseline with contextual Rail/Spotlight/River
// interruptions and an embedded Quick Picks module — see
// docs/shared-content-system-proposal.md §8. Same page shell as
// CategoriesScreen (PageSummaryHero, full-bleed FlatList, useGroupFilterChips
// for the taxonomy chips — the same real, multi-select, server-side filter
// and layout rule as Lists). Near me/age are a separate single-select
// demographic layer on top (Lists has no equivalent) — combinable with the
// multi-select group chips, mutually exclusive with each other.
export function DiscoverFeedScreen({ navigation }: Props) {
  const { selectedGroupSlugs, toggleGroup } = useGroupFilterChips()
  const [demographicChipId, setDemographicChipId] = useState<string | null>(null)

  function onSelectChip(chipId: string) {
    if (chipId === TOP_CHIP_ID) {
      toggleGroup(TOP_CHIP_ID)
      setDemographicChipId(null)
      return
    }
    if (chipId === 'near-me' || chipId.startsWith('age-')) {
      setDemographicChipId((prev) => (prev === chipId ? null : chipId))
      return
    }
    toggleGroup(chipId)
  }

  const filters: DiscoverFeedFilters = {
    groupSlugs: selectedGroupSlugs,
    nearMe: demographicChipId === 'near-me' ? true : undefined,
    ageBucket: demographicChipId?.startsWith('age-') ? (demographicChipId.slice(4) as DiscoverFeedFilters['ageBucket']) : undefined,
  }
  const feed = useDiscoverFeed(filters)
  const listRef = useRef<FlatList<Row>>(null)
  const selectedChipIds = [...selectedGroupSlugs, ...(demographicChipId ? [demographicChipId] : [])]
  const displaySelectedChipIds = selectedChipIds.length ? selectedChipIds : [TOP_CHIP_ID]
  const selectedChipKey = displaySelectedChipIds.join(',')

  // A filter change is a real new query (kept flash-free by useDiscoverFeed's
  // placeholderData) — reset scroll position rather than remounting the
  // FlatList, which was itself a second source of the reported UI flash.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [selectedChipKey])

  const pages = useMemo(() => feed.data?.pages ?? [], [feed.data?.pages])
  const summary = pages[0]?.summary
  const chips = pages[0]?.chips ?? []
  const modules = useMemo<FeedModule[]>(() => pages.flatMap((p) => p.data), [pages])

  const isFiltered = selectedGroupSlugs.length > 0 || !!demographicChipId

  const hasPeople = modules.some((m) => m.id.startsWith('people-grid') && !!m.items?.length)

  const rows = useMemo<Row[]>(() => {
    const showNoResults = !hasPeople && !feed.hasNextPage
    
    // "Your favorites" leads ahead of the category chips (Header -> Your ->
    // Categories -> Results -> Explore). Results only exists while a filter is
    // active — the server tags the filtered people-grid module(s)
    // `context.zone:'results'` in that case; everything else (Highly
    // Compatible, Quick Picks, Similar Taste, Shared Interests) is Explore,
    // the same ambient rhythm whether or not a filter is applied. Unfiltered,
    // there's no Results/boundary at all — chips lead straight into Explore.
    const yourModule = modules.find((m) => m.id === 'your-favorites')
    const rest = modules.filter((m) => m.id !== 'your-favorites')
    const resultsModules = isFiltered ? rest.filter((m) => m.context?.zone === 'results') : []
    const exploreModules = isFiltered ? rest.filter((m) => m.context?.zone !== 'results') : rest

    const list: Row[] = []
    if (yourModule) list.push({ rowId: yourModule.id, kind: 'module', module: yourModule })
    list.push({ rowId: 'chips', kind: 'chips' })
    if (isFiltered) {
      // Results sits directly under the chips — an obvious, stable answer
      // to the click — followed by a boundary into the always-present
      // Explore feed below, even when Results itself came back empty.
      list.push(...resultsModules.map((m) => ({ rowId: m.id, kind: 'module' as const, module: m })))
      if (showNoResults) list.push({ rowId: 'no-results', kind: 'empty' })
      list.push({ rowId: 'explore-boundary', kind: 'boundary' })
    }
    list.push(...exploreModules.map((m) => ({ rowId: m.id, kind: 'module' as const, module: m })))
    return list
  }, [modules, isFiltered, feed.hasNextPage])

  function onPressItem(unit: ContentUnit) {
    // Site Picks cards are lists presented inside Discover, not people
    // recommendations — same kind: 'category' unit Lists renders, so
    // selecting one goes to the same List Builder / ranking flow as
    // picking it from the Lists tab (cross-tab, same pattern as
    // ConversationScreen/ProfileDetailScreen's navigation.getParent() calls).
    if (unit.kind === 'category') {
      ;(navigation.getParent()?.navigate as any)('Lists', {
        screen: 'ListBuilder',
        params: { categorySlug: unit.id, shortLabel: unit.title },
      })
      return
    }
    if (unit.kind !== 'person' || !unit.profile) return
    const overlap = unit.metrics?.find((m) => m.type === 'overlap')
    const matchPercentage = overlap ? parseInt(String(overlap.value), 10) : undefined
    navigation.navigate('ProfileDetail', {
      profileId: unit.profile.id,
      displayName: unit.profile.displayName,
      age: unit.age ?? undefined,
      matchPercentage: Number.isNaN(matchPercentage) ? undefined : matchPercentage,
      insights: unit.insights,
    })
  }

  function onPressQuickPicks() {
    navigation.navigate('QuickPicks')
  }

  return (
    <ScreenContainer testID="screen.discover" padded={false} width="full">
      {feed.isLoading ? (
        <Animated.ScrollView testID="discover.loading" exiting={FadeOut.duration(200)} contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg, width: '100%', maxWidth: CANVAS_WIDTH, alignSelf: 'center' }}>
          <Skeleton variant="text" width={260} height={28} style={{ marginBottom: spacing.sm }} />
          <Skeleton variant="text" width={200} height={16} style={{ marginBottom: spacing.xl }} />
          <Skeleton variant="rect" width="100%" height={220} />
        </Animated.ScrollView>
      ) : feed.isError && !feed.data ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
          <ErrorState testID="discover.error" subtitle="Couldn't load your feed." onRetry={() => feed.refetch()} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
          <AnimatedFlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.rowId}
        renderItem={({ item }) => {
          if (item.kind === 'chips') {
            return chips.length > 1 ? <FilterChipsRow chips={chips} selectedIds={displaySelectedChipIds} onSelect={onSelectChip} /> : null
          }
          if (item.kind === 'empty') {
            return (
              <EmptyState
                testID="discover.empty"
                title="No results"
                subtitle={pages[0]?.filterNotice ?? (displaySelectedChipIds[0] === TOP_CHIP_ID ? 'Check back soon.' : 'Try different filters.')}
              />
            )
          }
          if (item.kind === 'boundary') {
            return <ExploreBoundary />
          }
          return (
            <FeedModuleRenderer
              module={item.module}
              state="ready"
              onPressItem={onPressItem}
              onPressQuickPicks={onPressQuickPicks}
              quickPicksPeopleMode
            />
          )
        }}
        ListHeaderComponent={summary ? <PageHeader title={summary.title} facts={summary.stats?.map(s => ({ value: s.value, label: s.label }))} /> : null}
        ListFooterComponent={
          <FeedListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            isFetchNextPageError={feed.isFetchNextPageError}
            hasNextPage={!!feed.hasNextPage}
            hasContent={hasPeople}
            onRetry={() => feed.fetchNextPage()}
            endMessage=""
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetching && !feed.isFetchNextPageError) feed.fetchNextPage()
        }}
        // Full-bleed scroll box, canvas-width centered content — see
        // CategoriesScreen. Chips are not sticky; they scroll with the page.
        contentContainerStyle={{ width: '100%', maxWidth: CANVAS_WIDTH, alignSelf: 'center', paddingBottom: spacing.section }}
      />
        </Animated.View>
      )}
    </ScreenContainer>
  )
}
