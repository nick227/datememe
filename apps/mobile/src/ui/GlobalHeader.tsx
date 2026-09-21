import { Platform, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Logo } from './Logo'
import { HeaderAvatar } from './HeaderAvatar'
import { borderWidth, colors, spacing } from '../theme'

// The one persistent piece of chrome in the whole app — mounted once inside
// each stack (Auth/Main) so it survives every screen underneath it. Owns the
// top safe-area inset; ScreenContainer deliberately doesn't re-apply it.
// Web: since the page can now grow taller than one viewport (App.tsx), this
// needs `sticky` to stay put while the browser scrolls the rest of the page —
// on native it's just part of the normal fixed-height column, unchanged.
export function GlobalHeader({ showAvatar = false }: { showAvatar?: boolean }) {
  return (
    <SafeAreaView style={[styles.safe, webStickyStyle]} edges={['top', 'left', 'right']}>
      <View style={styles.bar}>
        <Logo size="sm" />
        {showAvatar ? <HeaderAvatar /> : <View style={{ width: 36, height: 36 }} />}
      </View>
    </SafeAreaView>
  )
}

const webStickyStyle = Platform.OS === 'web' ? ({ position: 'sticky', top: 0, zIndex: 10 } as any) : null

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thick,
    borderBottomColor: colors.border,
  },
})
