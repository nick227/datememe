import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CategoriesScreen } from '../features/lists/screens/CategoriesScreen'
import { ListBuilderScreen } from '../features/lists/screens/ListBuilderScreen'
import { PollResultsScreen } from '../features/rankings/screens/PollResultsScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import { pollScreenId } from './openPoll'
import type { CategoriesStackParamList } from './types'

const Stack = createNativeStackNavigator<CategoriesStackParamList>()

export function CategoriesStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="ListBuilder" component={ListBuilderScreen} getId={pollScreenId} />
      <Stack.Screen name="PollResults" component={PollResultsScreen} getId={pollScreenId} />
    </Stack.Navigator>
  )
}
