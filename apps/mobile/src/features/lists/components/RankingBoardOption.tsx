import { Pressable, StyleSheet, View } from 'react-native'
import { GripVertical, X, ChevronUp, ChevronDown } from 'lucide-react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Typography } from '../../../ui/Typography'
import { colors, radius, spacing } from '../../../theme'

const ITEM_HEIGHT = 64

type Props = {
  testID?: string
  totalItems: number
  rank: number
  name: string
  imageUrl?: string | null
  onRemove: () => void
  onReorder?: (newRank: number) => void
}

export function RankingBoardOption({ testID, rank, totalItems, name, onRemove, onReorder }: Props) {
  const isDragging = useSharedValue(false)
  const translationY = useSharedValue(0)
  const startRank = useSharedValue(rank)

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true
      startRank.value = rank
    })
    .onUpdate((e) => {
      translationY.value = e.translationY
    })
    .onEnd((e) => {
      const rankDelta = Math.round(e.translationY / ITEM_HEIGHT)
      const newRank = Math.min(totalItems, Math.max(1, startRank.value + rankDelta))
      if (newRank !== rank && onReorder) {
        runOnJS(onReorder)(newRank)
      }
    })
    .onFinalize(() => {
      isDragging.value = false
      translationY.value = withSpring(0)
    })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translationY.value }],
      zIndex: isDragging.value ? 100 : 1,
      elevation: isDragging.value ? 5 : 0,
      shadowOpacity: isDragging.value ? 0.2 : 0,
      backgroundColor: '#F5F6F8',
    }
  })

  return (
    <Animated.View testID={testID} style={[styles.container, animatedStyle]}>
      <Typography variant="heading" style={styles.rankText}>
        {String(rank).padStart(2, '0')}
      </Typography>

      {/* Title */}
      <Typography variant="body" style={styles.name} numberOfLines={1}>
        {name}
      </Typography>

      <View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move ${name} up`}
          disabled={rank === 1} onPress={() => onReorder?.(rank - 1)} style={styles.arrow}>
          <ChevronUp size={16} color={rank === 1 ? colors.border : colors.inkMuted} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Move ${name} down`}
          disabled={rank === totalItems} onPress={() => onReorder?.(rank + 1)} style={styles.arrow}>
          <ChevronDown size={16} color={rank === totalItems ? colors.border : colors.inkMuted} />
        </Pressable>
      </View>
      <GestureDetector gesture={panGesture}>
        <View testID={testID ? `${testID}.drag` : undefined} style={styles.dragHandle}>
          <GripVertical size={18} color={colors.inkMuted} />
        </View>
      </GestureDetector>
      {/* Remove Control */}
      <Pressable testID={testID ? `${testID}.remove` : undefined} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} onPress={onRemove} style={styles.removeButton}>
        <X size={20} color={colors.inkMuted} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: radius.sm, paddingHorizontal: spacing.xs, gap: spacing.xs },
  rankText: { width: 40, textAlign: 'center', color: colors.accent, fontSize: 16 },
  name: { flex: 1, color: colors.ink, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  arrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 24, height: 48, alignItems: 'center', justifyContent: 'center' },
  removeButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
})
