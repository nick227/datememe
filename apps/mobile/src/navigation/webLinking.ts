import type { LinkingOptions } from '@react-navigation/native'
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
  config: {
    screens: {
      Tabs: {
        screens: {
          Lists: {
            screens: {
              Categories: '',
              ...pollRoutes,
            },
          },
          Rankings: {
            path: 'rankings',
            screens: {
              Rankings: '',
              ListBuilder: 'polls/:categorySlug',
              PollResults: 'polls/:categorySlug/results',
            },
          },
          Discover: {
            path: 'discover',
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
  },
}
