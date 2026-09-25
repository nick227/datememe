import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ProfileScreen } from '../features/profile/screens/ProfileScreen'
import { EditProfileScreen } from '../features/profile/screens/EditProfileScreen'
import { AccountScreen } from '../features/profile/screens/AccountScreen'
import { PaywallScreen } from '../features/profile/screens/PaywallScreen'
import { VerifyEmailScreen } from '../features/profile/screens/VerifyEmailScreen'
import { AdminStack } from './AdminStack'
import { defaultScreenOptions } from './defaultScreenOptions'
import type { ProfileStackParamList } from './types'

const Stack = createNativeStackNavigator<ProfileStackParamList>()

export function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="Admin" component={AdminStack} />
    </Stack.Navigator>
  )
}
