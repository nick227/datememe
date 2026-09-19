import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CategoriesScreen } from '../features/lists/screens/CategoriesScreen'
import { ListBuilderScreen } from '../features/lists/screens/ListBuilderScreen'
import type { CategoriesStackParamList } from './types'

const Stack = createNativeStackNavigator<CategoriesStackParamList>()

export function CategoriesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="ListBuilder" component={ListBuilderScreen} />
    </Stack.Navigator>
  )
}
