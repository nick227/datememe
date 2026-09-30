import { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategoryRankings } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Skeleton } from '../../../ui/Skeleton'
import { Typography } from '../../../ui/Typography'
import { PollHeader } from '../../lists/components/PollHeader'
import { openPoll } from '../../../navigation/openPoll'
import { spacing } from '../../../theme'
import type { PollParams } from '../../../navigation/types'
import { RankingHero } from '../components/RankingHero'
import { RankingBarRow } from '../components/RankingBarRow'
import { RankingOptionSheet } from '../components/RankingOptionSheet'
import { RelatedRankings } from '../components/RelatedRankings'
import type { RankedOption } from '../rankingStory'

type Props = NativeStackScreenProps<{ PollResults: PollParams; ListBuilder: PollParams }, 'PollResults'>

export function PollResultsScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const rankings = useCategoryRankings(categorySlug)
  const data = rankings.data
  const title = data?.category.shortLabel ?? shortLabel
  const [selected, setSelected] = useState<RankedOption | null>(null)
  const takeCount = data?.takeCount ?? 0
  const options: RankedOption[] = (data?.entries ?? []).map((entry) => ({
    id: entry.entity.id,
    name: entry.entity.canonicalName,
    rank: entry.rank,
    previousRank: entry.previousRank,
    score: entry.score,
    pickCount: entry.pickCount,
    firstPlaceCount: entry.firstPlaceCount,
    pickPercent: entry.pickPercent,
    viewerRank: entry.viewerRank,
  }))

  function openEditor() {
    openPoll(navigation, 'edit', { categorySlug, shortLabel: title })
  }

  const header = data ? (
    <View style={styles.header}>
      <Typography variant="bodyMuted">{data.category.prompt}</Typography>
      {data.isPublished ? (
        <RankingHero takeCount={takeCount} faces={data.faces} />
      ) : null}
    </View>
  ) : null

  return (
    <ScreenContainer testID="screen.poll-results" width="narrow">
      <PollHeader
        testID="poll-results.header"
        actionLabel={data?.viewerHasTaken ? 'Edit answers' : 'Take this list'}
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
          data={data?.isPublished ? options : []}
          keyExtractor={(option) => option.id}
          renderItem={({ item }) => (
            <RankingBarRow
              option={item}
              leaderScore={options[0]?.score ?? 0}
              takeCount={takeCount}
              onPress={() => setSelected(item)}
            />
          )}
          ListHeaderComponent={header}
          ListFooterComponent={
            <RelatedRankings
              items={data?.related ?? []}
              onOpen={(item) => openPoll(navigation, 'results', { categorySlug: item.slug, shortLabel: item.shortLabel })}
            />
          }
          ListEmptyComponent={data?.isPublished ? null : <EmptyState testID="poll-results.empty" title="Not enough answers yet" subtitle="The site ranking appears once a few more people answer this list." />}
          contentContainerStyle={{ paddingBottom: spacing.section }}
        />
      )}
      <RankingOptionSheet option={selected} takeCount={takeCount} onClose={() => setSelected(null)} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.sm, marginBottom: spacing.md },
  header: { gap: spacing.sm },
})
