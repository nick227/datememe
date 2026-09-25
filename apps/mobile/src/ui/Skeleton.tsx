import { useEffect } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated'
import { colors, radius } from '../theme'

type Props = {
  style?: ViewStyle | ViewStyle[]
  variant?: 'rect' | 'circular' | 'text'
  width?: number | string
  height?: number | string
}

export function Skeleton({ style, variant = 'rect', width, height }: Props) {
  const anim = useSharedValue(0.3)

  useEffect(() => {
    anim.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: anim.value
  }))

  return (
    <Animated.View
      style={[
        styles.base,
        variant === 'circular' && { borderRadius: 999 },
        variant === 'text' && { borderRadius: radius.sm, height: 16 },
        width !== undefined && { width: width as any },
        height !== undefined && { height: height as any },
        animatedStyle,
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.border,
    borderRadius: radius.md,
  },
})
