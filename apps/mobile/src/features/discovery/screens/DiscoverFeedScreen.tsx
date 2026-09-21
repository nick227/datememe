import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useDiscoverFeed, type DiscoverFeedFilters } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { PageSummaryHero } from '../../../ui/content/PageSummaryHero'
import { FilterChipsRow } from '../../../ui/content/FilterChipsRow'
import { FeedModuleRenderer } from '../../../ui/content/FeedModuleRenderer'
import { FeedListFooter } from '../../../ui/content/FeedListFooter'
import { TOP_CHIP_ID, useGroupFilterChips } from '../../../ui/content/useGroupFilterChips'
import type { ContentUnit, FeedModule } from '../../../ui/content/types'
import { CANVAS_WIDTH, spacing } from '../../../theme'
import type { DiscoveryStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<DiscoveryStackParamList, 'Discover'>

type Row = { rowId: string; kind: 'chips' } | { rowId: string; kind: 'module'; module: FeedModule }

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

  const pages = feed.data?.pages ?? []
  const summary = pages[0]?.summary
  const chips = pages[0]?.chips ?? []
  const modules = useMemo<FeedModule[]>(() => pages.flatMap((p) => p.data), [pages])

  const hasPeople = modules.some((m) => m.id.startsWith('people-grid') && !!m.items?.length)
  const rows = useMemo<Row[]>(
    () => [{ rowId: 'chips', kind: 'chips' }, ...modules.map((m) => ({ rowId: m.id, kind: 'module' as const, module: m }))],
    [modules],
  )

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

  if (feed.isLoading) {
    return (
      <ScreenContainer testID="screen.discover" padded={false} width="full">
        <ScrollView testID="discover.loading" contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Skeleton variant="text" width={260} height={28} style={{ marginBottom: spacing.sm }} />
          <Skeleton variant="text" width={200} height={16} style={{ marginBottom: spacing.xl }} />
          <Skeleton variant="rect" width="100%" height={220} />
        </ScrollView>
      </ScreenContainer>
    )
  }

  if (feed.isError && !feed.data) {
    return (
      <ScreenContainer testID="screen.discover" width="full">
        <ErrorState testID="discover.error" subtitle="Couldn't load your feed." onRetry={() => feed.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.discover" padded={false} width="full">
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.rowId}
        renderItem={({ item }) =>
          item.kind === 'chips' ? (
            chips.length > 1 ? <FilterChipsRow chips={chips} selectedIds={displaySelectedChipIds} onSelect={onSelectChip} /> : null
          ) : (
            <FeedModuleRenderer
              module={item.module}
              state="ready"
              onPressItem={onPressItem}
              onPressQuickPicks={onPressQuickPicks}
              quickPicksPeopleMode
            />
          )
        }
        ListHeaderComponent={summary ? <PageSummaryHero summary={summary} /> : null}
        ListEmptyComponent={
          <EmptyState testID="discover.empty"
            title="No one new to show"
            subtitle={displaySelectedChipIds[0] === TOP_CHIP_ID ? 'Check back soon, or once more members join.' : 'Try a different filter, or check back once more members join.'}
          />
        }
        ListFooterComponent={
          <View>
          {!hasPeople && !feed.hasNextPage ? <EmptyState testID="discover.empty" title="No one new to show" subtitle={pages[0]?.filterNotice ?? (displaySelectedChipIds[0] === TOP_CHIP_ID ? 'Check back soon, or once more members join.' : 'Try a different filter, or check back once more members join.')} /> : null}
          <FeedListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            isFetchNextPageError={feed.isFetchNextPageError}
            hasNextPage={!!feed.hasNextPage}
            hasContent={hasPeople}
            onRetry={() => feed.fetchNextPage()}
            endMessage="You've seen everyone new for now — check back soon."
          />
          </View>
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetching && !feed.isFetchNextPageError) feed.fetchNextPage()
        }}
        // Full-bleed scroll box, canvas-width centered content — see
        // CategoriesScreen. Chips are not sticky; they scroll with the page.
        contentContainerStyle={{ width: '100%', maxWidth: CANVAS_WIDTH, alignSelf: 'center', paddingBottom: spacing.section }}
      />
    </ScreenContainer>
  )
}
