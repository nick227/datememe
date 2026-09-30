import { Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'
import { barCaption, barFraction, type RankedOption } from '../rankingStory'

type Props = {
  option: RankedOption
  leaderScore: number
  takeCount: number
  orderingMode: 'RANKED' | 'UNRANKED'
  onPress: () => void
}

export function RankingBarRow({ option, leaderScore, takeCount, orderingMode, onPress }: Props) {
  const fraction = barFraction(option.score, leaderScore)
  return (
    <Pressable testID={`poll-results.row.${option.rank}`} onPress={onPress} style={styles.row} accessibilityRole="button">
      <View style={styles.top}>
        <Typography variant="label" style={styles.rank}>#{option.rank}</Typography>
        <Typography variant="heading" style={styles.name} numberOfLines={1}>{option.name}</Typography>
        <Typography variant="bodyMuted" style={styles.points}>{option.score}</Typography>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { flex: fraction }]} />
        <View style={{ flex: Math.max(1 - fraction, 0) }} />
      </View>
      <Typography variant="bodyMuted" style={styles.caption}>{barCaption(option, takeCount, orderingMode)}</Typography>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { width: 36, letterSpacing: 0, textTransform: 'none', color: colors.inkMuted },
  name: { flex: 1, fontSize: 16 },
  points: { fontVariant: ['tabular-nums'] },
  track: { height: 8, flexDirection: 'row', backgroundColor: colors.surfaceMuted, marginLeft: 44 },
  fill: { height: 8, backgroundColor: colors.ink },
  caption: { marginLeft: 44, fontSize: 13 },
})
