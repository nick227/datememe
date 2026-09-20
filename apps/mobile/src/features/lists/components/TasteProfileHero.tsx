import { Image, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, spacing } from '../../../theme'

type Props = {
  completedLists: any[]
  totalCategories: number
}

// The "living profile" summary — not another card in the stack, an inverted
// black band up top so it reads as a masthead, not just item #1 of a list.
export function TasteProfileHero({ completedLists, totalCategories }: Props) {
  const completedCount = completedLists.length
  const totalPicks = completedLists.reduce((sum, l) => sum + (l.items?.length ?? 0), 0)

  const mostRecent = completedLists
    .filter((l) => l.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]
  const featuredPick = mostRecent && (mostRecent.items.find((i: any) => i.rank === 1) ?? mostRecent.items[0])

  const progress = totalCategories > 0 ? Math.min(completedCount / totalCategories, 1) : 0

  return (
    <View style={styles.hero}>
      <Typography variant="label" style={styles.eyebrow}>
        Your taste profile
      </Typography>
      <Typography variant="display" style={styles.heading}>
        {completedCount} {completedCount === 1 ? 'list' : 'lists'} ranked · {totalPicks} picks and counting
      </Typography>

      <View style={styles.statsRow}>
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Typography variant="bodyMuted" style={styles.progressLabel}>
            {completedCount} of {totalCategories} categories ranked
          </Typography>
        </View>

        {featuredPick ? (
          <View style={styles.featured}>
            {featuredPick.entity.imageUrl ? (
              <Image source={{ uri: featuredPick.entity.imageUrl }} style={styles.featuredImage} />
            ) : (
              <View style={[styles.featuredImage, styles.featuredImageFallback]} />
            )}
            <View style={{ flex: 1 }}>
              <Typography variant="label" style={styles.featuredLabel}>
                Your #1 pick
              </Typography>
              <Typography variant="heading" style={styles.featuredName} numberOfLines={1}>
                {featuredPick.entity.canonicalName}
              </Typography>
              <Typography variant="bodyMuted" style={styles.featuredSub} numberOfLines={1}>
                {mostRecent.category?.shortLabel}
              </Typography>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  eyebrow: { color: colors.white, opacity: 0.6, marginBottom: spacing.xs },
  heading: { color: colors.white, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  progressBlock: { flex: 1, minWidth: 180 },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: spacing.xs },
  progressFill: { height: 8, backgroundColor: colors.accent },
  progressLabel: { color: colors.white, opacity: 0.7 },
  featured: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 200 },
  featuredImage: { width: 56, height: 56, borderWidth: borderWidth.thick, borderColor: colors.white },
  featuredImageFallback: { backgroundColor: colors.inkMuted },
  featuredLabel: { color: colors.accent, marginBottom: 2 },
  featuredName: { color: colors.white },
  featuredSub: { color: colors.white, opacity: 0.6 },
})
