import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { CategoriesScreen } from '../features/lists/screens/CategoriesScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import type { CategoriesStackParamList } from './types'

const Stack = createNativeStackNavigator<CategoriesStackParamList>()

export function CategoriesStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Categories" component={CategoriesScreen} />
    </Stack.Navigator>
  )
}
