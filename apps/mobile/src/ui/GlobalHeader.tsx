import { Platform, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Logo } from './Logo'
import { HeaderAvatar } from './HeaderAvatar'
import { colors, Box } from '../theme'
import { useNavigation } from '@react-navigation/native'

// The one persistent piece of chrome in the whole app — mounted once inside
// each stack (Auth/Main) so it survives every screen underneath it. Owns the
// top safe-area inset; ScreenContainer deliberately doesn't re-apply it.
// Web: since the page can now grow taller than one viewport (App.tsx), this
// needs `sticky` to stay put while the browser scrolls the rest of the page —
// on native it's just part of the normal fixed-height column, unchanged.
export function GlobalHeader({ showAvatar = false }: { showAvatar?: boolean }) {
  const navigation = useNavigation()
  const goToLists = () => {
    navigation.navigate('Tabs', { screen: 'Lists' } as never)
  }
  return (
    <SafeAreaView style={[safeStyle, webStickyStyle]} edges={['top', 'left', 'right']}>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="xxl"
        paddingVertical="sm"
        maxWidth={1310}
        width="100%"
        style={{
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <Pressable onPress={goToLists}>
          <Logo size="sm" />
        </Pressable>
        {showAvatar ? <HeaderAvatar /> : <Box width={36} height={36} />}
      </Box>
    </SafeAreaView>
  )
}

const webStickyStyle = Platform.OS === 'web' ? ({ position: 'sticky', top: 0, zIndex: 10 } as any) : null

const safeStyle = { backgroundColor: colors.surface }
