import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { borderWidth, colors, radius, spacing, type } from '../theme'
import { hapticLight } from '../lib/haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type Props = {
  testID?: string
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  icon?: ReactNode
}

export function Button({ testID, label, onPress, disabled, loading, variant = 'primary', icon }: Props) {
  const isDisabled = disabled || loading
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    }
  })

  const handlePressIn = () => {
    if (isDisabled) return
    scale.value = withSpring(0.96, { damping: 12, stiffness: 200 })
    hapticLight()
  }

  const handlePressOut = () => {
    if (isDisabled) return
    scale.value = withSpring(1, { damping: 12, stiffness: 200 })
  }

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.white} />
      ) : (
        <View style={icon ? styles.contentRow : undefined}>
          {icon}
          <Text
            style={[
              type.button,
              variant === 'secondary' && { color: colors.primary },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
})
