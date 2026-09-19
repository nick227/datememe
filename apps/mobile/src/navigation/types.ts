export type AuthStackParamList = {
  Login: undefined
  Register: undefined
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
  Discovery: undefined
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
}
