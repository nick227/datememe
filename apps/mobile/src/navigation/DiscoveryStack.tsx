import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { DiscoverFeedScreen } from '../features/discovery/screens/DiscoverFeedScreen'
import { QuickPicksScreen } from '../features/discovery/screens/QuickPicksScreen'
import { ProfileDetailScreen } from '../features/discovery/screens/ProfileDetailScreen'
import { ListBuilderScreen } from '../features/lists/screens/ListBuilderScreen'
import { PollResultsScreen } from '../features/rankings/screens/PollResultsScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import { pollScreenId } from './openPoll'
import type { DiscoveryStackParamList } from './types'

const Stack = createNativeStackNavigator<DiscoveryStackParamList>()

export function DiscoveryStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Discover" component={DiscoverFeedScreen} />
      <Stack.Screen name="QuickPicks" component={QuickPicksScreen} />
      <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
      <Stack.Screen name="ListBuilder" component={ListBuilderScreen} getId={pollScreenId} />
      <Stack.Screen name="PollResults" component={PollResultsScreen} getId={pollScreenId} />
    </Stack.Navigator>
  )
}
