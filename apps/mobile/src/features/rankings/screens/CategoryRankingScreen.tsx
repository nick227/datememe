import { FlatList, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategoryRankings } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { Button } from '../../../ui/Button'
import { Typography } from '../../../ui/Typography'
import { ResultUnitCard } from '../../../ui/content/ResultUnitCard'
import type { ResultUnit } from '../../../ui/content/types'
import { borderWidth, colors, spacing } from '../../../theme'
import type { RankingsStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<RankingsStackParamList, 'CategoryRanking'>

// Same arrow convention ResultUnitCard renders ("+2" / "-1" / "new").
function trendFor(rank: number, previousRank: number | null) {
  if (previousRank == null) return 'new'
  if (previousRank > rank) return `+${previousRank - rank}`
  if (previousRank < rank) return `${previousRank - rank}`
  return undefined
}

export function CategoryRankingScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const rankings = useCategoryRankings(categorySlug)
  const data = rankings.data

  // Cross-tab into the Lists stack, same pattern as DiscoverFeedScreen's
  // category units; `initial: false` keeps Lists' root under it for back.
  function openListBuilder() {
    ;(navigation.getParent()?.navigate as any)('Lists', {
      screen: 'ListBuilder',
      params: { categorySlug, shortLabel: data?.category.shortLabel ?? shortLabel },
      initial: false,
    })
  }

  const viewerTop = data?.entries.find((e) => e.viewerRank === 1)
  const viewerTopName = viewerTop?.entity.canonicalName

  const units: ResultUnit[] = (data?.entries ?? []).map((entry, i) => ({
    id: entry.entity.id,
    kind: 'result',
    resultType: 'entity',
    title: entry.entity.canonicalName,
    subtitle: [`${entry.pickPercent}% picked it`, entry.viewerRank != null ? `You: #${entry.viewerRank}` : null].filter(Boolean).join(' · '),
    imageUrl: entry.entity.imageUrl,
    rank: entry.rank,
    trend: trendFor(entry.rank, entry.previousRank),
    position: i,
    metrics: [],
  }))

  const header = (
    <View style={styles.header}>
      {data ? (
        <>
          <Typography variant="bodyMuted">{data.category.prompt}</Typography>
          {data.isPublished ? (
            <Typography variant="label" style={styles.stats}>
              {data.takeCount} users ranked this
            </Typography>
          ) : null}
          <View style={styles.viewerBox}>
            {data.viewerHasTaken ? (
              <>
                {viewerTop ? (
                  <Typography variant="body">
                    Your #1: <Typography variant="body" style={styles.bold}>{viewerTop.entity.canonicalName}</Typography>
                  </Typography>
                ) : null}
                {data.viewerTopPickPercent != null && viewerTopName ? (
                  <Typography variant="heading">
                    {data.viewerTopPickPercent > 0
                      ? `${data.viewerTopPickPercent}% of people put ${viewerTopName} at #1`
                      : `Nobody else has ${viewerTopName} at #1 yet`}
                  </Typography>
                ) : null}
                <Button testID="category-ranking.edit" label="Edit your answers" variant="secondary" onPress={openListBuilder} />
              </>
            ) : (
              <>
                <Typography variant="heading">You haven&apos;t taken this yet</Typography>
                <Button testID="category-ranking.take" label="Take this list" onPress={openListBuilder} />
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
  )

  return (
    <ScreenContainer testID="screen.category-ranking" width="narrow">
      <TopNavigation
        testID="category-ranking.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={data?.category.shortLabel ?? shortLabel}
      />
      {rankings.isLoading ? (
        <View testID="category-ranking.loading" style={{ gap: spacing.md }}>
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="rect" width="100%" height={120} />
          <Skeleton variant="rect" width="100%" height={240} />
        </View>
      ) : rankings.isError && !data ? (
        <ErrorState testID="category-ranking.error" subtitle="Couldn't load this ranking." onRetry={() => rankings.refetch()} />
      ) : (
        <FlatList
          data={units}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <ResultUnitCard unit={item} onPress={() => {}} />}
          ListHeaderComponent={header}
          // Unpublished = below the worker's minimum-answers threshold: no
          // site ranking yet, so no single person's list is exposed as one.
          ListEmptyComponent={<EmptyState testID="category-ranking.empty" title="Not enough answers yet" subtitle="The site ranking appears once a few more people answer this list." />}
          contentContainerStyle={{ paddingBottom: spacing.section }}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  stats: { marginTop: spacing.xs },
  viewerBox: {
    marginTop: spacing.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
  },
  bold: { fontFamily: 'PlusJakartaSans_700Bold' },
})
