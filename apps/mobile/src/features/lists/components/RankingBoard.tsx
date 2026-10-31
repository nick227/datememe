import { Pressable, StyleSheet, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { RankingBoardOption } from './RankingBoardOption'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

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
  onAdd?: () => void
  onReorder?: (from: number, to: number) => void
}

export function RankingBoard({ items, maxItems, onRemove, onReorder, onAdd }: RankingBoardProps) {
  // Pad the list up to maxItems
  const slots = Array.from({ length: maxItems }).map((_, index) => {
    const rank = index + 1
    const item = items.find((i) => i.rank === rank)
    return { rank, item }
  })

  return (
    <View>
      <View style={styles.board}>
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
                  totalItems={items.length}
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
              <Pressable accessibilityRole="button" accessibilityLabel={`Add pick ${rank}`} onPress={onAdd} style={styles.emptySlotButton}>
              <Typography variant="label" style={styles.emptySlotRank}>
                {String(rank).padStart(2, '0')}
              </Typography>
              <View style={styles.emptySlotContent}>
                <Typography variant="body" style={styles.emptySlotText}>
                  {['Add your first pick', 'Add your second pick', 'Add your third pick', 'Add your fourth pick', 'Add your fifth pick'][rank - 1] ?? `Add pick ${rank}`}
                </Typography>
              </View>
              <Plus size={18} color={colors.inkMuted} />
              </Pressable>
            </Animated.View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  board: { gap: 8 },
  emptySlot: { height: 56, borderBottomWidth: 1, borderBottomColor: colors.border },
  emptySlotButton: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.sm },
  emptySlotRank: { width: 40, color: colors.inkMuted, textAlign: 'center', letterSpacing: 0 },
  emptySlotContent: { flex: 1 },
  emptySlotText: { color: colors.inkMuted, fontSize: 14 },
})
