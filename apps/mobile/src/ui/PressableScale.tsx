import type { ReactNode } from 'react'
import { Pressable, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated'
import { hapticLight, hapticSelection } from '../lib/haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type Props = {
  children: ReactNode | ((state: { pressed: boolean }) => ReactNode)
  onPress?: () => void
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>)
  testID?: string
  scaleTo?: number
  duration?: number
  haptic?: 'light' | 'selection' | 'none'
  disabled?: boolean
}

export function PressableScale({ 
  children, 
  onPress, 
  style, 
  testID, 
  scaleTo = 0.98, 
  duration = 100, 
  haptic = 'light',
  disabled
}: Props) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }))

  const handlePressIn = () => {
    if (!onPress || disabled) return
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(scaleTo, { duration, easing: Easing.out(Easing.quad) })
    if (haptic === 'light') hapticLight()
    else if (haptic === 'selection') hapticSelection()
  }

  const handlePressOut = () => {
    if (!onPress || disabled) return
    // slightly longer release looks more natural
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withTiming(1, { duration: duration * 1.5, easing: Easing.out(Easing.quad) })
  }

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={typeof style === 'function' 
        ? (state) => [style(state), animatedStyle] 
        : [style, animatedStyle]}
    >
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </AnimatedPressable>
  )
}
