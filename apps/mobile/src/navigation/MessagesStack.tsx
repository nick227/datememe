import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ConversationsScreen } from '../features/messaging/screens/ConversationsScreen'
import { ConversationScreen } from '../features/messaging/screens/ConversationScreen'
import { PaywallScreen } from '../features/profile/screens/PaywallScreen'
import { ListBuilderScreen } from '../features/lists/screens/ListBuilderScreen'
import { PollResultsScreen } from '../features/rankings/screens/PollResultsScreen'
import { defaultScreenOptions } from './defaultScreenOptions'
import { pollScreenId } from './openPoll'
import type { MessagesStackParamList } from './types'

const Stack = createNativeStackNavigator<MessagesStackParamList>()

export function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Conversation" component={ConversationScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
      <Stack.Screen name="ListBuilder" component={ListBuilderScreen} getId={pollScreenId} />
      <Stack.Screen name="PollResults" component={PollResultsScreen} getId={pollScreenId} />
    </Stack.Navigator>
  )
}
