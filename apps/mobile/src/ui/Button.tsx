import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { borderWidth, colors, radius, spacing, Box, Text } from '../theme'
import { PressableScale } from './PressableScale'

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
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      scaleTo={0.96}
      haptic="light"
      style={[
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.white} />
      ) : (
        <Box flexDirection={icon ? 'row' : undefined} alignItems={icon ? 'center' : undefined} gap={icon ? 'sm' : undefined}>
          {icon}
          <Text variant="button" color={variant === 'secondary' ? 'primary' : 'white'}>
            {label}
          </Text>
        </Box>
      )}
    </PressableScale>
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
})
