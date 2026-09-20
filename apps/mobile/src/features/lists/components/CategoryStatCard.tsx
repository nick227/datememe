import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, spacing } from '../../../theme'

type Props = {
  category: any
  onPress: () => void
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// The "comparison/data card" — real social proof instead of an anonymous gray
// box: how many people have ranked it, the most common #1 pick (with its
// thumbnail if it has one), and — the reason to answer *now* — how much more
// often the viewer's own matches answer this one.
export function CategoryStatCard({ category, onPress }: Props) {
  const { shortLabel, prompt, popularityCount, topPick, matchAnswerMultiplier } = category
  const showMultiplier = matchAnswerMultiplier != null && matchAnswerMultiplier >= 1.15

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Typography variant="heading" style={styles.title}>
        {shortLabel}
      </Typography>
      <Typography variant="bodyMuted" numberOfLines={2} style={styles.prompt}>
        {prompt}
      </Typography>

      <View style={styles.stats}>
        <Typography variant="body" style={styles.statLine}>
          {popularityCount > 0 ? `${formatCount(popularityCount)} people have ranked this` : 'Be the first to rank this'}
        </Typography>

        {topPick ? (
          <View style={styles.topPickRow}>
            {topPick.imageUrl ? (
              <Image source={{ uri: topPick.imageUrl }} style={styles.topPickImage} />
            ) : (
              <View style={[styles.topPickImage, styles.topPickImageFallback]} />
            )}
            <Typography variant="body" style={styles.statLine}>
              Most common #1: <Typography style={styles.bold}>{topPick.canonicalName}</Typography>
            </Typography>
          </View>
        ) : null}

        {showMultiplier ? (
          <Typography variant="body" style={[styles.statLine, styles.accentLine]}>
            Your matches answer this {matchAnswerMultiplier.toFixed(1)}× more often
          </Typography>
        ) : null}
      </View>

      <Typography variant="label" style={styles.cta}>
        Rank yours →
      </Typography>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flex: 1,
  },
  title: { marginBottom: spacing.xs },
  prompt: { marginBottom: spacing.md },
  stats: { gap: spacing.xs, marginBottom: spacing.md },
  statLine: { fontSize: 14 },
  bold: { fontWeight: '700' },
  accentLine: { color: colors.accent, fontWeight: '700' },
  topPickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topPickImage: { width: 24, height: 24, borderWidth: borderWidth.thin, borderColor: colors.ink },
  topPickImageFallback: { backgroundColor: colors.surfaceMuted },
  cta: { color: colors.accent },
})
