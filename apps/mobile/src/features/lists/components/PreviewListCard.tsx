import { useMemo, useState } from 'react'
import { Image, Pressable, StyleSheet, View, TouchableOpacity } from 'react-native'
import { ImageIcon, ChevronRight, ChevronDown } from 'lucide-react-native'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'

type Props = {
  // If list is passed, it represents a completed list (yours or someone else's)
  list?: any
  // If category is passed, it represents an uncompleted list
  category?: any
  
  // Overrides for contextual metadata
  matchContext?: string
  
  // Someone else's list: whose name to use in the subtitle ("Sam's #1")
  ownerName?: string
  // Comparison mode (viewing another member's list). Pass the viewer's own
  // list for the same category, or `null` when the viewer hasn't taken it —
  // `undefined` means "don't compare" (e.g. your own profile).
  viewerList?: any | null

  // Tapping the title opens the list editor for this category.
  onPressTitle?: () => void
  // Shown under the expanded answers: this person's answers -> everyone's.
  onPressRankings?: () => void
  onPress?: () => void
  style?: any
}

function formatCount(num: number) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

// Client-side per-list agreement, shaped like the worker's per-item score
// (CalculateMatchesJob: `0.5 + 0.5 * rankSim` per shared pick) minus the
// rarity weighting — the viewer only has these two lists, not global usage
// stats. Normalised by the longer list so one shared pick out of ten
// doesn't read as 100%.
export function listMatchPercent(a: any, b: any): number {
  const aItems = a?.items ?? []
  const bItems = b?.items ?? []
  const longest = Math.max(aItems.length, bItems.length)
  if (!longest) return 0
  const ranked = (a?.category ?? b?.category)?.orderingMode !== 'UNRANKED'
  const span = Math.max(1, ((a?.category ?? b?.category)?.maxItems ?? longest) - 1)
  const bRanks = new Map<string, number>(bItems.map((i: any) => [i.entityId, i.rank]))
  let total = 0
  for (const item of aItems) {
    const otherRank = bRanks.get(item.entityId)
    if (otherRank == null) continue
    const rankSim = ranked ? Math.max(0, 1 - Math.abs(item.rank - otherRank) / span) : 1
    total += 0.5 + 0.5 * rankSim
  }
  return Math.round((total / longest) * 100)
}

