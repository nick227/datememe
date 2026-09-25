import { useEffect, useMemo, useRef } from 'react'
import { FlatList, ScrollView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useListsFeed } from '@project/sdk'
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
import type { CategoriesStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<CategoriesStackParamList, 'Categories'>

type Row =
  | { rowId: string; kind: 'chips' }
  | { rowId: string; kind: 'empty' }
  | { rowId: string; kind: 'boundary' }
  | { rowId: string; kind: 'module'; module: FeedModule }

// The Lists page as a PageSummary + FeedModule stream, grouped by topic — see
// docs/shared-content-system-proposal.md §8. Chips are a real, multi-select,
// server-side filter (useGroupFilterChips + ListsFeedFilters.groupSlugs) —
// the exact same filtering logic and layout rule as Discover: unfiltered
// leads with "Your lists" -> Site Picks -> every topic; filtered leads with
// "Your lists" -> only the selected group(s)' content, Quick Picks folded in
// after. Selecting a chip re-fetches (query key changes), it doesn't reorder
// or scroll an already-loaded list.
export function CategoriesScreen({ navigation }: Props) {
  const { selectedGroupSlugs, toggleGroup } = useGroupFilterChips()
  const feed = useListsFeed({ groupSlugs: selectedGroupSlugs })
  const listRef = useRef<FlatList<Row>>(null)

  const pages = useMemo(() => feed.data?.pages ?? [], [feed.data?.pages])
  const summary = pages[0]?.summary
  const chips = pages[0]?.chips ?? []
  const modules = useMemo<FeedModule[]>(() => pages.flatMap((p) => p.data), [pages])
  const selectedChipIds = selectedGroupSlugs.length ? selectedGroupSlugs : [TOP_CHIP_ID]
  const selectedChipKey = selectedChipIds.join(',')

  // A filter change is a real new query (kept flash-free by useListsFeed's
  // placeholderData) — reset scroll position rather than remounting the
  // FlatList, which was itself a second source of the reported UI flash.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [selectedChipKey])

  // "Your lists" leads ahead of the category chips (Header -> Your ->
  // Categories -> Results -> Explore). Results only exists while a filter is
  // active — the server tags exactly one module `context.zone:'results'` in
  // that case (getListsFeed's new flat, always-grid Results module); every
  // other module is Explore, the same ambient browse rhythm whether or not a
  // filter is applied. Unfiltered, there's no Results/boundary at all — chips
  // lead straight into Explore, same as before this pass.
  const { rows, hasContent } = useMemo(() => {
    const isFiltered = selectedGroupSlugs.length > 0
    const yourModule = modules.find((m) => m.id === 'your-lists')
    const rest = modules.filter((m) => m.id !== 'your-lists')
    const resultsModules = isFiltered ? rest.filter((m) => m.context?.zone === 'results') : []
    const exploreModules = isFiltered ? rest.filter((m) => m.context?.zone !== 'results') : rest
    const hasResults = resultsModules.some((m) => !!m.items?.length)
    // Results isn't paginated (getListsFeed resolves it fully on page 1), so
    // "empty" is definitive as soon as data has loaded — no hasNextPage guard needed.
    const showNoResults = isFiltered && !hasResults
    const _hasContent = hasResults || exploreModules.some((m) => !!m.items?.length)
    
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
    return { rows: list, hasContent: _hasContent }
  }, [modules, selectedGroupSlugs.length])

  function goToListBuilder(categorySlug: string, shortLabel: string) {
    navigation.navigate('ListBuilder', { categorySlug, shortLabel })
  }

  function onPressItem(unit: ContentUnit) {
    goToListBuilder(unit.id, unit.title)
  }

  function onPressQuickPicks() {
    // No interactive module ships in the Lists feed today — present for type-safety only.
  }

  if (feed.isLoading) {
    return (
      <ScreenContainer testID="screen.categories" padded={false} width="wide">
        <ScrollView testID="categories.loading" contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Skeleton variant="text" width={220} height={28} style={{ marginBottom: spacing.sm }} />
          <Skeleton variant="text" width={280} height={16} style={{ marginBottom: spacing.xl }} />
          <Skeleton variant="rect" width="100%" height={200} />
        </ScrollView>
      </ScreenContainer>
    )
  }

  if (feed.isError && !feed.data) {
    return (
      <ScreenContainer testID="screen.categories" width="wide">
        <ErrorState testID="categories.error" subtitle="Couldn't load your lists." onRetry={() => feed.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.categories" padded={false} width="full">
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.rowId}
        renderItem={({ item }) => {
          if (item.kind === 'chips') {
            return chips.length > 1 ? <FilterChipsRow chips={chips} selectedIds={selectedChipIds} onSelect={toggleGroup} /> : null
          }
          if (item.kind === 'empty') {
            return <EmptyState testID="categories.empty" title="No lists match this filter" subtitle="Try a different filter, or check back as new ones ship." />
          }
          if (item.kind === 'boundary') {
            return <ExploreBoundary />
          }
          return <FeedModuleRenderer module={item.module} state="ready" onPressItem={onPressItem} onPressQuickPicks={onPressQuickPicks} />
        }}
        ListHeaderComponent={summary ? <PageHeader title={summary.title} facts={summary.stats?.map(s => ({ value: s.value, label: s.label }))} /> : null}
        ListEmptyComponent={<EmptyState testID="categories.empty" title="No lists yet" subtitle="Check back soon — new ones ship often." />}
        ListFooterComponent={
          <FeedListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            isFetchNextPageError={feed.isFetchNextPageError}
            hasNextPage={!!feed.hasNextPage}
            hasContent={hasContent}
            onRetry={() => feed.fetchNextPage()}
            endMessage=""
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetching && !feed.isFetchNextPageError) feed.fetchNextPage()
        }}
        // The FlatList itself stays full-bleed (its own width, so its native
        // scrollbar renders at the true browser edge, not inset in a centered
        // column) — the canvas width/centering is applied to its content
        // instead. Chips are no longer sticky; they scroll away with the page.
        contentContainerStyle={{ width: '100%', maxWidth: CANVAS_WIDTH, alignSelf: 'center', paddingBottom: spacing.section }}
      />
    </ScreenContainer>
  )
}
