import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme'

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
    <SafeAreaView testID={testID} style={styles.safe} edges={['left', 'right']}>
      <View
        style={[
          styles.container,
          padded && styles.padded,
          width !== 'full' && { alignSelf: 'center', width: '100%', maxWidth: MAX_WIDTH[width] },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
})
