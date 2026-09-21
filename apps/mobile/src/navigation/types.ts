export type AuthStackParamList = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
  ResetPassword: { email: string }
}

export type MainStackParamList = {
  Tabs: undefined
  ProfileModal: undefined
}

export type CategoriesStackParamList = {
  Categories: undefined
  ListBuilder: { categorySlug: string; shortLabel: string }
}

export type MatchInsight = { icon: string; title: string; description: string }

export type DiscoveryStackParamList = {
  Discover: undefined
  QuickPicks: undefined
  ProfileDetail: {
    profileId: string
    displayName: string
    matchPercentage?: number
    insights?: MatchInsight[]
  }
}

export type MessagesStackParamList = {
  Conversations: undefined
  Conversation: { conversationId: string; displayName: string }
}

export type ProfileStackParamList = {
  Profile: undefined
  EditProfile: undefined
  Account: undefined
  Paywall: undefined
  VerifyEmail: undefined
  Admin: undefined
}

// Nested inside ProfileStack's "Admin" screen (see MainStack's own
// Tabs -> AppTabs nesting for the same pattern). One entry per migrated
// apps/admin page — see CLAUDE.md's migration batches.
export type AdminStackParamList = {
  AdminDashboard: undefined
  AdminModeration: undefined
  AdminUsers: undefined
  AdminUserDetail: { userId: string }
  AdminMemberships: undefined
  AdminTaxonomy: undefined
  AdminTaxonomyType: { typeId: string }
  AdminTaxonomyEntity: {
    id: string
    entityTypeId: string
    canonicalName: string
    slug: string
    parentId: string | null
    status: string
  }
  AdminTaxonomyGenerate: { parentEntityId: string; parentEntityName: string; parentEntityTypeId: string }
  AdminLists: undefined
  AdminListDetail: { listId: string } | undefined
}
