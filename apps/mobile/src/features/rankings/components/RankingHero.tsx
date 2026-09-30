import { StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { spacing } from '../../../theme'
import { rankingSummary, type RankedOption } from '../rankingStory'

type Props = {
  options: RankedOption[]
  takeCount: number
  orderingMode: 'RANKED' | 'UNRANKED'
}

export function RankingHero({ options, takeCount, orderingMode }: Props) {
  const lines = rankingSummary(options, takeCount, orderingMode)
  if (!lines.length) return null
  return (
    <View testID="poll-results.hero" style={styles.hero}>
      {lines.map((line) => (
        <Typography key={line} variant="bodyMuted">{line}</Typography>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { gap: 2, marginBottom: spacing.sm },
})
