import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, type } from '../../../theme'
import { Typography } from '../../../ui/Typography'

type Props = {
  name: string
  imageUrl?: string | null
  isPending?: boolean
  pickedRank: number | null
  onToggle: () => void
  disabled?: boolean
}

export function EntityRow({ name, imageUrl, isPending, pickedRank, onToggle, disabled }: Props) {
  const isPicked = pickedRank != null
  return (
    <View style={styles.row}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.thumbInitial}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.textCol}>
        <Typography variant="heading" numberOfLines={1}>
          {name}
        </Typography>
        {isPending ? <Typography variant="bodyMuted" style={styles.pendingLabel}>Pending review — only you can see this</Typography> : null}
      </View>
      <Pressable
        onPress={onToggle}
        disabled={disabled && !isPicked}
        style={[styles.action, isPicked ? styles.actionPicked : styles.actionAdd]}
      >
        <Typography variant="button" style={isPicked ? styles.actionPickedText : styles.actionAddText}>
          {isPicked ? `✓ Picked #${pickedRank}` : '+'}
        </Typography>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    marginRight: spacing.md,
  },
  thumbFallback: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: { ...type.heading, color: colors.inkMuted },
  textCol: { flex: 1, marginRight: spacing.sm },
  pendingLabel: { ...type.bodyMuted, fontSize: 12, marginTop: 2 },
  action: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionAdd: { backgroundColor: colors.primarySoft, width: 40, paddingHorizontal: 0 },
  actionAddText: { color: colors.primary, fontSize: 20, lineHeight: 22 },
  actionPicked: { backgroundColor: colors.primarySoft },
  actionPickedText: { color: colors.primary, fontSize: 13, textTransform: 'none' },
})
