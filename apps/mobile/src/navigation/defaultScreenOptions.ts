import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

export const defaultScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 250,
  gestureEnabled: true,
  gestureDirection: 'horizontal'
}
