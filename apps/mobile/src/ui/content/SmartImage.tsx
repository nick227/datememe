import { useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Box, colors } from '../../theme'
import { Typography } from '../Typography'

type Props = {
  uri?: string | null
  fallbackText?: string | null
  aspectRatio?: number
  width?: number | string
  height?: number | string
  round?: boolean
  testID?: string
  style?: any
}

export function SmartImage({ uri, fallbackText, aspectRatio = 16 / 9, width = '100%', height, round, testID, style }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const showFallback = !uri || error
  const initial = (fallbackText || '?').charAt(0).toUpperCase()
  
  // Scale typography down if it's a tiny thumbnail (like River row)
  const isTiny = height !== undefined && typeof height === 'number' && height <= 60
  
  const layoutStyle = {
    aspectRatio: height === undefined ? aspectRatio : undefined,
    width: width as any,
    height: height as any,
    borderRadius: round ? 9999 : 0
  }

  return (
    <Box testID={testID} position="relative" overflow="hidden" style={[layoutStyle, style]}>
      {showFallback ? (
        <Box 
          style={StyleSheet.absoluteFill}
          alignItems="center" 
          justifyContent="center"
          backgroundColor="primarySoft" // A very faint tonal wash
        >
          <Typography variant={isTiny ? 'heading' : 'display'} style={{ color: colors.inkMuted, opacity: 0.5 }}>
            {initial}
          </Typography>
        </Box>
      ) : (
        <>
          <Box style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceMuted }]} />
          <Animated.Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            entering={FadeIn.duration(400)}
          />
        </>
      )}
    </Box>
  )
}
