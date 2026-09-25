import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { ImageCredit } from './ImageCredit'
import { CardShell } from './CardShell'
import { SmartImage } from './SmartImage'
import { MicroBadge } from './MicroBadge'
import { PressableScale } from '../PressableScale'
import { borderWidth, colors, spacing } from '../../theme'
import type { RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'

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
  if (zone === 'results') return <CompactPersonCard unit={unit} onPress={onPress} />

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
      <PressableScale testID={`discover.profile.${unit.id}`} style={riverStyles.row} onPress={onPress}>
        <SmartImage uri={unit.imageUrl} fallbackText={unit.title} width={56} height={56} round />
        <View style={riverStyles.content}>
          <Typography variant="heading" numberOfLines={1}>
            {unit.title}
          </Typography>
          {locationLine ? <Typography variant="bodyMuted">{locationLine}</Typography> : null}
          {sharedFavorites.length > 0 ? (
            <Typography variant="body" style={styles.sharedNames} numberOfLines={2}>
              You both ranked {sharedFavorites.map((f) => f.entityName).join(' · ')}
            </Typography>
          ) : null}
        </View>
        
        <View style={riverStyles.meta}>
          {matchMetric ? (
            <Typography style={styles.matchValue}>{matchMetric.value} match</Typography>
          ) : null}
          {sharedCountMetric ? (
            <Typography variant="bodyMuted">{sharedCountMetric.value} shared interests</Typography>
          ) : null}
        </View>
      </PressableScale>
    )
  }

  return (
    <CardShell testID={`discover.profile.${unit.id}`} onPress={onPress}>
      <CardShell.Media style={styles.imageWrap}>
        <SmartImage uri={unit.imageUrl} fallbackText={unit.title} />
      </CardShell.Media>

      <CardShell.Body>
        <View style={styles.headerRow}>
          <Typography variant="heading" numberOfLines={1} style={styles.name}>
            {unit.title}
          </Typography>
        </View>

        <CardShell.Insight>
          {sharedFavorites.length > 0 ? (
            <View style={styles.block}>
              <Typography variant="label" style={styles.sharedLabel}>
                You both ranked
              </Typography>
              <Typography variant="body" style={styles.sharedNames} numberOfLines={1}>
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
          
          {sharedFavorites.length === 0 && alsoInto.length === 0 ? (
            <Typography variant="bodyMuted" style={{ fontStyle: 'italic' }}>
              No overlapping interests yet
            </Typography>
          ) : null}
        </CardShell.Insight>

        <CardShell.ActionRow>
          <Typography variant="bodyMuted" numberOfLines={1} style={styles.metaText}>
            {locationLine}
          </Typography>
          {matchMetric ? (
            <Typography variant="body" style={styles.matchLine}>
              <Typography style={styles.matchValue}>{matchMetric.value} match</Typography>
              {sharedCountMetric ? ` · ${sharedCountMetric.value} shared` : ''}
            </Typography>
          ) : null}
        </CardShell.ActionRow>
      </CardShell.Body>
    </CardShell>
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
    <CardShell testID={`discover.profile.${unit.id}`} onPress={onPress}>
      <CardShell.Media style={compactStyles.imageWrap}>
        <SmartImage uri={unit.imageUrl} fallbackText={unit.title} />
        {matchMetric ? <MicroBadge label={`${matchMetric.value} match`} position="top-left" variant="neutral" /> : null}
      </CardShell.Media>
      <CardShell.Body style={compactStyles.body}>
        <Typography variant="heading" style={compactStyles.title} numberOfLines={1}>
          {unit.title}
        </Typography>
        {metaLine ? (
          <Typography variant="label" style={compactStyles.meta} numberOfLines={1}>
            {metaLine}
          </Typography>
        ) : null}
        <ImageCredit credit={unit.imageCredit} />
      </CardShell.Body>
    </CardShell>
  )
}

const compactStyles = StyleSheet.create({
  imageWrap: { position: 'relative' },
  body: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.ink,
    padding: spacing.md,
    flex: 1,
  },
  title: { fontSize: 18, lineHeight: 22, marginBottom: 0, fontWeight: '700' },
  meta: { fontSize: 13, color: colors.inkMuted, marginTop: spacing.xs },
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
  content: { flex: 1, gap: 2, paddingRight: spacing.sm },
  meta: { alignItems: 'flex-end', gap: 2 },
})

const styles = StyleSheet.create({
  imageWrap: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.ink,
  },
  headerRow: { marginBottom: 2 },
  name: { fontSize: 22, lineHeight: 28 },
  block: { marginTop: spacing.xs },
  sharedLabel: { color: colors.ink, marginBottom: 2 },
  sharedNames: { fontWeight: '700', fontSize: 15 },
  alsoLabel: { color: colors.inkMuted, marginBottom: 2 },
  metaText: { flex: 1, paddingRight: spacing.sm },
  matchLine: { color: colors.inkMuted, textAlign: 'right' },
  matchValue: { color: colors.accent, fontWeight: '800' },
})
