import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useQueryClient } from '@tanstack/react-query'
import { CategoriesStack } from './CategoriesStack'
import { DiscoveryStack } from './DiscoveryStack'
import { RankingsStack } from './RankingsStack'
import { MessagesStack } from './MessagesStack'
import { ProfileStack } from './ProfileStack'
import { Icon, type IconName } from '../ui/Icon'
import { colors } from '../theme'
import { useConversations, useCurrentUser } from '@project/sdk'

const Tab = createBottomTabNavigator()

const ICONS: Record<string, IconName> = {
  Lists: 'ListChecks',
  Rankings: 'Flame',
  Discover: 'User',
  Messages: 'MessageCircle',
}

export function AppTabs() {
  const queryClient = useQueryClient()
  const me = useCurrentUser()
  const { data: conversationsData } = useConversations()
  const initialRouteName = me.data?.profile?.onboardingStep === 0 ? 'ProfileTab' : 'Lists'
  
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
      initialRouteName={initialRouteName}
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'fade',
        tabBarShowLabel: false,
        popToTopOnBlur: true,
        tabBarButtonTestID: `tab.${route.name.toLowerCase()}`,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'ProfileTab') return null;
          return <Icon name={ICONS[route.name]} color={color} size={size} />;
        },
        // Web: the page can now grow past one viewport (App.tsx) — pin the
        // tab bar to the browser viewport instead of letting it scroll away
        // with the page content, matching native's fixed-bottom behavior.
        tabBarStyle: Platform.OS === 'web' ? ({ position: 'sticky', bottom: 0, zIndex: 10 } as any) : undefined,
      })}
    >
      <Tab.Screen name="Lists" component={CategoriesStack} />
      <Tab.Screen name="Discover" component={DiscoveryStack} />
      <Tab.Screen name="Rankings" component={RankingsStack} />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault()
            navigation.navigate('Messages', { screen: 'Conversations' })
          },
        })}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  )
}
