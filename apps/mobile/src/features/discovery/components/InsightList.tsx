import { Text, StyleSheet, View } from 'react-native'
import { colors, radius, spacing } from '../../../theme'
import type { MatchInsight } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

const ICONS: Record<string, string> = {
  'shared-taste': '👥',
  'rare-overlap': '💎',
}

export function InsightList({ insights }: { insights: MatchInsight[] }) {
  if (!insights.length) return null
  return (
    <View style={styles.container}>
      {insights.map((insight, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.icon}>{ICONS[insight.icon] ?? '✨'}</Text>
          <View style={{ flex: 1 }}>
            <Typography variant="heading">{insight.title}</Typography>
            <Typography variant="bodyMuted">{insight.description}</Typography>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon: { fontSize: 20 },
})
