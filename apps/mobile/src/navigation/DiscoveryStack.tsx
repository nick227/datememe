import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { DiscoverFeedScreen } from '../features/discovery/screens/DiscoverFeedScreen'
import { QuickPicksScreen } from '../features/discovery/screens/QuickPicksScreen'
import { ProfileDetailScreen } from '../features/discovery/screens/ProfileDetailScreen'
import type { DiscoveryStackParamList } from './types'

const Stack = createNativeStackNavigator<DiscoveryStackParamList>()

export function DiscoveryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Discover" component={DiscoverFeedScreen} />
      <Stack.Screen name="QuickPicks" component={QuickPicksScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
    </Stack.Navigator>
  )
}
