import { StyleSheet, Text, View } from 'react-native'
import type { MatchInsight } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'
import { colors, radius, spacing, type } from '../../../theme'

type Props = {
  insights: MatchInsight[]
}

export function MatchDimensionsBreakdown({ insights }: Props) {
  if (!insights || insights.length === 0) return null

  return (
    <View style={styles.container}>
      <Typography variant="label" style={styles.sectionLabel}>MATCH DIMENSIONS</Typography>
      <View style={styles.grid}>
        {insights.map((insight, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.icon}>{insight.icon}</Text>
              <Typography variant="heading" style={styles.title}>{insight.title}</Typography>
            </View>
            <Typography variant="bodyMuted" style={styles.description}>
              {insight.description}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  grid: {
    gap: 0,
  },
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  icon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.ink,
  },
  description: {
    ...type.bodyMuted,
    lineHeight: 20,
  },
})
