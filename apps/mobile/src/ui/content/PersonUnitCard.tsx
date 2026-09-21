import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { ImageCredit } from './ImageCredit'
import { cardShell } from './cardShell'
import { borderWidth, colors, spacing } from '../../theme'
import type { RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'

type Props = {
  unit: ContentUnit
  variant: RenderVariant
  onPress: () => void
}

// The product differentiator: discovery through ranked favorites and shared
// interests, not an empty photo tile. "You both ranked" (the reason this
// match is relevant) outweighs "Also into" (supporting texture) — per the
// Discover review correction. Same outer shell as CategoryUnitCard; the
// content anatomy differs, the geometry doesn't.
export function PersonUnitCard({ unit, variant, onPress }: Props) {
  // The People grid uses the same compact ~3:4 "poster" card as Lists'
  // topic/Site Picks grids (CategoryUnitCard's CompactGridCard) — one small
  // card language across the whole app instead of Discover's grid forking
  // into its own bigger, differently-proportioned shape.
  if (variant === 'grid-square') return <CompactPersonCard unit={unit} onPress={onPress} />

  const isRail = variant === 'rail'
  const isRiver = variant === 'river'
  const matchMetric = unit.metrics?.find((m) => m.type === 'overlap')
  const sharedCountMetric = unit.metrics?.find((m) => m.type === 'popularity')
  const sharedFavorites = unit.sharedFavorites ?? []
  const alsoInto = unit.alsoInto ?? []
  const locationLine = [unit.age, unit.subtitle].filter(Boolean).join(' · ')

  // River is "more like an editorial/social entry than a tile" — a full-width
  // row, not another bordered box (proposal correction: four layouts create
  // rhythm, not four differently-decorated boxes).
  if (isRiver) {
    return (
      <Pressable testID={`discover.profile.${unit.id}`} style={riverStyles.row} onPress={onPress}>
        {unit.imageUrl ? (
          <Image source={{ uri: unit.imageUrl }} style={riverStyles.photo} />
        ) : (
          <View style={[riverStyles.photo, styles.photoFallback]}>
            <Typography variant="heading" style={styles.initial}>
              {(unit.title || '?').charAt(0).toUpperCase()}
            </Typography>
          </View>
        )}
        <View style={riverStyles.content}>
          <Typography variant="heading" numberOfLines={1}>
            {unit.title}
            {locationLine ? <Typography variant="bodyMuted"> · {locationLine}</Typography> : null}
          </Typography>
          {sharedFavorites.length > 0 ? (
            <Typography variant="body" style={styles.sharedNames} numberOfLines={1}>
              You both ranked {sharedFavorites.map((f) => f.entityName).join(' · ')}
            </Typography>
          ) : null}
          {matchMetric ? (
            <Typography variant="body" style={styles.matchLine}>
              <Typography style={styles.matchValue}>{matchMetric.value} match</Typography>
              {sharedCountMetric ? ` · ${sharedCountMetric.value} shared` : ''}
            </Typography>
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <Pressable testID={`discover.profile.${unit.id}`} style={cardShell.base} onPress={onPress}>
      <View style={styles.headerRow}>
        <Typography variant="heading" numberOfLines={1} style={styles.name}>
          {unit.title}
        </Typography>
        {locationLine ? (
          <Typography variant="bodyMuted" numberOfLines={1}>
            {locationLine}
          </Typography>
        ) : null}
      </View>

      {unit.imageUrl ? (
        <Image source={{ uri: unit.imageUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoFallback]}>
          <Typography variant="display" style={styles.initial}>
            {(unit.title || '?').charAt(0).toUpperCase()}
          </Typography>
        </View>
      )}

      {sharedFavorites.length > 0 ? (
        <View style={styles.block}>
          <Typography variant="label" style={styles.sharedLabel}>
            You both ranked
          </Typography>
          <Typography variant="body" style={styles.sharedNames} numberOfLines={2}>
            {sharedFavorites.map((f) => f.entityName).join(' · ')}
          </Typography>
        </View>
      ) : null}

      {alsoInto.length > 0 && !isRail ? (
        <View style={styles.block}>
          <Typography variant="label" style={styles.alsoLabel}>
            Also into
          </Typography>
          <Typography variant="bodyMuted" numberOfLines={1}>
            {alsoInto.map((e) => e.canonicalName).join(' · ')}
          </Typography>
        </View>
      ) : null}

      {matchMetric ? (
        <Typography variant="body" style={styles.matchLine}>
          <Typography style={styles.matchValue}>{matchMetric.value} match</Typography>
          {sharedCountMetric ? ` · ${sharedCountMetric.value} shared` : ''}
        </Typography>
      ) : null}
    </Pressable>
  )
}

// Compact "poster" card — mirrors CategoryUnitCard's CompactGridCard
// exactly: ~3:4 image on top, thick border instead of a shadow (stark
// aesthetic), one meta line below. The corner badge carries the match
// percentage instead of a Done/In-progress state.
function CompactPersonCard({ unit, onPress }: { unit: ContentUnit; onPress: () => void }) {
  const matchMetric = unit.metrics?.find((m) => m.type === 'overlap')
  const sharedCountMetric = unit.metrics?.find((m) => m.type === 'popularity')
  const locationLine = [unit.age, unit.subtitle].filter(Boolean).join(' · ')
  const metaLine = locationLine || (sharedCountMetric ? `${sharedCountMetric.value} shared` : null)

  return (
    <Pressable testID={`discover.profile.${unit.id}`} style={compactStyles.card} onPress={onPress}>
      <View style={compactStyles.imageWrap}>
        {unit.imageUrl ? (
          <Image accessibilityLabel={unit.title} source={{ uri: unit.imageUrl }} style={compactStyles.image} resizeMode="cover" />
        ) : (
          <View style={[compactStyles.image, compactStyles.imageFallback]}>
            <Typography variant="display" style={styles.initial}>
              {(unit.title || '?').charAt(0).toUpperCase()}
            </Typography>
          </View>
        )}
        {matchMetric ? <Typography variant="label" style={compactStyles.badge}>{matchMetric.value} match</Typography> : null}
      </View>
      <View style={compactStyles.body}>
        <Typography variant="heading" style={compactStyles.title} numberOfLines={1}>
          {unit.title}
        </Typography>
        {metaLine ? (
          <Typography variant="label" style={compactStyles.meta} numberOfLines={1}>
            {metaLine}
          </Typography>
        ) : null}
        <ImageCredit credit={unit.imageCredit} />
      </View>
    </Pressable>
  )
}

const compactStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    flex: 1,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surfaceMuted },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    color: colors.accent,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  body: {
    borderTopWidth: borderWidth.thick,
    borderTopColor: colors.ink,
    padding: spacing.sm,
  },
  title: { fontSize: 15, lineHeight: 19, marginBottom: 2 },
  meta: { fontSize: 11, color: colors.inkMuted },
})

const riverStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  photo: { width: 56, height: 56, backgroundColor: colors.surfaceMuted },
  content: { flex: 1, gap: 2 },
})

const styles = StyleSheet.create({
  headerRow: { marginBottom: spacing.sm },
  name: { marginBottom: 2 },
  photo: { width: '100%', aspectRatio: 1.4, backgroundColor: colors.surfaceMuted, marginBottom: spacing.md },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.inkMuted },
  block: { marginBottom: spacing.sm },
  sharedLabel: { color: colors.ink, marginBottom: 2 },
  sharedNames: { fontWeight: '700', fontSize: 15 },
  alsoLabel: { color: colors.inkMuted, marginBottom: 2 },
  matchLine: { marginTop: spacing.xs, color: colors.inkMuted },
  matchValue: { color: colors.accent, fontWeight: '800' },
})
