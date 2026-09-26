import { Image, StyleSheet, View, TouchableOpacity } from 'react-native'
import { ImageIcon, ChevronRight } from 'lucide-react-native'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'

type Props = {
  // If list is passed, it represents a completed list (yours or someone else's)
  list?: any
  // If category is passed, it represents an uncompleted list
  category?: any
  
  // Overrides for contextual metadata
  matchContext?: string
  
  onPress?: () => void
  style?: any
}

function formatCount(num: number) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

export function PreviewListCard({ list, category, matchContext, onPress, style }: Props) {
  const isCompleted = !!list
  
  // Determine data sources
  const cat = category ?? list?.category
  const categoryTitle = cat?.shortLabel ?? 'List'
  const participationCount = cat?.popularityCount ?? 0
  const prompt = cat?.prompt ?? `Rank the ${categoryTitle.toLowerCase()} you love most.`

  let thumbnail = null
  let subtitle = prompt
  let actionLabel = 'Rank yours'

  if (isCompleted) {
    const sortedItems = list.items?.slice().sort((a: any, b: any) => a.rank - b.rank)
    thumbnail = sortedItems?.[0]?.entity?.imageUrl
    
    const topPickName = sortedItems?.[0]?.entity?.canonicalName
    if (topPickName) {
      subtitle = `Your #1: ${topPickName}`
    }
    actionLabel = 'View rankings'
  } else {
    // For uncompleted, could use the category's top entity image if available
    thumbnail = cat?.topPickEntity?.imageUrl
  }

  // Build metadata string
  const rankedStr = `${formatCount(participationCount)} ranked`
  const metadataPieces = [rankedStr]
  
  if (matchContext) {
    metadataPieces.push(matchContext)
  } else if (!isCompleted && cat?.topPickEntity?.canonicalName) {
    metadataPieces.push(`Most common #1: ${cat.topPickEntity.canonicalName}`)
  }

  const metadataText = metadataPieces.join(' · ')

  return (
    <TouchableOpacity 
      style={[styles.card, style]} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
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
          <Typography variant="label" numberOfLines={1} style={styles.title}>
            {categoryTitle}
          </Typography>
          <Typography variant="body" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Typography>
        </View>
      </View>

      <Typography variant="bodyMuted" style={styles.metadata}>
        {metadataText}
      </Typography>

      <View style={styles.ctaRow}>
        <Typography variant="label" style={styles.ctaText}>
          {actionLabel}
        </Typography>
        <ChevronRight size={16} color={colors.primary} />
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
  subtitle: {
    color: colors.inkMuted,
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
