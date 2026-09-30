import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '../../../ui/Icon'
import { Typography } from '../../../ui/Typography'
import { SmartImage } from '../../../ui/content/SmartImage'
import { colors, spacing } from '../../../theme'
import type { ContentUnit } from '../../../ui/content/types'

type Props = {
  testID?: string
  title: string
  imageUrl?: string | null
  reason?: string | null
  items: ContentUnit[]
  onOpen: () => void
}

function pointShare(unit: ContentUnit) {
  const value = unit.metrics?.find((item) => item.type === 'percentile')?.value
  return typeof value === 'number' ? `${value}%` : null
}

export function RankingPreview({ testID, title, imageUrl, reason, items, onOpen }: Props) {
  return (
    <View testID={testID} style={styles.block}>
      <Pressable testID={testID ? `${testID}.open` : undefined} onPress={onOpen} style={styles.head} accessibilityRole="button">
        <SmartImage uri={imageUrl} fallbackText={title} width={44} height={58} style={styles.cover} />
        <View style={styles.headText}>
          <Typography variant="heading" numberOfLines={2}>{title}</Typography>
          {reason ? <Typography variant="bodyMuted" numberOfLines={1}>{reason}</Typography> : null}
        </View>
      </Pressable>
      {items.map((unit) => (
        <Pressable key={unit.id} testID={testID ? `${testID}.row.${unit.rank}` : undefined} onPress={onOpen} style={styles.row} accessibilityRole="button">
          <Typography variant="label" style={styles.rank}>{unit.rank}</Typography>
          <Typography variant="body" style={styles.name} numberOfLines={1}>{unit.title}</Typography>
          <Typography variant="body" style={styles.share}>{pointShare(unit)}</Typography>
        </Pressable>
      ))}
      <Pressable testID={testID ? `${testID}.full` : undefined} onPress={onOpen} style={styles.full} accessibilityRole="button">
        <Typography variant="label" style={styles.fullText}>View full ranking</Typography>
        <Icon name="ChevronRight" size={16} color={colors.ink} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cover: { borderRadius: 4, backgroundColor: colors.surfaceMuted },
  headText: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 3 },
  rank: { width: 16, letterSpacing: 0, textTransform: 'none', color: colors.inkMuted },
  name: { flex: 1 },
  share: { fontVariant: ['tabular-nums'] },
  full: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  fullText: { color: colors.ink, letterSpacing: 0, textTransform: 'none' },
})
