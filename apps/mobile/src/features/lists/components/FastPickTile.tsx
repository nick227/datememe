import { Pressable, StyleSheet, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { colors, spacing } from '../../../theme'
import { Typography } from '../../../ui/Typography'

type Props = {
  testID?: string
  name: string
  imageUrl?: string | null
  isPending?: boolean
  pickedRank: number | null
  onToggle: () => void
  disabled?: boolean
}

export function FastPickTile({ testID, name, isPending, pickedRank, onToggle, disabled }: Props) {
  const isPicked = pickedRank != null

  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isPicked ? `${name}, selected at number ${pickedRank}` : `Add ${name}`}
      accessibilityState={{ selected: isPicked, disabled: !!disabled || isPicked }}
      disabled={disabled || isPicked}
      style={[styles.tile, isPicked && styles.tilePicked, disabled && !isPicked && styles.tileDisabled]}
    >
      <View style={styles.textCol}>
        <Typography variant="body" numberOfLines={2} style={isPicked ? styles.textPicked : styles.textDefault}>
          {name}
        </Typography>
        {isPending ? <Typography variant="bodyMuted" style={styles.pendingLabel}>Pending review</Typography> : null}
      </View>

      <View style={[styles.action, isPicked && styles.actionPicked]}>
        {isPicked ? (
          <Typography variant="label" style={styles.actionPickedText}>
            #{pickedRank}
          </Typography>
        ) : (
          <Plus size={16} color={colors.inkMuted} />
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,

  },
  tilePicked: {
    borderColor: colors.border,
    backgroundColor: '#F2F5FA',
  },
  tileDisabled: {
    opacity: 0.5,
  },
  textCol: {
    flex: 1,
    marginRight: spacing.sm,
    justifyContent: 'center',
  },
  textDefault: {
    color: colors.ink,
  },
  textPicked: {
    color: colors.inkMuted,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  pendingLabel: { fontSize: 11, marginTop: 2 },
  action: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPicked: {
    backgroundColor: 'transparent',
  },
  actionPickedText: {
    color: colors.inkMuted,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
})
