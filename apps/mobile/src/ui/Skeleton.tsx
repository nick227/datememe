import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius } from '../theme'

type Props = {
  style?: ViewStyle | ViewStyle[]
  variant?: 'rect' | 'circular' | 'text'
  width?: number | string
  height?: number | string
}

export function Skeleton({ style, variant = 'rect', width, height }: Props) {
  const anim = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [anim])

  return (
    <Animated.View
      style={[
        styles.base,
        variant === 'circular' && { borderRadius: 999 },
        variant === 'text' && { borderRadius: radius.sm, height: 16 },
        width !== undefined && { width: width as any },
        height !== undefined && { height: height as any },
        { opacity: anim },
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
