import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { colors, radius, spacing, type } from '../../../theme'
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

export function FastPickTile({ testID, name, imageUrl, isPending, pickedRank, onToggle, disabled }: Props) {
  const isPicked = pickedRank != null
  
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      disabled={disabled && !isPicked}
      style={[styles.tile, isPicked && styles.tilePicked, disabled && !isPicked && styles.tileDisabled]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.thumbInitial}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      
      <View style={styles.textCol}>
        <Typography variant="body" numberOfLines={1} style={isPicked ? styles.textPicked : styles.textDefault}>
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
          <Plus size={16} color={colors.primary} />
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56, // Fixed geometry
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  tilePicked: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
  },
  tileDisabled: {
    opacity: 0.5,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  thumbFallback: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: { ...type.heading, color: colors.inkMuted },
  textCol: { 
    flex: 1, 
    marginRight: spacing.sm,
    justifyContent: 'center',
  },
  textDefault: {
    color: colors.ink,
  },
  textPicked: {
    color: colors.primary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  pendingLabel: { fontSize: 11, marginTop: 2 },
  action: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPicked: {
    // any specific style for the #N container if needed
  },
  actionPickedText: { 
    color: colors.primary, 
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
})
