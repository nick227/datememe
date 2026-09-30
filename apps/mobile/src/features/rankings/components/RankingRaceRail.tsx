import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { SmartImage } from '../../../ui/content/SmartImage'
import { colors, spacing } from '../../../theme'
import type { ContentUnit } from '../../../ui/content/types'

type Props = {
  testID?: string
  title?: string | null
  items: ContentUnit[]
  onPressItem: (unit: ContentUnit) => void
}

const COVER_W = 72
const COVER_H = 96

const handleWheel = (event: { currentTarget: { scrollLeft: number }; nativeEvent?: { deltaY?: number }; deltaY?: number }) => {
  if (Platform.OS !== 'web') return
  event.currentTarget.scrollLeft += event.nativeEvent?.deltaY ?? event.deltaY ?? 0
}

export function RankingRaceRail({ testID, title, items, onPressItem }: Props) {
  if (!items.length) return null
  return (
    <View testID={testID} style={styles.section}>
      {title ? <Typography variant="heading" style={styles.heading}>{title}</Typography> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        {...(Platform.OS === 'web' ? { onWheel: handleWheel } as object : {})}
      >
        {items.map((unit) => (
          <Pressable
            key={unit.id}
            testID={testID ? `${testID}.item.${unit.id}` : undefined}
            style={styles.card}
            onPress={() => onPressItem(unit)}
            accessibilityRole="button"
            accessibilityLabel={unit.title}
          >
            <SmartImage uri={unit.imageCardUrl || unit.imageUrl} fallbackText={unit.title} width={COVER_W} height={COVER_H} style={styles.cover} />
            <View style={styles.copy}>
              <Typography variant="heading" numberOfLines={2} style={styles.title}>{unit.title}</Typography>
              {unit.subtitle ? <Typography variant="bodyMuted" numberOfLines={3} style={styles.ranks}>{unit.subtitle}</Typography> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  heading: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: {
    width: 248,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#F7F7F7',
  },
  cover: { borderRadius: 4, backgroundColor: colors.surfaceMuted },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 16 },
  ranks: { fontSize: 13, lineHeight: 18 },
})
