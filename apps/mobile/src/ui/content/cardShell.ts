import { StyleSheet } from 'react-native'
import { borderWidth, colors, spacing } from '../../theme'

/**
 * The one outer geometry shared by every content-unit card, whatever kind it
 * renders — Lists question-cards and Discover person-cards should look like
 * the same application. Differences belong in each card's internal content
 * composition, never in the outer shell (border, corner, padding rhythm).
 */
export const cardShell = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    flex: 1,
  },
})
