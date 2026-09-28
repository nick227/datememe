import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { Icon } from '../Icon'
import { colors, spacing } from '../../theme'
import { Surface } from '../Surface'

// The one InteractiveModule in the Discover feed — a tile that hands off to
// the existing gesture-driven swipe experience (QuickPicksScreen) rather than
// trying to cram card-stack physics into a feed row.
export function QuickPicksModule({ onPress }: { onPress: () => void }) {
  return (
    <Surface variant="interactive" radius="grid" testID="discover.open-quick-picks" style={styles.card} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Icon name="Heart" color={colors.white} size={28} />
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="heading" style={styles.title}>
          Quick Picks
        </Typography>
        <Typography variant="bodyMuted">Swipe through new profiles</Typography>
      </View>
      <Icon name="Play" color={colors.ink} size={20} strokeWidth={2.5} />
    </Surface>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginBottom: 2 },
})
