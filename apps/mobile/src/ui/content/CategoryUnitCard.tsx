import { StyleSheet, View , useWindowDimensions } from 'react-native'
import { Typography } from '../Typography'
import { ImageCredit } from './ImageCredit'
import { MetricRow } from './MetricRow'
import { CardShell } from './CardShell'
import { SmartImage } from './SmartImage'
import { MicroBadge } from './MicroBadge'
import { PressableScale } from '../PressableScale'
import { Box, borderWidth, colors, spacing } from '../../theme'
import { pickMetrics, RENDER_BUDGETS, type RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'


type Props = {
  unit: ContentUnit
  variant: RenderVariant
  zone?: string
  onPress: () => void
}

// Carries forward the shipped Lists card designs as variants of one generic
// renderer. Card type is determined by the structure variant, never by the
// presence of preview entities or images — deterministic MVP layout.
export function CategoryUnitCard({ unit, variant, zone, onPress }: Props) {
  // Results zone: always the compact poster card, regardless of variant.
  if (zone === 'results') {
    return <CompactGridCard unit={unit} onPress={onPress} />
  }

  // Variant-driven dispatch — no data-quality branching.
  if (variant === 'grid-square') {
    return <CompactGridCard unit={unit} onPress={onPress} />
  }
  if (variant === 'grid-dense') {
    return <DenseCard unit={unit} onPress={onPress} />
  }
  // River variant uses CompletedListCard when the unit has ranked preview
  // entities (the natural "list" presentation for a full-width row).
  if (variant === 'river' && unit.previewEntities?.length) {
    return <CompletedListCard unit={unit} onPress={onPress} />
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
    <CardShell testID={`categories.card.${unit.id}`} containerStyle={styles.compactCardOverwrite} onPress={onPress}>
      <CardShell.Media style={styles.compactImageWrap}>
        <SmartImage uri={imageUrl} fallbackText={unit.title} />
        {isComplete ? (
          <MicroBadge label="DONE" variant="neutral" position="top-left" />
        ) : inProgress ? (
          <MicroBadge label="IN PROGRESS" variant="accent" position="top-left" />
        ) : null}
      </CardShell.Media>
      <CardShell.Body style={styles.compactBody}>
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
      </CardShell.Body>
    </CardShell>
  )
}

function CompletedListCard({ unit, onPress }: { unit: ContentUnit; onPress: () => void }) {
  const items = unit.previewEntities ?? []
  const thumbnail = unit.imageUrl ?? items[0]?.imageUrl
  const isComplete = !!unit.relationship?.completed
  return (
    <CardShell testID={`categories.card.${unit.id}`} onPress={onPress}>
      {!isComplete ? (
        <Box marginBottom="xs" alignSelf="flex-start">
          <MicroBadge label="IN PROGRESS" variant="accent" />
        </Box>
      ) : null}
      <View style={styles.previewHeader}>
        <SmartImage uri={thumbnail} fallbackText={unit.title} width={32} height={32} />
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
    </CardShell>
  )
}

function StatCard({ unit, variant, onPress }: { unit: ContentUnit; variant: RenderVariant; onPress: () => void }) {
  const budget = RENDER_BUDGETS[variant]
  const metrics = pickMetrics(unit.metrics, variant)
  const isSpotlight = variant === 'spotlight'
  const hasImage = !!unit.imageUrl
  const { width } = useWindowDimensions()
  const isWide = width >= 768

  return (
    <CardShell testID={`categories.card.${unit.id}`} containerStyle={[isSpotlight && styles.spotlightCard, isSpotlight && isWide && styles.spotlightRow]} onPress={onPress}>
      {isSpotlight && isWide && unit.imageUrl ? (
        <SmartImage 
          uri={unit.imageUrl} 
          fallbackText={unit.title}
          style={styles.spotlightImageWide} 
        />
      ) : null}

      <CardShell.Body style={[isSpotlight && isWide && styles.spotlightBodyWide]}>
        <Typography variant={isSpotlight ? 'display' : 'heading'} style={styles.statTitle}>
          {unit.title}
        </Typography>
        {budget.subtitle && unit.subtitle ? (
          <Typography variant="bodyMuted" numberOfLines={2} style={styles.statPrompt}>
            {unit.subtitle}
          </Typography>
        ) : null}

        {unit.imageUrl && !(isSpotlight && isWide) ? (
          <SmartImage 
            uri={unit.imageUrl} 
            fallbackText={unit.title}
            style={[styles.coverImage, isSpotlight && styles.spotlightImage]} 
          />
        ) : null}

        <ImageCredit credit={unit.imageCredit} />

        <CardShell.Insight>
          {unit.entity ? (
            <View style={[styles.topPickRow, isSpotlight && styles.topPickRowLarge]}>
              <SmartImage 
                uri={unit.entity.imageUrl} 
                fallbackText={unit.entity.canonicalName}
                style={[styles.topPickImage, isSpotlight && styles.topPickImageLarge]} 
              />
              <Typography variant={isSpotlight ? 'heading' : 'body'} style={styles.topPickLabel} numberOfLines={2}>
                Most common #1: <Typography style={styles.bold}>{unit.entity.canonicalName}</Typography>
              </Typography>
            </View>
          ) : (
            <Typography variant="bodyMuted" style={{ fontStyle: 'italic' }}>
              No top pick ranked yet
            </Typography>
          )}
        </CardShell.Insight>

        <MetricRow metrics={metrics} />

        <CardShell.ActionRow>
          <Typography variant="label" style={styles.cta}>
            Rank yours →
          </Typography>
        </CardShell.ActionRow>
      </CardShell.Body>
    </CardShell>
  )
}

function DenseCard({ unit, onPress }: { unit: ContentUnit; onPress: () => void }) {
  const primary = pickMetrics(unit.metrics, 'grid-dense')[0]
  return (
    <PressableScale testID={`categories.card.${unit.id}`} style={styles.denseCard} onPress={onPress}>
      {unit.imageUrl ? <SmartImage uri={unit.imageUrl} fallbackText={unit.title} width={32} height={32} style={styles.previewThumb} /> : null}
      <ImageCredit credit={unit.imageCredit} />
      <Typography variant="body" style={styles.denseTitle} numberOfLines={2}>
        {unit.title}
      </Typography>
      <Typography variant="bodyMuted" style={styles.denseStat}>
        {primary ? `${primary.value} ${primary.label.toLowerCase()}` : 'New'}
      </Typography>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  // Reduced-border policy: a card carrying real imagery uses the photo's own
  // edge as its boundary instead of a drawn border (proposal correction —
  // borders are for text-only prompt cards, not decoration on every card).
  noBorder: { borderWidth: 0 },
  coverImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, marginBottom: spacing.md, backgroundColor: colors.surfaceMuted },
  spotlightCard: { maxHeight: 380 },
  spotlightImage: { aspectRatio: 2.5, maxHeight: 160 },
  spotlightRow: { flexDirection: 'row', alignItems: 'center', maxHeight: 380 },
  spotlightImageWide: { width: '45%', height: '100%', maxHeight: 380, aspectRatio: undefined },
  spotlightBodyWide: { width: '55%', paddingHorizontal: spacing.xl },
  statTitle: { marginBottom: spacing.xs },
  statPrompt: { marginBottom: spacing.md },
  bold: { fontWeight: '700' },
  topPickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topPickRowLarge: { gap: spacing.lg },
  topPickImage: { width: 24, height: 24, borderWidth: borderWidth.thin, borderColor: colors.ink },
  topPickImageLarge: { width: 80, height: 80, borderWidth: 0 },
  topPickLabel: { fontSize: 14, flex: 1 },
  cta: { color: colors.accent },

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

  // Compact "poster" grid card uses cardShell.baseCompact
  compactCardOverwrite: {
    // Only style overrides here, flex and border handled by baseCompact
  },
  compactImageWrap: { position: 'relative' },
  compactBody: {
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.ink,
    padding: spacing.md,
    gap: spacing.sm,
    flex: 1,
  },
  compactTitle: { fontSize: 18, lineHeight: 22, marginBottom: 0, fontWeight: '700' },
  compactMeta: { fontSize: 13 },
  compactDot: { color: colors.accent },
  denseStat: { fontSize: 12 },

  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  previewThumb: { width: 32, height: 32 },
  previewTitle: { flex: 1, color: colors.ink },
  previewItems: { gap: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewNumber: { width: 12, color: colors.inkMuted },
  previewName: { flex: 1, fontSize: 13 },
})
