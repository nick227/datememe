import { ChartNoAxesColumnIncreasing } from 'lucide-react-native'
import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '../../../ui/Icon'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

type Props = {
  testID?: string
  takeCount?: number
  actionLabel: string
  outlinedAction?: boolean
  onBack: () => void
  onAction: () => void
}

export function timesTakenLabel(count: number) {
  return count === 1 ? '1 total' : `${count.toLocaleString()} total`
}

export function PollHeader({ testID, takeCount, actionLabel, outlinedAction = false, onBack, onAction }: Props) {
  return (
    <View testID={testID} style={[styles.row, outlinedAction && styles.editorNavigation]}>
      <Pressable
        testID={testID ? `${testID}.back` : undefined}
        onPress={onBack}
        hitSlop={12}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Icon name="ChevronLeft" size={22} />
      </Pressable>
      <View style={styles.row}>
      <Pressable
        testID={testID ? `${testID}.action` : undefined}
        onPress={onAction}
        style={outlinedAction ? styles.secondaryAction : undefined}
        hitSlop={8}
        accessibilityRole="button"
      >
        {outlinedAction && <ChartNoAxesColumnIncreasing size={16} color={colors.inkMuted} />}
        <Typography variant="body" style={[styles.results, outlinedAction && styles.secondaryText]}>{actionLabel}</Typography>
      </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 40,
  },
  back: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorNavigation: { marginTop: 12 },
  secondaryAction: {
    height: 38,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: colors.inkMuted },
  results: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    lineHeight: 18,
  },
  taken: {
    marginLeft: 'auto',
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkMuted,
  },
})
