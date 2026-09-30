import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { SmartImage } from './SmartImage'
import { colors, spacing } from '../../theme'
import type { ContentUnit } from './types'

type Props = {
  testID?: string
  title?: string | null
  items: ContentUnit[]
  onPressItem: (unit: ContentUnit) => void
}

const CARD_WIDTH = 88
const CARD_HEIGHT = 112

const handleWheel = (event: { currentTarget: { scrollLeft: number }; nativeEvent?: { deltaY?: number }; deltaY?: number }) => {
  if (Platform.OS !== 'web') return
  event.currentTarget.scrollLeft += event.nativeEvent?.deltaY ?? event.deltaY ?? 0
}

export function UserDatumRail({ testID, title, items, onPressItem }: Props) {
  if (!items.length) return null
  return (
    <View testID={testID} style={styles.section}>
      {title ? <Typography variant="heading" style={styles.title}>{title}</Typography> : null}
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
            <SmartImage uri={unit.imageUrl} fallbackText={unit.title} width={CARD_WIDTH} height={CARD_HEIGHT} style={styles.image} />
            <Typography numberOfLines={2} style={styles.label}>{unit.title}</Typography>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  title: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { width: CARD_WIDTH, gap: spacing.xs },
  image: { borderRadius: 6, backgroundColor: colors.surfaceMuted },
  label: { fontSize: 13, lineHeight: 17 },
})
