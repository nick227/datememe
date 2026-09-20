import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import { useQueryClient } from '@tanstack/react-query'
import { CategoriesStack } from './CategoriesStack'
import { DiscoveryStack } from './DiscoveryStack'
import { MessagesStack } from './MessagesStack'
import { Icon, type IconName } from '../ui/Icon'
import { colors } from '../theme'
import { useConversations } from '@project/sdk'

const Tab = createBottomTabNavigator()

const ICONS: Record<string, IconName> = {
  Lists: 'ListChecks',
  Discover: 'Flame',
  Messages: 'MessageCircle',
}

export function AppTabs() {
  const queryClient = useQueryClient()
  const { data: conversationsData } = useConversations()
  
  // Calculate total unread conversations. (We just want an indicator, so any unread > 0 is fine)
  const unreadCount = conversationsData?.pages.flatMap(p => p.data).filter(c => c.hasUnread).length || 0

  useEffect(() => {
    // When a notification is received while the app is foregrounded,
    // invalidate the conversations query to fetch fresh data.
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    })
    return () => subscription.remove()
  }, [queryClient])

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarIcon: ({ color, size }) => <Icon name={ICONS[route.name]} color={color} size={size} />,
      })}
    >
      <Tab.Screen name="Lists" component={CategoriesStack} />
      <Tab.Screen name="Discover" component={DiscoveryStack} />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
    </Tab.Navigator>
  )
}
