import { View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { LoginScreen } from '../features/auth/screens/LoginScreen'
import { RegisterScreen } from '../features/auth/screens/RegisterScreen'
import { GlobalHeader } from '../ui/GlobalHeader'
import type { AuthStackParamList } from './types'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export function AuthStack() {
  return (
    <View style={{ flex: 1 }}>
      <GlobalHeader />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
      </Stack.Navigator>
    </View>
  )
}
