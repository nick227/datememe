import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AdminDashboardScreen } from '../features/admin/screens/AdminDashboardScreen'
import { AdminModerationScreen } from '../features/admin/screens/AdminModerationScreen'
import { AdminUsersScreen } from '../features/admin/screens/AdminUsersScreen'
import { AdminUserDetailScreen } from '../features/admin/screens/AdminUserDetailScreen'
import { AdminMembershipsScreen } from '../features/admin/screens/AdminMembershipsScreen'
import { AdminTaxonomyScreen } from '../features/admin/screens/AdminTaxonomyScreen'
import { AdminTaxonomyTypeScreen } from '../features/admin/screens/AdminTaxonomyTypeScreen'
import { AdminTaxonomyEntityScreen } from '../features/admin/screens/AdminTaxonomyEntityScreen'
import { AdminTaxonomyGenerateScreen } from '../features/admin/screens/AdminTaxonomyGenerateScreen'
import { AdminListsScreen } from '../features/admin/screens/AdminListsScreen'
import { AdminListDetailScreen } from '../features/admin/screens/AdminListDetailScreen'
import { AdminSitePicksScreen } from '../features/admin/screens/AdminSitePicksScreen'
import { AdminSitePickGroupDetailScreen } from '../features/admin/screens/AdminSitePickGroupDetailScreen'
import { AdminMembershipScreen } from '../features/admin/screens/AdminMembershipScreen'
import { AdminMemberFeaturesScreen } from '../features/admin/screens/AdminMemberFeaturesScreen'
import { AdminSignupPromotionsScreen } from '../features/admin/screens/AdminSignupPromotionsScreen'
import { AdminCouponsScreen } from '../features/admin/screens/AdminCouponsScreen'
import { AdminCouponRedemptionsScreen } from '../features/admin/screens/AdminCouponRedemptionsScreen'
import { AdminGrantsScreen } from '../features/admin/screens/AdminGrantsScreen'
import { AdminEffectiveMembersScreen } from '../features/admin/screens/AdminEffectiveMembersScreen'
import type { AdminStackParamList } from './types'

const Stack = createNativeStackNavigator<AdminStackParamList>()

export function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminModeration" component={AdminModerationScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
      <Stack.Screen name="AdminMemberships" component={AdminMembershipsScreen} />
      <Stack.Screen name="AdminTaxonomy" component={AdminTaxonomyScreen} />
      <Stack.Screen name="AdminTaxonomyType" component={AdminTaxonomyTypeScreen} />
      <Stack.Screen name="AdminTaxonomyEntity" component={AdminTaxonomyEntityScreen} />
      <Stack.Screen name="AdminTaxonomyGenerate" component={AdminTaxonomyGenerateScreen} />
      <Stack.Screen name="AdminLists" component={AdminListsScreen} />
      <Stack.Screen name="AdminListDetail" component={AdminListDetailScreen} />
      <Stack.Screen name="AdminSitePicks" component={AdminSitePicksScreen} />
      <Stack.Screen name="AdminSitePickGroupDetail" component={AdminSitePickGroupDetailScreen} />
      <Stack.Screen name="AdminMembership" component={AdminMembershipScreen} />
      <Stack.Screen name="AdminMemberFeatures" component={AdminMemberFeaturesScreen} />
      <Stack.Screen name="AdminSignupPromotions" component={AdminSignupPromotionsScreen} />
      <Stack.Screen name="AdminCoupons" component={AdminCouponsScreen} />
      <Stack.Screen name="AdminCouponRedemptions" component={AdminCouponRedemptionsScreen} />
      <Stack.Screen name="AdminGrants" component={AdminGrantsScreen} />
      <Stack.Screen name="AdminEffectiveMembers" component={AdminEffectiveMembersScreen} />
    </Stack.Navigator>
  )
}
