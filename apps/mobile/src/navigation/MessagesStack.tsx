import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ConversationsScreen } from '../features/messaging/screens/ConversationsScreen'
import { ConversationScreen } from '../features/messaging/screens/ConversationScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import type { MessagesStackParamList } from './types'

const Stack = createNativeStackNavigator<MessagesStackParamList>()

export function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
    </Stack.Navigator>
  )
}
