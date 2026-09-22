import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { borderWidth, colors, spacing } from '../../theme'

/**
 * The seam between a filter's dedicated Results zone and the ambient Explore
 * feed below it — a visible "this is where results end" marker so an empty
 * or short Results block never reads as if the whole page just ran out of
 * content (proposal: keep the infinite feed after a filter, always).
 */
export function ExploreBoundary() {
  return (
    <View testID="explore-boundary" style={styles.row}>
      <View style={styles.rule} />
      <Typography variant="label" style={styles.label}>
        Explore more
      </Typography>
      <View style={styles.rule} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.section,
  },
  rule: { flex: 1, height: borderWidth.thin, backgroundColor: colors.border },
  label: { color: colors.inkMuted },
})
