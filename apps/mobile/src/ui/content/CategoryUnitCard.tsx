import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { ImageCredit } from './ImageCredit'
import { MetricRow } from './MetricRow'
import { cardShell } from './cardShell'
import { borderWidth, colors, spacing } from '../../theme'
import { pickMetrics, RENDER_BUDGETS, type RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'

type Props = {
  unit: ContentUnit
  variant: RenderVariant
  onPress: () => void
}

// Carries forward the two shipped Lists card designs (CategoryStatCard's real
// social proof, CategoryDiscoveryCard's quieter tier, PreviewListCard's ranked
// multi-item preview for a completed list) as variants of one generic renderer,
// per the migration mapping in docs/shared-content-system-proposal.md §8.
export function CategoryUnitCard({ unit, variant, onPress }: Props) {
  // The main 2-col grid (topic groups + Site Picks on both Lists and
  // Discover) gets one compact, image-forward card regardless of the
  // viewer's completion state — a badge distinguishes done/in-progress
  // instead of branching to a whole different layout the way Rail/
  // Spotlight/River still do below.
  if (variant === 'grid-square') {
    return <CompactGridCard unit={unit} onPress={onPress} />
  }
  // Any list with at least one pick gets the ranked-preview treatment,
  // whether it's finished or not — the badge inside distinguishes the two.
  if (unit.previewEntities?.length) {
    return <CompletedListCard unit={unit} onPress={onPress} />
  }
  if (variant === 'grid-dense') {
    return <DenseCard unit={unit} onPress={onPress} />
  }
  return <StatCard unit={unit} variant={variant} onPress={onPress} />
}

// Compact "poster" card — ~3:4 image on top, one meta line below, a thick
// border instead of a shadow (stark aesthetic, no Material elevation). Same
// shell whether the category is unanswered, in progress, or complete; only
// the corner badge and meta line change.
function CompactGridCard({ unit, onPress }: { unit: ContentUnit; onPress: () => void }) {
  const items = unit.previewEntities ?? []
  const imageUrl = unit.imageUrl ?? items[0]?.imageUrl ?? unit.entity?.imageUrl
  const imageCredit = unit.imageCredit ?? items[0]?.imageCredit
  const isComplete = !!unit.relationship?.completed
  const inProgress = !isComplete && items.length > 0
  const metric = pickMetrics(unit.metrics, 'grid-square')[0]

  return (
    <Pressable testID={`categories.card.${unit.id}`} style={styles.compactCard} onPress={onPress}>
      <View style={styles.compactImageWrap}>
        {imageUrl ? (
          <Image accessibilityLabel={unit.title} source={{ uri: imageUrl }} style={styles.compactImage} resizeMode="cover" />
        ) : (
          <View style={[styles.compactImage, styles.compactImageFallback]} />
        )}
        {isComplete ? (
          <Typography variant="label" style={[styles.compactBadge, styles.compactBadgeDone]}>Done</Typography>
        ) : inProgress ? (
          <Typography variant="label" style={[styles.compactBadge, styles.compactBadgeProgress]}>In progress</Typography>
        ) : null}
      </View>
      <View style={styles.compactBody}>
        <Typography variant="heading" style={styles.compactTitle} numberOfLines={2}>
          {unit.title}
        </Typography>
        {metric ? (
          <Typography variant="label" style={styles.compactMeta} numberOfLines={1}>
            <Typography style={styles.compactDot}>{'● '}</Typography>
            {metric.value} {metric.label.toLowerCase()}
          </Typography>
        ) : unit.subtitle ? (
          <Typography variant="bodyMuted" style={styles.compactMeta} numberOfLines={1}>
            {unit.subtitle}
          </Typography>
        ) : null}
        <ImageCredit credit={imageCredit} />
      </View>
    </Pressable>
  )
}

function CompletedListCard({ unit, onPress }: { unit: ContentUnit; onPress: () => void }) {
  const items = unit.previewEntities ?? []
  const thumbnail = unit.imageUrl ?? items[0]?.imageUrl
  const isComplete = !!unit.relationship?.completed
  return (
    <Pressable testID={`categories.card.${unit.id}`} style={cardShell.base} onPress={onPress}>
      {!isComplete ? (
        <Typography variant="label" style={styles.inProgressBadge}>
          In progress
        </Typography>
      ) : null}
      <View style={styles.previewHeader}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.previewThumb} />
        ) : (
          <View style={[styles.previewThumb, styles.previewThumbFallback]} />
        )}
        <Typography variant="label" numberOfLines={2} style={styles.previewTitle}>
          {unit.title}
        </Typography>
      </View>
      <ImageCredit credit={unit.imageCredit ?? items[0]?.imageCredit} />
      <View style={styles.previewItems}>
        {items.slice(0, 5).map((entity, index) => (
          <View key={entity.id} style={styles.previewRow}>
            <Typography variant="label" style={styles.previewNumber}>
              {index + 1}
            </Typography>
            <Typography variant="body" numberOfLines={1} style={styles.previewName}>
              {entity.canonicalName}
            </Typography>
          </View>
        ))}
      </View>
    </Pressable>
  )
}

