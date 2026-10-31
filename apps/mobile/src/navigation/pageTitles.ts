import type { AuthStackParamList, AppTabsParamList, CategoriesStackParamList, DiscoveryStackParamList, MessagesStackParamList, ProfileStackParamList, RankingsStackParamList, AdminStackParamList, MainStackParamList } from './types'

type ScreenName = keyof AuthStackParamList | keyof AppTabsParamList | keyof CategoriesStackParamList | keyof DiscoveryStackParamList | keyof MessagesStackParamList | keyof ProfileStackParamList | keyof RankingsStackParamList | keyof AdminStackParamList | keyof MainStackParamList

// Keep labels explicit so internal navigator names never become browser titles.
const titles = {
  Tabs: 'Home', Lists: 'Lists', Categories: 'Lists', Rankings: 'Rankings',
  Discover: 'Discover', QuickPicks: 'Quick Picks', Messages: 'Messages',
  Conversations: 'Messages', Conversation: 'Conversation',
  ProfileTab: 'My Profile', Profile: 'My Profile', ProfileDetail: 'Profile',
  EditProfile: 'Edit Profile', Account: 'Account', Paywall: 'Membership',
  VerifyEmail: 'Verify Email', Login: 'Log In', Register: 'Create Account',
  ForgotPassword: 'Forgot Password', ResetPassword: 'Reset Password',
  ListBuilder: 'Build Your List', PollResults: 'Poll Results',
  Admin: 'Admin', AdminDashboard: 'Admin Dashboard', AdminContent: 'Admin Content',
  AdminContentListDetail: 'Content Draft', AdminModeration: 'Moderation',
  AdminUsers: 'Users', AdminUserDetail: 'User Details', AdminMemberships: 'Memberships',
  AdminTaxonomy: 'Taxonomy', AdminTaxonomyType: 'Taxonomy Type',
  AdminTaxonomyEntity: 'Taxonomy Entity', AdminTaxonomyGenerate: 'Generate Entities',
  AdminLists: 'Manage Lists', AdminListDetail: 'List Details',
  AdminSitePicks: 'Site Picks', AdminSitePickGroupDetail: 'Site Pick Group',
  AdminMembership: 'Membership Settings', AdminMemberFeatures: 'Member Features',
  AdminSignupPromotions: 'Signup Promotions', AdminCoupons: 'Coupons',
  AdminCouponRedemptions: 'Coupon Redemptions', AdminGrants: 'Membership Grants',
  AdminEffectiveMembers: 'Effective Members',
} satisfies Record<ScreenName, string>

function label(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned || undefined
}

export function formatPageTitle(
  options: { title?: string } | undefined,
  route: { name: string; params?: object } | undefined,
): string {
  if (!route) return 'datememe'
  const params = (route.params ?? {}) as Record<string, unknown>
  let title = label(options?.title)
  if (!title) {
    const name = label(params.displayName)
    const poll = label(params.shortLabel)
    if (route.name === 'ListBuilder' && poll) title = `${poll} — Build Your List`
    if (route.name === 'PollResults' && poll) title = `${poll} — Results`
    if (route.name === 'ProfileDetail' && name) title = `${name} — Profile`
    if (route.name === 'Conversation' && name) title = `Chat with ${name}`
    if (route.name === 'AdminTaxonomyEntity') title = label(params.canonicalName)
    if (route.name === 'AdminTaxonomyGenerate' && label(params.parentEntityName)) title = `Generate Entities — ${label(params.parentEntityName)}`
    if (route.name === 'AdminCouponRedemptions' && label(params.code)) title = `Redemptions — ${label(params.code)}`
  }
  title ??= titles[route.name as ScreenName]
  return title ? `${title} | datememe` : 'datememe'
}

export const documentTitle = { formatter: formatPageTitle }