export function PreviewListCard({ list, category, matchContext, ownerName, viewerList, onPressTitle, onPressRankings, onPress, style }: Props) {
  const isCompleted = !!list
  const [expanded, setExpanded] = useState(false)
  const comparing = viewerList !== undefined
  const viewerTook = comparing && !!viewerList?.items?.length
  const matchPct = useMemo(() => (viewerTook ? listMatchPercent(list, viewerList) : null), [viewerTook, list, viewerList])
  const viewerEntityIds = useMemo(() => new Set<string>((viewerList?.items ?? []).map((i: any) => i.entityId)), [viewerList])
  
  // Determine data sources
  const cat = category ?? list?.category
  const categoryTitle = cat?.shortLabel ?? 'List'
  const participationCount = cat?.popularityCount ?? 0
  const prompt = cat?.prompt ?? `Rank the ${categoryTitle.toLowerCase()} you love most.`

  let thumbnail = null
  let subtitle = prompt
  let actionLabel = 'Rank yours'

  const sortedItems: any[] = isCompleted ? list.items?.slice().sort((a: any, b: any) => a.rank - b.rank) ?? [] : []

  if (isCompleted) {
    thumbnail = sortedItems?.[0]?.entity?.imageUrl
    
    const topPickName = sortedItems?.[0]?.entity?.canonicalName
    if (topPickName) {
      subtitle = `${ownerName ? `${ownerName}'s` : 'Your'} #1: ${topPickName}`
    }
    actionLabel = expanded ? 'Hide answers' : 'View answers'
  } else {
    // For uncompleted, could use the category's top entity image if available
    thumbnail = cat?.topPick?.imageUrl
  }

  // Build metadata string
  const rankedStr = `${formatCount(participationCount)} ranked`
  const metadataPieces = [rankedStr]
  
  if (matchContext) {
    metadataPieces.push(matchContext)
  } else if (!isCompleted && cat?.topPick?.canonicalName) {
    metadataPieces.push(`Site #1: ${cat.topPick.canonicalName}`)
  }

  const metadataText = metadataPieces.join(' · ')

  // A completed list's card toggles its answers inline (a quick static view,
  // no navigation) unless the caller supplies its own onPress.
  const handlePress = onPress ?? (isCompleted ? () => setExpanded((v) => !v) : undefined)

  return (
    <TouchableOpacity 
      style={[styles.card, style]} 
      onPress={handlePress} 
      activeOpacity={handlePress ? 0.7 : 1}
      disabled={!handlePress}
    >
      <View style={styles.header}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback]}>
            <ImageIcon size={20} color={colors.primary} opacity={0.5} />
          </View>
        )}
        <View style={styles.titleStack}>
          <Pressable onPress={onPressTitle} disabled={!onPressTitle} hitSlop={6}>
            <Typography variant="label" numberOfLines={1} style={[styles.title, onPressTitle && styles.titleLink]}>
              {categoryTitle}
            </Typography>
          </Pressable>
          <Typography variant="body" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Typography>
        </View>
      </View>

      <Typography variant="bodyMuted" style={styles.metadata}>
        {metadataText}
      </Typography>

      {comparing && isCompleted ? (
        <View style={styles.compareRow}>
          {viewerTook ? (
            <>
              <Typography variant="label" style={styles.compareTaken}>You took this</Typography>
              <View style={styles.matchPill}>
                <Typography variant="label" style={styles.matchPillText}>{matchPct}% match</Typography>
              </View>
            </>
          ) : (
            <Pressable onPress={onPressTitle} disabled={!onPressTitle} hitSlop={6}>
              <Typography variant="label" style={styles.compareNotTaken}>
                You haven't taken this{onPressTitle ? ' — take it' : ''}
              </Typography>
            </Pressable>
          )}
        </View>
      ) : null}

      {expanded && isCompleted ? (
        <View style={styles.answers}>
          {sortedItems.map((item: any) => {
            const shared = viewerEntityIds.has(item.entityId)
            return (
              <View key={item.id} style={styles.answerRow}>
                <Typography variant="label" style={styles.answerRank}>{item.rank}</Typography>
                <Typography variant="body" numberOfLines={1} style={[styles.answerName, shared && styles.answerShared]}>
                  {item.entity?.canonicalName}
                </Typography>
                {shared ? <Typography variant="label" style={styles.answerSharedTag}>You too</Typography> : null}
              </View>
            )
          })}
          {onPressRankings ? (
            <Pressable testID="preview-list-card.site-rankings" style={styles.rankingsLink} onPress={onPressRankings} hitSlop={6}>
              <Typography variant="label" style={styles.ctaText}>View site rankings</Typography>
              <ChevronRight size={16} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.ctaRow}>
        <Typography variant="label" style={styles.ctaText}>
          {actionLabel}
        </Typography>
        {expanded ? <ChevronDown size={16} color={colors.primary} /> : <ChevronRight size={16} color={colors.primary} />}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  thumbnailFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleStack: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
  },
  titleLink: {
    textDecorationLine: 'underline',
  },
  subtitle: {
    color: colors.inkMuted,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
  },
  compareTaken: {
    color: colors.ink,
  },
  compareNotTaken: {
    color: colors.inkMuted,
  },
  matchPill: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  matchPillText: {
    color: colors.white,
  },
  answers: {
    gap: spacing.xs,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  answerRank: {
    width: 24,
    color: colors.ink,
  },
  answerName: {
    flex: 1,
  },
  answerShared: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  rankingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  answerSharedTag: {
    fontSize: 11,
    color: colors.ink,
  },
  metadata: {
    fontSize: 13,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  ctaText: {
    color: colors.primary,
  },
})
