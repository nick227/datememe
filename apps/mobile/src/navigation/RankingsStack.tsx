import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { RankingsScreen } from '../features/rankings/screens/RankingsScreen'
import { ListBuilderScreen } from '../features/lists/screens/ListBuilderScreen'
import { PollResultsScreen } from '../features/rankings/screens/PollResultsScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import { pollScreenId } from './openPoll'
import type { RankingsStackParamList } from './types'

const Stack = createNativeStackNavigator<RankingsStackParamList>()

export function RankingsStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Rankings" component={RankingsScreen} />
      <Stack.Screen name="ListBuilder" component={ListBuilderScreen} getId={pollScreenId} />
      <Stack.Screen name="PollResults" component={PollResultsScreen} getId={pollScreenId} />
    </Stack.Navigator>
  )
}
