import { Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminMembershipOverview } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMembership'>

export function AdminMembershipScreen({ navigation }: Props) {
  const overview = useAdminMembershipOverview()

  return (
    <ScreenContainer testID="screen.admin-membership" width="wide">
      <TopNavigation testID="admin-membership.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Membership" subtitle="FREE / MEMBER" />

      {overview.isLoading ? (
        <Skeleton height={140} style={{ marginBottom: spacing.md }} />
      ) : overview.isError ? (
        <ErrorState testID="admin-membership.error" subtitle="Couldn't load the overview." onRetry={() => overview.refetch()} />
      ) : (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <Stat label="Effective members" value={overview.data!.effectiveMemberCount} />
            <Stat label="Total users" value={overview.data!.totalUserCount} />
          </View>
          <View style={styles.sourceRow}>
            <SourceStat label="Subscriptions" value={overview.data!.bySource.subscriptions} />
            <SourceStat label="Manual grants" value={overview.data!.bySource.manualGrants} />
            <SourceStat label="Signup promos" value={overview.data!.bySource.signupPromotionGrants} />
            <SourceStat label="Coupons" value={overview.data!.bySource.couponGrants} />
          </View>
          {overview.data!.globalWindow ? (
            <View style={styles.globalBanner}>
              <Typography variant="label" style={{ color: colors.white }}>
                Global MEMBER window active — &quot;{overview.data!.globalWindow.label}&quot; until {new Date(overview.data!.globalWindow.endsAt).toLocaleString()}
              </Typography>
            </View>
          ) : null}
        </View>
      )}

      <NavRow title="Member Features" subtitle="Edit the FREE / MEMBER entitlement policy" onPress={() => navigation.navigate('AdminMemberFeatures')} />
      <NavRow title="Signup Promotions" subtitle="[start, end) signup awards, and global MEMBER windows" onPress={() => navigation.navigate('AdminSignupPromotions')} />
      <NavRow title="Coupon Codes" subtitle="Full or percentage discounts, redemptions" onPress={() => navigation.navigate('AdminCoupons')} />
      <NavRow title="Grants" subtitle="Every membership grant issued, with revoke" onPress={() => navigation.navigate('AdminGrants')} />
      <NavRow title="Effective Members" subtitle="Browse who is currently MEMBER and why" onPress={() => navigation.navigate('AdminEffectiveMembers')} />
    </ScreenContainer>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Typography variant="label" style={{ color: colors.inkMuted }}>{label}</Typography>
      <Typography variant="display">{value}</Typography>
    </View>
  )
}

function SourceStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.sourceStat}>
      <Typography variant="label" style={{ color: colors.inkMuted }}>{label}</Typography>
      <Typography variant="heading">{value}</Typography>
    </View>
  )
}

function NavRow({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={styles.navRow} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Typography variant="heading">{title}</Typography>
        <Typography variant="bodyMuted">{subtitle}</Typography>
      </View>
      <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sourceStat: { width: '45%' },
  globalBanner: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
})
