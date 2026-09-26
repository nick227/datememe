import { Image, Pressable, StyleSheet, View } from 'react-native'
import { GripVertical, X, ImageIcon } from 'lucide-react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Typography } from '../../../ui/Typography'
import { colors, radius, spacing } from '../../../theme'

const ITEM_HEIGHT = 56

type Props = {
  testID?: string
  rank: number
  name: string
  imageUrl?: string | null
  onRemove: () => void
  onReorder?: (newRank: number) => void
}

export function RankingBoardOption({ testID, rank, name, imageUrl, onRemove, onReorder }: Props) {
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
      
      const rankDelta = Math.round(e.translationY / ITEM_HEIGHT)
      const newRank = Math.max(1, startRank.value + rankDelta)
      
      if (newRank !== rank && onReorder) {
        // Optimistically update the parent array which will trigger Reanimated layout transitions for siblings
        runOnJS(onReorder)(newRank)
        // Reset translation and start rank to absorb the layout shift smoothly
        startRank.value = newRank
        translationY.value = e.translationY - (rankDelta * ITEM_HEIGHT)
      }
    })
    .onEnd(() => {
      isDragging.value = false
      translationY.value = withSpring(0)
    })

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translationY.value }],
      zIndex: isDragging.value ? 100 : 1,
      elevation: isDragging.value ? 5 : 0,
      shadowOpacity: isDragging.value ? 0.2 : 0,
      backgroundColor: colors.surface,
    }
  })

  return (
    <Animated.View testID={testID} style={[styles.container, animatedStyle]}>
      {/* Drag handle */}
      <GestureDetector gesture={panGesture}>
        <View testID={testID ? `${testID}.drag` : undefined} style={styles.dragHandle}>
          <GripVertical size={20} color={colors.inkMuted} />
        </View>
      </GestureDetector>

      {/* Numeric Rank */}
      <Typography variant="heading" style={styles.rankText}>
        {rank}
      </Typography>

      {/* Thumbnail */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <ImageIcon size={20} color={colors.inkMuted} opacity={0.3} />
        </View>
      )}

      {/* Title */}
      <Typography variant="body" style={styles.name} numberOfLines={1}>
        {name}
      </Typography>

      {/* Remove Control */}
      <Pressable testID={testID ? `${testID}.remove` : undefined} onPress={onRemove} style={styles.removeButton}>
        <X size={20} color={colors.inkMuted} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  dragHandle: {
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  rankText: {
    width: 32,
    textAlign: 'center',
    color: colors.primary,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    marginHorizontal: spacing.sm,
  },
  thumbnailPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    marginHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    flex: 1,
    color: colors.ink,
  },
  removeButton: {
    padding: spacing.sm,
  },
})
