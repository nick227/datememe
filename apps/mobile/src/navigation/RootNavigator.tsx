import { ActivityIndicator, View } from 'react-native'
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native'
import { useCurrentUser } from '@project/sdk'
import { AuthStack } from './AuthStack'
import { MainStack } from './MainStack'
import { navigationRef } from './navigationRef'
import { colors } from '../theme'

// Keeps stack-transition backgrounds on-brand instead of React Navigation's
// default white flashing through before each screen's own content mounts.
const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.canvas, primary: colors.primary, card: colors.surface, text: colors.ink, border: colors.border },
}

export function RootNavigator() {
  const me = useCurrentUser()

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer 
      ref={navigationRef} 
      theme={navigationTheme}
      documentTitle={{
        formatter: (options, route) => {
          const baseTitle = 'datememe'
          const screenTitle = options?.title ?? route?.name
          return screenTitle ? `${screenTitle} | ${baseTitle}` : baseTitle
        }
      }}
    >
      {me.data ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  )
}
