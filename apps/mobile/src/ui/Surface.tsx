import React, { type ReactNode } from 'react'
import { StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { Box, colors, borderWidth, radius } from '../theme'
import { PressableScale } from './PressableScale'

export type SurfaceVariant = 'bordered' | 'raised' | 'interactive' | 'muted'

export const surfaceRecipes = StyleSheet.create({
  bordered: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  raised: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    // Extremely subtle shadow for minimal depth, matching the clean aesthetic
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  interactive: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 0,
  },
})

type Props = {
  variant?: SurfaceVariant
  radius?: keyof typeof radius
  style?: StyleProp<ViewStyle>
  children: ReactNode
  onPress?: () => void
  testID?: string
}

export function Surface({ variant = 'bordered', radius: r = 'grid', style, children, onPress, testID }: Props) {
  const containerStyle = [
    surfaceRecipes[variant],
    { borderRadius: radius[r], overflow: 'hidden' as const },
    style
  ]

  if (onPress) {
    return (
      <PressableScale
        testID={testID}
        onPress={onPress}
        style={containerStyle}
        scaleTo={0.98}
        duration={100}
        haptic="light"
      >
        {children}
      </PressableScale>
    )
  }

  return (
    <Box testID={testID} style={containerStyle}>
      {children}
    </Box>
  )
}
