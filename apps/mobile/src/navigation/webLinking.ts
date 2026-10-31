import { getPathFromState, type LinkingOptions } from '@react-navigation/native'
import type { MainStackParamList } from './types'

// Stable, shareable browser paths. Category slugs are already stored by the API;
// a profile's immutable ID remains in the URL so display-name changes do not break links.
// Nested poll routes outside Lists retain their originating tab for native-style Back.
const pollRoutes = {
  ListBuilder: 'polls/:categorySlug',
  PollResults: 'polls/:categorySlug/results',
}

export const webLinking: LinkingOptions<MainStackParamList> = {
  prefixes: [],
  // Discovery cards carry transient ranking insights and match metadata in params.
  // Keep them in navigation state, but never serialize them into shareable URLs.
  getPathFromState(state, options) {
    const stripTransientProfileParams = (value: any): any => ({
      ...value,
      routes: value.routes.map((route: any) => ({
        ...route,
        params: route.name === 'ProfileDetail' && route.params
          ? { profileId: route.params.profileId, displayName: route.params.displayName }
          : route.params,
        state: route.state ? stripTransientProfileParams(route.state) : undefined,
      })),
    })
    return getPathFromState(stripTransientProfileParams(state), options)
  },
  config: {
    screens: {
      Tabs: {
        screens: {
          Lists: {
            initialRouteName: 'Categories',
            screens: {
              Categories: '',
              ...pollRoutes,
            },
          },
          Rankings: {
            path: 'rankings',
            initialRouteName: 'Rankings',
            screens: {
              Rankings: '',
              ListBuilder: 'polls/:categorySlug',
              PollResults: 'polls/:categorySlug/results',
            },
          },
          Discover: {
            path: 'discover',
            initialRouteName: 'Discover',
            screens: {
              Discover: '',
              QuickPicks: 'quick-picks',
              ProfileDetail: {
                path: 'people/:profileId/:displayName?',
                stringify: {
                  displayName: (name: string) =>
                    (name || 'member').normalize('NFKD').toLowerCase()
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'member',
                },
              },
              ListBuilder: 'polls/:categorySlug',
              PollResults: 'polls/:categorySlug/results',
            },
          },
          Messages: {
            path: 'messages',
            initialRouteName: 'Conversations',
            screens: {
              Conversations: '',
              Conversation: ':conversationId',
              Paywall: 'premium',
              ListBuilder: 'polls/:categorySlug',
              PollResults: 'polls/:categorySlug/results',
            },
          },
          ProfileTab: {
            path: 'me',
            initialRouteName: 'Profile',
            screens: {
              Profile: '',
              EditProfile: 'edit',
              Account: 'account',
              Paywall: 'premium',
              VerifyEmail: 'verify-email',
              Admin: 'admin',
              ListBuilder: 'polls/:categorySlug',
              PollResults: 'polls/:categorySlug/results',
            },
          },
        },
      },
    },
  } as LinkingOptions<MainStackParamList>['config'] & { screens: any },
}
