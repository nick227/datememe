import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CategoriesScreen } from '../features/lists/screens/CategoriesScreen'
import { ListBuilderScreen } from '../features/lists/screens/ListBuilderScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import type { CategoriesStackParamList } from './types'

const Stack = createNativeStackNavigator<CategoriesStackParamList>()

export function CategoriesStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="ListBuilder" component={ListBuilderScreen} />
    </Stack.Navigator>
  )
}
