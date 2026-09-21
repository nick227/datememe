import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useListsFeed } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { PageSummaryHero } from '../../../ui/content/PageSummaryHero'
import { FilterChipsRow } from '../../../ui/content/FilterChipsRow'
import { FeedModuleRenderer } from '../../../ui/content/FeedModuleRenderer'
import { FeedListFooter } from '../../../ui/content/FeedListFooter'
import { isCollection, type ContentUnit, type FeedModule } from '../../../ui/content/types'
import { CANVAS_WIDTH, spacing } from '../../../theme'
import type { CategoriesStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<CategoriesStackParamList, 'Categories'>

const TOP_CHIP_ID = 'top'

type Row = { rowId: string; kind: 'chips' } | { rowId: string; kind: 'module'; module: FeedModule }

// The Lists page as a PageSummary + FeedModule stream, grouped by topic — see
// docs/shared-content-system-proposal.md §8. Chips are jump anchors into the
// topic sections below, not filters — the whole grouped feed always loads.
export function CategoriesScreen({ navigation }: Props) {
  const feed = useListsFeed()
  const listRef = useRef<FlatList<Row>>(null)
  const [activeChipId, setActiveChipId] = useState(TOP_CHIP_ID)

  const [pendingChipId, setPendingChipId] = useState<string | null>(null)
  const chipsRef = useRef<Array<{ id: string }>>([])
  const pages = feed.data?.pages ?? []
  const summary = pages[0]?.summary
  const chips = pages[0]?.chips ?? []
  chipsRef.current = chips
  const modules = useMemo<FeedModule[]>(() => pages.flatMap((p) => p.data), [pages])

  const rows = useMemo<Row[]>(
    () => [{ rowId: 'chips', kind: 'chips' }, ...modules.map((m) => ({ rowId: m.id, kind: 'module' as const, module: m }))],
    [modules],
  )

  function goToListBuilder(categorySlug: string, shortLabel: string) {
    navigation.navigate('ListBuilder', { categorySlug, shortLabel })
  }

  function onPressItem(unit: ContentUnit) {
    goToListBuilder(unit.id, unit.title)
  }

  function onPressQuickPicks() {
    // No interactive module ships in the Lists feed today — present for type-safety only.
  }

  function onSelectChip(chipId: string) {
    setActiveChipId(chipId)
    setPendingChipId(chipId === TOP_CHIP_ID ? null : chipId)
    if (chipId === TOP_CHIP_ID) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      return
    }
  }

  useEffect(() => {
    if (!pendingChipId) return
    const index = rows.findIndex((r) => r.kind === 'module' && r.module.id === pendingChipId)
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 })
      setPendingChipId(null)
    } else if (feed.hasNextPage && !feed.isFetching && !feed.isFetchNextPageError) {
      void feed.fetchNextPage()
    } else if (!feed.hasNextPage) {
      setPendingChipId(null)
    }
  }, [pendingChipId, rows, feed.hasNextPage, feed.isFetching, feed.isFetchNextPageError, feed.fetchNextPage])

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    const visibleGroupRow = viewableItems.find(
      (v) => v.item?.kind === 'module' && isCollection(v.item.module) && chipsRef.current.some((c) => c.id === v.item.module.id),
    )
    if (visibleGroupRow) setActiveChipId(visibleGroupRow.item.module.id)
  }).current

  if (feed.isLoading) {
    return (
      <ScreenContainer padded={false} width="wide">
        <ScrollView contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Skeleton variant="text" width={220} height={28} style={{ marginBottom: spacing.sm }} />
          <Skeleton variant="text" width={280} height={16} style={{ marginBottom: spacing.xl }} />
          <Skeleton variant="rect" width="100%" height={200} />
        </ScrollView>
      </ScreenContainer>
    )
  }

  if (feed.isError && !feed.data) {
    return (
      <ScreenContainer width="wide">
        <ErrorState subtitle="Couldn't load your lists." onRetry={() => feed.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer padded={false} width="full">
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.rowId}
        renderItem={({ item }) =>
          item.kind === 'chips' ? (
            chips.length > 1 ? <FilterChipsRow chips={chips} selectedId={activeChipId} onSelect={onSelectChip} /> : null
          ) : (
            <FeedModuleRenderer module={item.module} state="ready" onPressItem={onPressItem} onPressQuickPicks={onPressQuickPicks} />
          )
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 20 }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false })
          const row = rows[index]
          if (row?.kind === 'module') setTimeout(() => setPendingChipId(row.module.id), 150)
        }}
        ListHeaderComponent={summary ? <PageSummaryHero summary={summary} /> : null}
        ListEmptyComponent={<EmptyState title="No lists yet" subtitle="Check back soon — new ones ship often." />}
        ListFooterComponent={
          <FeedListFooter
            isFetchingNextPage={feed.isFetchingNextPage}
            isFetchNextPageError={feed.isFetchNextPageError}
            hasNextPage={!!feed.hasNextPage}
            hasContent={modules.length > 0}
            onRetry={() => feed.fetchNextPage()}
            endMessage="You've explored every list — check back as new ones ship."
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
