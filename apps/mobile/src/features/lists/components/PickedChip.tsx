import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../../../theme'
import { Typography } from '../../../ui/Typography'

export function PickedChip({ rank, name, onRemove }: { rank: number; name: string; onRemove: () => void }) {
  return (
    <View style={styles.chip}>
      <Typography variant="label" style={styles.rank}>#{rank}</Typography>
      <Typography variant="body" style={styles.name} numberOfLines={1}>
        {name}
      </Typography>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.remove}>
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    maxWidth: 180,
  },
  rank: { color: colors.primary, marginRight: spacing.xs },
  name: { fontFamily: 'PlusJakartaSans_600SemiBold', flexShrink: 1 },
  remove: { marginLeft: spacing.sm },
  removeText: { color: colors.inkMuted, fontSize: 14 },
})
