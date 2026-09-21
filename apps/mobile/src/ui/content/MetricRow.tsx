import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { colors, spacing } from '../../theme'
import type { Metric } from './types'

export function MetricRow({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null
  return (
    <View style={styles.stack}>
      {metrics.map((m, i) => (
        <Typography
          key={`${m.type}-${i}`}
          variant="body"
          style={[styles.line, m.importance === 'primary' && styles.primaryLine]}
          numberOfLines={1}
        >
          {m.label}: <Typography style={m.importance === 'primary' ? styles.primaryValue : styles.value}>{m.value}</Typography>
        </Typography>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xs / 2 },
  line: { fontSize: 13 },
  primaryLine: { color: colors.accent },
  value: { fontWeight: '700' },
  primaryValue: { fontWeight: '800', color: colors.accent },
})
