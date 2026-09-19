import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ConversationsScreen } from '../features/messaging/screens/ConversationsScreen'
import { ConversationScreen } from '../features/messaging/screens/ConversationScreen'
import type { MessagesStackParamList } from './types'

const Stack = createNativeStackNavigator<MessagesStackParamList>()

export function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
    </Stack.Navigator>
  )
}
