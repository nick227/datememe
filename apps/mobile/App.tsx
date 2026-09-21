import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { enableScreens } from 'react-native-screens'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'

// react-native-screens renders each native-stack screen as an absolutely-
// positioned, viewport-filling layer (needed for native's gesture-driven
// transitions) — that ignores any minHeight change up the tree and is the
// real reason the browser scrollbar fix below wasn't taking effect. Web has
// no gesture transitions to optimize for, so disable it there only.
enableScreens(Platform.OS !== 'web')
import { queryClient } from './src/lib/queryClient'
import { initApiClient } from './src/lib/apiClient'
import { loadToken } from './src/lib/authToken'
import { RootNavigator } from './src/navigation/RootNavigator'
import { Logo } from './src/ui/Logo'
import { colors } from './src/theme'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'

export default function App() {
  const [isReady, setIsReady] = useState(false)
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })

  useEffect(() => {
    initApiClient()
    // The token must be in memory before the first SDK query fires, or /auth/me
    // goes out unauthenticated even when a valid token is sitting in SecureStore.
    loadToken().finally(() => setIsReady(true))
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'web') return
    // Expo's own web template injects `html,body{height:100%}` and, critically,
    // `body{overflow:hidden}` — deliberately routing all scrolling through
    // internal ScrollViews instead of the page. That's the actual cause of the
    // double-scrollbar look (every FlatList scrolls in its own bounded box).
    // Both rules match this override at equal specificity, so !important is
    // required to reliably win regardless of <style> tag injection order.
    const style = document.createElement('style')
    style.textContent = `
      html, body, #root { height: auto !important; min-height: 100% !important; }
      body { overflow: visible !important; }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (!isReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: colors.canvas }}>
        {fontsLoaded && <Logo size="md" />}
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={rootStyle}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

// Native: fill exactly one screen, internal ScrollViews scroll — the normal
// app UX. Web: only set a floor so short screens still fill the viewport;
// letting height grow past it is what hands scrolling to the browser itself.
const rootStyle = Platform.OS === 'web' ? ({ minHeight: '100vh', flex: 1, width: '100%' } as any) : { flex: 1 }
