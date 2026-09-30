import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { RankingsScreen } from '../features/rankings/screens/RankingsScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import type { RankingsStackParamList } from './types'

const Stack = createNativeStackNavigator<RankingsStackParamList>()

export function RankingsStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Rankings" component={RankingsScreen} />
    </Stack.Navigator>
  )
}
