import { Pressable, StyleSheet, View } from 'react-native'
import { AnimatedSheet } from '../../../ui/AnimatedSheet'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import { optionSheetLines, type RankedOption } from '../rankingStory'

type Props = {
  option: RankedOption | null
  takeCount: number
  onClose: () => void
}

export function RankingOptionSheet({ option, takeCount, onClose }: Props) {
  return (
    <AnimatedSheet testID="poll-results.option" visible={option != null} onClose={onClose} sheetStyle={styles.sheet}>
      {option ? (
        <View>
          <Typography variant="heading" style={styles.name}>{option.name}</Typography>
          {optionSheetLines(option, takeCount).map((line) => (
            <Typography key={line} variant="body" style={styles.line}>{line}</Typography>
          ))}
          <Pressable testID="poll-results.option.close" onPress={onClose} style={styles.close} accessibilityRole="button">
            <Typography variant="label" style={styles.closeText}>Close</Typography>
          </Pressable>
        </View>
      ) : null}
    </AnimatedSheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.canvas,
    borderTopWidth: borderWidth.thick,
    borderColor: colors.ink,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  name: { marginBottom: spacing.md },
  line: { marginBottom: spacing.xs },
  close: { marginTop: spacing.lg },
  closeText: { letterSpacing: 0, textTransform: 'none', color: colors.ink },
})
