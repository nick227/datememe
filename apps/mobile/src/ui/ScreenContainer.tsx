import type { ReactNode } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Box, colors } from '../theme'

const MAX_WIDTH = { narrow: 440, wide: 960 }

type Props = {
  testID?: string
  children: ReactNode
  padded?: boolean
  width?: 'narrow' | 'wide' | 'full'
}

export function ScreenContainer({ testID, children, padded = true, width = 'full' }: Props) {
  return (
    // 'top' is deliberately excluded — GlobalHeader (mounted once per stack,
    // above every screen) already owns the top safe-area inset.
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: colors.canvas }} edges={['left', 'right']}>
      <Box
        flex={1}
        paddingHorizontal={padded ? 'lg' : undefined}
        alignSelf={width !== 'full' ? 'center' : undefined}
        width={width !== 'full' ? '100%' : undefined}
        style={width !== 'full' ? { maxWidth: MAX_WIDTH[width] } : undefined}
      >
        {children}
      </Box>
    </SafeAreaView>
  )
}
