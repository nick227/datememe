import { useMemo, useState } from 'react'
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
import type { ContentUnit, FeedModule } from '../../../ui/content/types'
import { CANVAS_WIDTH, spacing } from '../../../theme'
import type { DiscoveryStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<DiscoveryStackParamList, 'Discover'>

const TOP_CHIP_ID = 'top'

type Row = { rowId: string; kind: 'chips' } | { rowId: string; kind: 'module'; module: FeedModule }

// A chip here is a real filter (near me / age / a taste-group), not a jump
// anchor like Lists' — Discover's categorization is about *who's in the
// pool*, not which already-loaded section to scroll to (proposal correction).
function chipIdToFilters(chipId: string): DiscoverFeedFilters {
  if (chipId === TOP_CHIP_ID) return {}
  if (chipId === 'near-me') return { nearMe: true }
  if (chipId.startsWith('age-')) return { ageBucket: chipId.slice(4) as DiscoverFeedFilters['ageBucket'] }
  return { groupSlug: chipId }
}

// Discover as a People Grid baseline with contextual Rail/Spotlight/River
// interruptions and an embedded Quick Picks module — see
// docs/shared-content-system-proposal.md §8. Same page shell as
// CategoriesScreen (PageSummaryHero, full-bleed FlatList) so the two pages
// read as siblings — but the chip bar's own *behavior* differs on purpose.
export function DiscoverFeedScreen({ navigation }: Props) {
  const [activeChipId, setActiveChipId] = useState(TOP_CHIP_ID)
  const feed = useDiscoverFeed(chipIdToFilters(activeChipId))

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
    if (unit.kind !== 'person' || !unit.profile) return
    const overlap = unit.metrics?.find((m) => m.type === 'overlap')
    const matchPercentage = overlap ? parseInt(String(overlap.value), 10) : undefined
    navigation.navigate('ProfileDetail', {
      profileId: unit.profile.id,
      displayName: unit.profile.displayName,
      matchPercentage: Number.isNaN(matchPercentage) ? undefined : matchPercentage,
      insights: unit.insights,
    })
  }

  function onPressQuickPicks() {
    navigation.navigate('QuickPicks')
  }

  if (feed.isLoading) {
    return (
      <ScreenContainer padded={false} width="full">
        <ScrollView contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Skeleton variant="text" width={260} height={28} style={{ marginBottom: spacing.sm }} />
          <Skeleton variant="text" width={200} height={16} style={{ marginBottom: spacing.xl }} />
          <Skeleton variant="rect" width="100%" height={220} />
        </ScrollView>
      </ScreenContainer>
    )
  }

  if (feed.isError && !feed.data) {
    return (
      <ScreenContainer width="full">
        <ErrorState subtitle="Couldn't load your feed." onRetry={() => feed.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer padded={false} width="full">
      <FlatList
        key={activeChipId}
        data={rows}
        keyExtractor={(row) => row.rowId}
        renderItem={({ item }) =>
          item.kind === 'chips' ? (
            chips.length > 1 ? <FilterChipsRow chips={chips} selectedId={activeChipId} onSelect={setActiveChipId} /> : null
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
          <EmptyState
            title="No one new to show"
            subtitle={activeChipId === TOP_CHIP_ID ? 'Check back soon, or once more members join.' : 'Try a different filter, or check back once more members join.'}
          />
        }
        ListFooterComponent={
          <View>
          {!hasPeople && !feed.hasNextPage ? <EmptyState title="No one new to show" subtitle={pages[0]?.filterNotice ?? (activeChipId === TOP_CHIP_ID ? 'Check back soon, or once more members join.' : 'Try a different filter, or check back once more members join.')} /> : null}
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
