import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { MetricRow } from './MetricRow'
import { borderWidth, colors, spacing } from '../../theme'
import { pickMetrics, type RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'

// The River's "comparison story" row — a full-width text unit, no image.
export function InsightUnitCard({ unit, variant }: { unit: ContentUnit; variant: RenderVariant }) {
  const metrics = pickMetrics(unit.metrics, variant)
  return (
    <View style={styles.row}>
      <Typography variant="heading" style={styles.title}>
        {unit.title}
      </Typography>
      {unit.subtitle ? (
        <Typography variant="body" style={styles.subtitle}>
          {unit.subtitle}
        </Typography>
      ) : null}
      <MetricRow metrics={metrics} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    borderTopWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  title: {},
  subtitle: { color: colors.inkMuted },
})
