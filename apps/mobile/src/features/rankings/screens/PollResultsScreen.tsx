import { FlatList, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategoryRankings } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { Button } from '../../../ui/Button'
import { Typography } from '../../../ui/Typography'
import { ResultUnitCard } from '../../../ui/content/ResultUnitCard'
import type { ResultUnit } from '../../../ui/content/types'
import { PollHeader } from '../../lists/components/PollHeader'
import { openPoll } from '../../../navigation/openPoll'
import { borderWidth, colors, spacing } from '../../../theme'
import type { MainStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<MainStackParamList, 'PollResults'>

function trendFor(rank: number, previousRank: number | null) {
  if (previousRank == null) return 'new'
  if (previousRank > rank) return `+${previousRank - rank}`
  if (previousRank < rank) return `${previousRank - rank}`
  return undefined
}

export function PollResultsScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const rankings = useCategoryRankings(categorySlug)
  const data = rankings.data
  const title = data?.category.shortLabel ?? shortLabel

  function openEditor() {
    openPoll(navigation, 'edit', { categorySlug, shortLabel: title })
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
                <Button testID="poll-results.edit" label="Edit your answers" variant="secondary" onPress={openEditor} />
              </>
            ) : (
              <>
                <Typography variant="heading">You haven&apos;t taken this yet</Typography>
                <Button testID="poll-results.take" label="Take this list" onPress={openEditor} />
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
  )

  return (
    <ScreenContainer testID="screen.poll-results" width="narrow">
      <PollHeader
        testID="poll-results.header"
        takeCount={data?.takeCount ?? data?.category.popularityCount}
        actionLabel="Edit answers"
        onBack={() => navigation.goBack()}
        onAction={openEditor}
      />
      <Typography testID="poll-results.title" variant="title" style={styles.title}>{title}</Typography>
      {rankings.isLoading ? (
        <View testID="poll-results.loading" style={{ gap: spacing.md }}>
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="rect" width="100%" height={120} />
          <Skeleton variant="rect" width="100%" height={240} />
        </View>
      ) : rankings.isError && !data ? (
        <ErrorState testID="poll-results.error" subtitle="Couldn't load this ranking." onRetry={() => rankings.refetch()} />
      ) : (
        <FlatList
          data={units}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <ResultUnitCard unit={item} onPress={() => {}} />}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState testID="poll-results.empty" title="Not enough answers yet" subtitle="The site ranking appears once a few more people answer this list." />}
          contentContainerStyle={{ paddingBottom: spacing.section }}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.sm, marginBottom: spacing.md },
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
