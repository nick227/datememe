import { ScrollView, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
import { spacing } from '../../theme'
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
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

const DEFAULT_CARD_WIDTH = 200

export function Rail({ testID, title, items, state, cardWidth = DEFAULT_CARD_WIDTH, onPressItem, onRetry }: Props) {
  const cardStyle = { width: cardWidth }
  return (
    <View testID={testID} style={styles.section}>
      {title ? (
        <Typography variant="heading" style={styles.heading}>
          {title}
        </Typography>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {items.map((unit) => (
            <View key={unit.id} style={cardStyle}>
              <ContentUnitCard unit={unit} variant="rail" onPress={() => onPressItem(unit)} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

function RailSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} variant="rect" width={cardWidth} height={cardWidth * 1.3} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.section },
  heading: { marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
})
