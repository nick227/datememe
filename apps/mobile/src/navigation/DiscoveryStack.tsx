import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { DiscoveryScreen } from '../features/discovery/screens/DiscoveryScreen'
import { ProfileDetailScreen } from '../features/discovery/screens/ProfileDetailScreen'
import type { DiscoveryStackParamList } from './types'

const Stack = createNativeStackNavigator<DiscoveryStackParamList>()

export function DiscoveryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Discovery" component={DiscoveryScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
    </Stack.Navigator>
  )
}
