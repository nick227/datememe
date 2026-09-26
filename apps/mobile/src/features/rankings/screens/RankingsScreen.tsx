import { useEffect, useMemo, useRef } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useRankingsFeed } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { Icon } from '../../../ui/Icon'
import { Typography } from '../../../ui/Typography'
import { PageHeader } from '../../../ui/content/PageHeader'
import { FeedModuleRenderer } from '../../../ui/content/FeedModuleRenderer'
import { Rail } from '../../../ui/content/Rail'
import { FilterChipsRow } from '../../../ui/content/FilterChipsRow'
import { TOP_CHIP_ID, useGroupFilterChips } from '../../../ui/content/useGroupFilterChips'
import type { ContentUnit, FeedModule } from '../../../ui/content/types'
import { CANVAS_WIDTH, colors, spacing } from '../../../theme'
import type { RankingsStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<RankingsStackParamList, 'Rankings'>

// GET /rankings/feed's contract: a module id with this prefix is one
// category's top-N preview, and the rest of the id is that category's slug.
const CATEGORY_MODULE_PREFIX = 'rankings-top-'

type Row = { rowId: string; kind: 'chips' } | { rowId: string; kind: 'module'; module: FeedModule }

/**
 * "What did everybody pick?" — the curiosity-oriented counterpart to Lists
 * (action-oriented: pick something to rank). Leans on rows: the server sends
 * mostly one-category ranking blocks, with an occasional rail between them.
 * Same multi-select group chips as Lists/Discover, filtered server-side.
 */
export function RankingsScreen({ navigation }: Props) {
  const { selectedGroupSlugs, toggleGroup } = useGroupFilterChips()
  const feed = useRankingsFeed({ groupSlugs: selectedGroupSlugs })
  const listRef = useRef<FlatList<Row>>(null)
  const chips = feed.data?.chips ?? []
  const selectedChipIds = selectedGroupSlugs.length ? selectedGroupSlugs : [TOP_CHIP_ID]
  const selectedChipKey = selectedChipIds.join(',')

  const rows = useMemo<Row[]>(
    () => [{ rowId: 'chips', kind: 'chips' }, ...(feed.data?.data ?? []).map((m) => ({ rowId: m.id, kind: 'module' as const, module: m }))],
    [feed.data],
  )

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [selectedChipKey])

  function openCategory(categorySlug: string, shortLabel: string) {
    navigation.navigate('CategoryRanking', { categorySlug, shortLabel })
  }

  function onPressItem(module: FeedModule, unit: ContentUnit) {
    if (module.id.startsWith(CATEGORY_MODULE_PREFIX)) {
      openCategory(module.id.slice(CATEGORY_MODULE_PREFIX.length), module.title ?? '')
      return
    }
    // Category units carry the slug as their id (toCategoryUnit).
    if (unit.kind === 'category') openCategory(unit.id, unit.title)
  }

  if (feed.isLoading) {
    return (
      <ScreenContainer testID="screen.rankings" padded={false} width="wide">
        <ScrollView testID="rankings.loading" contentContainerStyle={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Skeleton variant="text" width={220} height={28} style={{ marginBottom: spacing.sm }} />
          <Skeleton variant="text" width={280} height={16} style={{ marginBottom: spacing.xl }} />
          <Skeleton variant="rect" width="100%" height={200} />
        </ScrollView>
      </ScreenContainer>
    )
  }

  if (feed.isError && !feed.data) {
    return (
      <ScreenContainer testID="screen.rankings" width="wide">
        <ErrorState testID="rankings.error" subtitle="Couldn't load rankings." onRetry={() => feed.refetch()} />
      </ScreenContainer>
    )
  }

  const summary = feed.data?.summary

  return (
    <ScreenContainer testID="screen.rankings" padded={false} width="full">
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.rowId}
        renderItem={({ item: row }) => {
          if (row.kind === 'chips') {
            return chips.length > 1 ? <FilterChipsRow chips={chips} selectedIds={selectedChipIds} onSelect={toggleGroup} /> : null
          }
          const module = row.module
          return (
          <View>
            {module.suggestedStructure === 'rail' ? (
              // The compact poster card (the results-zone category card):
              // title, "N answered", "#1 X" — not the Lists-tab stat card,
              // whose "Rank yours" CTA is the wrong action here.
              <Rail
                testID={`feed.module.${module.id}`}
                title={module.title}
                items={module.items ?? []}
                state="ready"
                zone="results"
                cardWidth={180}
                onPressItem={(unit) => onPressItem(module, unit)}
              />
            ) : (
              <FeedModuleRenderer module={module} state="ready" onPressItem={(unit) => onPressItem(module, unit)} onPressQuickPicks={() => {}} />
            )}
            {module.id.startsWith(CATEGORY_MODULE_PREFIX) ? (
              <Pressable
                testID={`rankings.view-full.${module.id}`}
                style={styles.viewFull}
                onPress={() => openCategory(module.id.slice(CATEGORY_MODULE_PREFIX.length), module.title ?? '')}
              >
                <Typography variant="label" style={styles.viewFullText}>
                  View full ranking{module.context?.reason ? ` · ${module.context.reason}` : ''}
                </Typography>
                <Icon name="ChevronRight" size={16} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>
          )
        }}
        ListHeaderComponent={summary ? <PageHeader title={summary.title} facts={summary.stats?.map((s) => ({ value: s.value, label: s.label }))} /> : null}
        ListFooterComponent={
          rows.length === 1 ? (
            <EmptyState
              testID="rankings.empty"
              title={selectedGroupSlugs.length ? 'No rankings in this topic yet' : 'No rankings yet'}
              subtitle="A ranking appears once enough people have answered a list."
            />
          ) : null
        }
        refreshing={feed.isRefetching}
        onRefresh={() => feed.refetch()}
        contentContainerStyle={{ width: '100%', maxWidth: CANVAS_WIDTH, alignSelf: 'center', paddingBottom: spacing.section }}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  viewFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
  },
  viewFullText: { color: colors.ink },
})
