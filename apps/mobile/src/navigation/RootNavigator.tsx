import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useCurrentUser } from '@project/sdk'
import { AuthStack } from './AuthStack'
import { MainStack } from './MainStack'
import { colors } from '../theme'

export function RootNavigator() {
  const me = useCurrentUser()

  if (me.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return <NavigationContainer>{me.data ? <MainStack /> : <AuthStack />}</NavigationContainer>
}
