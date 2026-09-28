import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { CardShell } from './CardShell'
import { SmartImage } from './SmartImage'
import { MicroBadge } from './MicroBadge'
import { PressableScale } from '../PressableScale'
import { borderWidth, colors, spacing } from '../../theme'
import type { RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'
import { PosterCard } from './PosterCard'
import { personToCardModel } from './cardAdapters'
type Props = {
  unit: ContentUnit
  variant: RenderVariant
  zone?: string
  onPress: () => void
}

// The product differentiator: discovery through ranked favorites and shared
// interests, not an empty photo tile. "You both ranked" (the reason this
// match is relevant) outweighs "Also into" (supporting texture) — per the
// Discover review correction. Same outer shell as CategoryUnitCard; the
// content anatomy differs, the geometry doesn't.
export function PersonUnitCard({ unit, variant, zone, onPress }: Props) {
  // If we're strictly in the results zone, force the canonical poster card.
  if (zone === 'results') return <PosterCard model={personToCardModel(unit)} onPress={onPress} />

  // The People grid uses the same compact ~3:4 "poster" card as Lists'
  // topic/Site Picks grids (CategoryUnitCard's CompactGridCard) — one small
  // card language across the whole app instead of Discover's grid forking
  // into its own bigger, differently-proportioned shape.
  if (variant === 'grid-square') return <PosterCard model={personToCardModel(unit)} onPress={onPress} />

  const isRail = variant === 'rail'
  const isRiver = variant === 'river'
  const matchMetric = unit.metrics?.find((m) => m.type === 'overlap')
  const sharedFavorites = unit.sharedFavorites ?? []
  const locationLine = unit.subtitle || ''

  // River is "more like an editorial/social entry than a tile" — a full-width
  // row, not another bordered box (proposal correction: four layouts create
  // rhythm, not four differently-decorated boxes).
  if (isRiver) {
    return (
      <PressableScale testID={`discover.profile.${unit.id}`} style={riverStyles.row} onPress={onPress}>
        <SmartImage uri={unit.imageUrl} fallbackText={unit.title} width={56} height={56} round />
        <View style={riverStyles.content}>
          <Typography variant="heading" numberOfLines={1}>
            {unit.title}
          </Typography>
          {locationLine ? <Typography variant="bodyMuted">{locationLine}</Typography> : null}
          {sharedFavorites.length > 0 ? (
            <Typography variant="body" style={styles.sharedNames} numberOfLines={2}>
              Shared: {sharedFavorites.map((f) => f.entityName).join(' · ')}
            </Typography>
          ) : null}
        </View>
        
        <View style={riverStyles.meta}>
          {matchMetric ? (
            <Typography style={styles.matchValue}>{matchMetric.value} match</Typography>
          ) : null}
        </View>
      </PressableScale>
    )
  }

  return (
    <CardShell testID={`discover.profile.${unit.id}`} onPress={onPress} noBorder>
      <CardShell.Media style={styles.imageWrap}>
        <SmartImage uri={unit.imageUrl} fallbackText={unit.title} aspectRatio={3/4} style={StyleSheet.absoluteFill} />
        {matchMetric ? <MicroBadge label={`${matchMetric.value} match`} position="top-left" variant="neutral" /> : null}
      </CardShell.Media>

      <CardShell.Body style={[styles.body, isRail && styles.railBody]}>
        <View style={styles.headerRow}>
          <Typography variant="heading" numberOfLines={1} style={[styles.name, isRail && styles.railName]}>
            {unit.title}
          </Typography>
        </View>

        <CardShell.Insight>
          <View style={styles.block}>
            <Typography variant="label" style={styles.sharedLabel}>
              Shared interests
            </Typography>
            {sharedFavorites.length > 0 ? (
              <Typography variant="body" style={styles.sharedNames} numberOfLines={1}>
                {sharedFavorites.map((f) => f.entityName).join(' · ')}
              </Typography>
            ) : (
              <Typography variant="bodyMuted" style={{ fontStyle: 'italic' }}>
                None
              </Typography>
            )}
          </View>
        </CardShell.Insight>

        <CardShell.ActionRow>
          <Typography variant="bodyMuted" numberOfLines={1} style={styles.metaText}>
            {locationLine}
          </Typography>
        </CardShell.ActionRow>
      </CardShell.Body>
    </CardShell>
  )
}



const riverStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  content: { flex: 1, gap: 2, paddingRight: spacing.sm },
  meta: { alignItems: 'flex-end', gap: 2 },
})

const styles = StyleSheet.create({
  imageWrap: {
    aspectRatio: 3 / 4,
    width: '100%',
    overflow: 'hidden',
  },
  headerRow: { marginBottom: 2 },
  name: { fontSize: 22, lineHeight: 28 },
  body: { flex: 1, justifyContent: 'space-between' },
  railBody: { paddingVertical: spacing.md, justifyContent: 'space-between', flex: 1 },
  railName: { fontSize: 16, lineHeight: 20 },
  block: { marginTop: spacing.sm, minHeight: 40 },
  sharedLabel: { color: colors.ink, marginBottom: 2 },
  sharedNames: { fontWeight: '700', fontSize: 15 },
  alsoLabel: { color: colors.inkMuted, marginBottom: 2 },
  metaText: { flex: 1, paddingRight: spacing.sm },
  matchLine: { color: colors.inkMuted, textAlign: 'right' },
  matchValue: { color: colors.accent, fontWeight: '800' },
})
