import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { queryClient } from './src/lib/queryClient'
import { initApiClient } from './src/lib/apiClient'
import { loadToken } from './src/lib/authToken'
import { RootNavigator } from './src/navigation/RootNavigator'
import { Logo } from './src/ui/Logo'
import { colors } from './src/theme'
import {
  useFonts as usePlusJakartaSans,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import { useFonts as useBaloo2, Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2'

export default function App() {
  const [isReady, setIsReady] = useState(false)
  const [plusJakartaLoaded, plusJakartaError] = usePlusJakartaSans({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })
  const [baloo2Loaded, baloo2Error] = useBaloo2({ Baloo2_700Bold, Baloo2_800ExtraBold })
  const fontsLoaded = plusJakartaLoaded && baloo2Loaded
  const fontError = plusJakartaError || baloo2Error

  useEffect(() => {
    initApiClient()
    // The token must be in memory before the first SDK query fires, or /auth/me
    // goes out unauthenticated even when a valid token is sitting in SecureStore.
    loadToken().finally(() => setIsReady(true))
  }, [])

  if (!isReady || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: colors.canvas }}>
        {baloo2Loaded && <Logo size="md" />}
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
