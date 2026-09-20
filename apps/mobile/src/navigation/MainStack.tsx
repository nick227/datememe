import { View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AppTabs } from './AppTabs'
import { ProfileStack } from './ProfileStack'
import { GlobalHeader } from '../ui/GlobalHeader'
import type { MainStackParamList } from './types'

const Stack = createNativeStackNavigator<MainStackParamList>()

export function MainStack() {
  return (
    <View style={{ flex: 1 }}>
      <GlobalHeader showAvatar />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={AppTabs} />
        <Stack.Screen name="ProfileModal" component={ProfileStack} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </View>
  )
}
