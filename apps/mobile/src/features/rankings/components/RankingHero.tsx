import { StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'
import { rankingHero, type RankedOption } from '../rankingStory'

type Props = {
  options: RankedOption[]
  takeCount: number
  orderingMode: 'RANKED' | 'UNRANKED'
}

export function RankingHero({ options, takeCount, orderingMode }: Props) {
  const hero = rankingHero(options, takeCount, orderingMode)
  if (!hero) return null
  return (
    <View testID="poll-results.hero" style={styles.hero}>
      <Typography variant="bodyMuted">{hero.peopleLine}</Typography>
      <Typography variant="label" style={styles.kicker}>#1</Typography>
      <Typography variant="title" style={styles.winner}>{hero.winnerName}</Typography>
      {hero.firstPlaceLine ? <Typography variant="heading">{hero.firstPlaceLine}</Typography> : null}
      {hero.marginLine ? <Typography variant="body">{hero.marginLine}</Typography> : null}
      {hero.trendLine ? <Typography variant="body">{hero.trendLine}</Typography> : null}
      {hero.yoursLine ? <Typography variant="body" style={styles.yours}>{hero.yoursLine}</Typography> : null}
      {hero.insights.map((line) => (
        <Typography key={line} variant="bodyMuted">{line}</Typography>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs, marginBottom: spacing.lg },
  kicker: { marginTop: spacing.md, letterSpacing: 0, textTransform: 'none', color: colors.inkMuted },
  winner: { textTransform: 'uppercase' },
  yours: { marginTop: spacing.sm, fontFamily: 'PlusJakartaSans_700Bold' },
})