function StatCard({ unit, variant, onPress }: { unit: ContentUnit; variant: RenderVariant; onPress: () => void }) {
  const budget = RENDER_BUDGETS[variant]
  const metrics = pickMetrics(unit.metrics, variant)
  const isSpotlight = variant === 'spotlight'
  const hasImage = !!unit.imageUrl

  return (
    <Pressable testID={`categories.card.${unit.id}`} style={[cardShell.base, hasImage && styles.noBorder]} onPress={onPress}>
      {unit.imageUrl ? <Image accessibilityLabel={unit.title} source={{ uri: unit.imageUrl }} style={[styles.coverImage, isSpotlight && styles.spotlightImage]} resizeMode="cover" /> : null}
      <ImageCredit credit={unit.imageCredit} />
      <Typography variant={isSpotlight ? 'display' : 'heading'} style={styles.statTitle}>
        {unit.title}
      </Typography>
      {budget.subtitle && unit.subtitle ? (
        <Typography variant="bodyMuted" numberOfLines={2} style={styles.statPrompt}>
          {unit.subtitle}
        </Typography>
      ) : null}

      {unit.entity ? (
        <View style={[styles.topPickRow, isSpotlight && styles.topPickRowLarge]}>
          {unit.entity.imageUrl ? (
            <Image source={{ uri: unit.entity.imageUrl }} style={[styles.topPickImage, isSpotlight && styles.topPickImageLarge]} />
          ) : (
            <View style={[styles.topPickImage, styles.topPickImageFallback, isSpotlight && styles.topPickImageLarge]} />
          )}
          <Typography variant={isSpotlight ? 'heading' : 'body'} style={styles.topPickLabel} numberOfLines={1}>
            Most common #1: <Typography style={styles.bold}>{unit.entity.canonicalName}</Typography>
          </Typography>
        </View>
      ) : null}

      <MetricRow metrics={metrics} />

      <Typography variant="label" style={styles.cta}>
        Rank yours →
      </Typography>
    </Pressable>
  )
}

function DenseCard({ unit, onPress }: { unit: ContentUnit; onPress: () => void }) {
  const primary = pickMetrics(unit.metrics, 'grid-dense')[0]
  return (
    <Pressable testID={`categories.card.${unit.id}`} style={styles.denseCard} onPress={onPress}>
      {unit.imageUrl ? <Image accessibilityLabel={unit.title} source={{ uri: unit.imageUrl }} style={styles.previewThumb} /> : null}
      <ImageCredit credit={unit.imageCredit} />
      <Typography variant="body" style={styles.denseTitle} numberOfLines={2}>
        {unit.title}
      </Typography>
      <Typography variant="bodyMuted" style={styles.denseStat}>
        {primary ? `${primary.value} ${primary.label.toLowerCase()}` : 'New'}
      </Typography>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Reduced-border policy: a card carrying real imagery uses the photo's own
  // edge as its boundary instead of a drawn border (proposal correction —
  // borders are for text-only prompt cards, not decoration on every card).
  noBorder: { borderWidth: 0 },
  coverImage: { width: '100%', aspectRatio: 2, marginBottom: spacing.md, backgroundColor: colors.surfaceMuted },
  spotlightImage: { aspectRatio: 2.5 },
  inProgressBadge: { color: colors.accent, marginBottom: spacing.xs },
  statTitle: { marginBottom: spacing.xs },
  statPrompt: { marginBottom: spacing.md },
  bold: { fontWeight: '700' },
  topPickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  topPickRowLarge: { gap: spacing.lg, marginBottom: spacing.lg },
  topPickImage: { width: 24, height: 24, borderWidth: borderWidth.thin, borderColor: colors.ink },
  topPickImageLarge: { width: 160, height: 160, borderWidth: 0 },
  topPickImageFallback: { backgroundColor: colors.surfaceMuted },
  topPickLabel: { fontSize: 14, flex: 1 },
  cta: { color: colors.accent, marginTop: spacing.sm },

  denseCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    padding: spacing.md,
    justifyContent: 'space-between',
    minHeight: 88,
    flex: 1,
  },
  denseTitle: { fontWeight: '700', marginBottom: spacing.xs },

  // Compact "poster" grid card — sharp corners, thick border, no shadow
  // (stark aesthetic), ~3:4 image so the whole card lands around a
  // portrait 300x400-ish shape at typical grid-cell widths.
  compactCard: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    flex: 1,
  },
  compactImageWrap: { position: 'relative' },
  compactImage: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surfaceMuted },
  compactImageFallback: { backgroundColor: colors.surfaceMuted },
  compactBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  compactBadgeDone: { color: colors.ink },
  compactBadgeProgress: { color: colors.accent },
  compactBody: {
    borderTopWidth: borderWidth.thick,
    borderTopColor: colors.ink,
    padding: spacing.sm,
  },
  compactTitle: { fontSize: 15, lineHeight: 19, marginBottom: 2 },
  compactMeta: { fontSize: 11 },
  compactDot: { color: colors.accent },
  denseStat: { fontSize: 12 },

  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  previewThumb: { width: 32, height: 32, backgroundColor: colors.surfaceMuted },
  previewThumbFallback: { backgroundColor: colors.primarySoft },
  previewTitle: { flex: 1, color: colors.ink },
  previewItems: { gap: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewNumber: { width: 12, color: colors.inkMuted },
  previewName: { flex: 1, fontSize: 13 },
})
