import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { SmartImage } from '../../../ui/content/SmartImage'
import { colors, spacing } from '../../../theme'

export type RelatedRanking = {
  slug: string
  shortLabel: string
  imageUrl?: string | null
  imageCardUrl?: string | null
  topPickName: string
}

type Props = {
  items: RelatedRanking[]
  onOpen: (item: RelatedRanking) => void
}

const CARD_WIDTH = 104
const CARD_HEIGHT = 138

const handleWheel = (event: { currentTarget: { scrollLeft: number }; nativeEvent?: { deltaY?: number }; deltaY?: number }) => {
  if (Platform.OS !== 'web') return
  event.currentTarget.scrollLeft += event.nativeEvent?.deltaY ?? event.deltaY ?? 0
}

export function RelatedRankings({ items, onOpen }: Props) {
  if (!items.length) return null
  return (
    <View testID="poll-results.related" style={styles.section}>
      <Typography variant="label" style={styles.kicker}>Keep browsing</Typography>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        {...(Platform.OS === 'web' ? { onWheel: handleWheel } as object : {})}
      >
        {items.map((item) => (
          <Pressable
            key={item.slug}
            testID={`poll-results.related.${item.slug}`}
            style={styles.card}
            onPress={() => onOpen(item)}
            accessibilityRole="button"
            accessibilityLabel={item.shortLabel}
          >
            <SmartImage uri={item.imageCardUrl || item.imageUrl} fallbackText={item.shortLabel} width={CARD_WIDTH} height={CARD_HEIGHT} style={styles.image} />
            <Typography numberOfLines={2} style={styles.title}>{item.shortLabel}</Typography>
            <Typography numberOfLines={1} style={styles.top}>#1 {item.topPickName}</Typography>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  kicker: { marginBottom: spacing.md, letterSpacing: 1 },
  row: { gap: spacing.md },
  card: { width: CARD_WIDTH, gap: spacing.xs },
  image: { borderRadius: 6, backgroundColor: colors.surfaceMuted },
  title: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  top: { fontSize: 12, lineHeight: 16, color: colors.inkMuted },
})
