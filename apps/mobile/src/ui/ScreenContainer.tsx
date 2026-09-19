import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme'
import { DecorativeBackground } from './DecorativeBackground'

const MAX_WIDTH = { narrow: 440, wide: 960 }

type Props = {
  children: ReactNode
  padded?: boolean
  width?: 'narrow' | 'wide' | 'full'
  decorated?: boolean
}

export function ScreenContainer({ children, padded = true, width = 'full', decorated = false }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {decorated && <DecorativeBackground />}
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
