import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '../../../ui/Icon'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

type Props = {
  testID?: string
  takeCount?: number
  onBack: () => void
  onViewResults: () => void
}

export function timesTakenLabel(count: number) {
  return count === 1 ? '1 time taken' : `${count.toLocaleString()} times taken`
}

export function PollHeader({ testID, takeCount, onBack, onViewResults }: Props) {
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
      <Pressable
        testID={testID ? `${testID}.results` : undefined}
        onPress={onViewResults}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Typography variant="body" style={styles.results}>View poll results</Typography>
      </Pressable>
      {takeCount != null ? (
        <Typography testID={testID ? `${testID}.taken` : undefined} variant="bodyMuted" style={styles.taken} numberOfLines={1}>
          {timesTakenLabel(takeCount)}
        </Typography>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
