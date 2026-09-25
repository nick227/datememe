import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Box, spacing } from '../../theme'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
import { CardSkeleton } from './CardSkeleton'
import type { ContentUnit, StructureState } from './types'

type Props = {
  testID?: string
  title?: string | null
  items: ContentUnit[]
  state: StructureState
  // A wide personal-history rail ("Your lists") should look and feel
  // heavier than a narrow "Add more" nudge rail — a real width difference,
  // not just a different label (proposal correction: Rail must look and
  // behave like a rail, not a row of grid cards at the same scale).
  cardWidth?: number
  zone?: string
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

const DEFAULT_CARD_WIDTH = 200

const handleWheel = (event: any) => {
  if (Platform.OS !== 'web') return
  event.currentTarget.scrollLeft += event.nativeEvent?.deltaY ?? event.deltaY ?? 0
}

export function Rail({ testID, title, items, state, cardWidth = DEFAULT_CARD_WIDTH, zone, onPressItem, onRetry }: Props) {
  const cardStyle = { width: cardWidth }
  return (
    <Box testID={testID} marginBottom="section" width="100%" overflow="hidden">
      {title ? (
        <Box marginBottom="md" paddingHorizontal="lg">
          <Typography variant="heading">{title}</Typography>
        </Box>
      ) : null}

      {state === 'loading' ? (
        <RailSkeleton cardWidth={cardWidth} />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        // Cards flow edge-to-edge of the canvas and the last one is visibly
        // clipped — that's what reads as "rail" rather than "grid that scrolls."
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.viewport}
          contentContainerStyle={styles.scroll}
          {...(Platform.OS === 'web' ? { onWheel: handleWheel } as any : {})}
        >
          {items.map((unit, index) => (
            <Animated.View key={unit.id} entering={FadeInDown.duration(400).delay(index * 50)} style={cardStyle}>
              <ContentUnitCard unit={unit} variant="rail" zone={zone} onPress={() => onPressItem(unit)} />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </Box>
  )
}

function RailSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <ScrollView style={styles.viewport} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: cardWidth }}>
          <CardSkeleton compact />
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  viewport: {
    width: '100%',
    minWidth: 0,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
})
