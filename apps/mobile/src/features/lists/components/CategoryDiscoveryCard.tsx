import { Pressable, StyleSheet } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, spacing } from '../../../theme'

type Props = {
  category: any
  onPress: () => void
}

// The lighter "discovery" tier below the featured stat cards — still carries
// a real number, never an anonymous box, just smaller/quieter than the
// featured cards above it.
export function CategoryDiscoveryCard({ category, onPress }: Props) {
  const { shortLabel, popularityCount } = category
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Typography variant="body" style={styles.title} numberOfLines={2}>
        {shortLabel}
      </Typography>
      <Typography variant="bodyMuted" style={styles.stat}>
        {popularityCount > 0 ? `${popularityCount} answers` : 'New'}
      </Typography>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    padding: spacing.md,
    justifyContent: 'space-between',
    minHeight: 88,
    flex: 1,
  },
  title: { fontWeight: '700', marginBottom: spacing.xs },
  stat: { fontSize: 12 },
})
