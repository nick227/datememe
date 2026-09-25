import { Platform, View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AppTabs } from './AppTabs'
import { GlobalHeader } from '../ui/GlobalHeader'
import { defaultScreenOptions } from './defaultScreenOptions'
import type { MainStackParamList } from './types'

const Stack = createNativeStackNavigator<MainStackParamList>()

// Web: minHeight instead of flex so the page can grow past one viewport and
// let the browser's own scrollbar take over — see App.tsx's rootStyle comment.
const containerStyle = Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : { flex: 1 }

export function MainStack() {
  return (
    <View style={containerStyle}>
      <GlobalHeader showAvatar />
      <Stack.Navigator screenOptions={defaultScreenOptions}>
        <Stack.Screen name="Tabs" component={AppTabs} />
      </Stack.Navigator>
    </View>
  )
}
