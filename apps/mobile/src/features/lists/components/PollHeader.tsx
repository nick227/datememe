import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '../../../ui/Icon'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

type Props = {
  testID?: string
  takeCount?: number
  actionLabel: string
  onBack: () => void
  onAction: () => void
}

export function timesTakenLabel(count: number) {
  return count === 1 ? '1 total' : `${count.toLocaleString()} total`
}

export function PollHeader({ testID, takeCount, actionLabel, onBack, onAction }: Props) {
  return (
    <View testID={testID} style={styles.row}>
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
        hitSlop={8}
        accessibilityRole="button"
      >
        <Typography variant="body" style={styles.results}>{actionLabel}</Typography>
      </Pressable>
      {takeCount != null ? (
        <Typography testID={testID ? `${testID}.taken` : undefined} variant="bodyMuted" style={styles.taken} numberOfLines={1}>
          {timesTakenLabel(takeCount)}
        </Typography>
      ) : null}
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
