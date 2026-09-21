import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { RankingBoardOption } from './RankingBoardOption'
import { Typography } from '../../../ui/Typography'
import { colors, radius, spacing } from '../../../theme'

export type PickedItem = {
  entityId: string
  rank: number
  name: string
  imageUrl?: string | null
}

type RankingBoardProps = {
  items: PickedItem[]
  maxItems: number
  onRemove: (entityId: string) => void
  onReorder?: (from: number, to: number) => void // Placeholder for v2 DND
}

export function RankingBoard({ items, maxItems, onRemove, onReorder }: RankingBoardProps) {
  // Pad the list up to maxItems
  const slots = Array.from({ length: maxItems }).map((_, index) => {
    const rank = index + 1
    const item = items.find((i) => i.rank === rank)
    return { rank, item }
  })

  return (
    <View style={styles.container}>
      <Typography variant="heading" style={styles.title}>
        Your top {maxItems}
      </Typography>
      
      <ScrollView style={styles.board} showsVerticalScrollIndicator={false}>
        {slots.map(({ rank, item }) => {
          if (item) {
            return (
              <Animated.View
                key={`filled-${item.entityId}`}
                layout={LinearTransition.duration(200)}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
              >
                <RankingBoardOption
                  testID={`list-builder.item.${item.entityId}`}
                  rank={rank}
                  name={item.name}
                  imageUrl={item.imageUrl}
                  onRemove={() => onRemove(item.entityId)}
                  onReorder={(newRank) => onReorder?.(rank - 1, newRank - 1)}
                />
              </Animated.View>
            )
          }

          return (
            <Animated.View 
              key={`empty-${rank}`} 
              style={styles.emptySlot}
              layout={LinearTransition.duration(200)}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
            >
              <Typography variant="label" style={styles.emptySlotRank}>
                {rank}
              </Typography>
              <View style={styles.emptySlotContent}>
                <Typography variant="body" style={styles.emptySlotText}>
                  Add your #{rank}
                </Typography>
              </View>
            </Animated.View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: spacing.md,
  },
  board: {
    gap: spacing.sm,
    maxHeight: 400, // Handle maxItems > 5
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56, // matching filled option height
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  emptySlotRank: {
    width: 32,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  emptySlotContent: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptySlotText: {
    color: colors.inkMuted,
  },
})
