import { FlatList, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminCouponRedemptions } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCouponRedemptions'>

export function AdminCouponRedemptionsScreen({ route, navigation }: Props) {
  const { couponId, code } = route.params
  const redemptions = useAdminCouponRedemptions(couponId)

  return (
    <ScreenContainer testID="screen.admin-coupon-redemptions" width="wide">
      <TopNavigation testID="admin-coupon-redemptions.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Redemptions" subtitle={code} />

      {redemptions.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}
        </View>
      ) : redemptions.isError ? (
        <ErrorState testID="admin-coupon-redemptions.error" subtitle="Couldn't load redemptions." onRetry={() => redemptions.refetch()} />
      ) : (redemptions.data ?? []).length === 0 ? (
        <EmptyState testID="admin-coupon-redemptions.empty" title="No redemptions yet" />
      ) : (
        <FlatList
          data={redemptions.data}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          renderItem={({ item }) => (
            <View testID={item.id ? `admin-coupon-redemptions.row.${item.id}` : undefined} style={{ paddingVertical: spacing.md }}>
              <Typography variant="body">{item.user.profile?.displayName ?? item.user.email}</Typography>
              <Typography variant="bodyMuted">@{item.user.profile?.username ?? item.user.email} · {new Date(item.redeemedAt).toLocaleString()}</Typography>
              <Typography variant="label" style={{ color: colors.inkMuted, marginTop: 2 }}>
                {item.discountType === 'FULL' ? 'Full (100%)' : `${item.discountPercent}%`}
                {item.grant ? ` — granted MEMBER${item.grant.expiresAt ? ` until ${new Date(item.grant.expiresAt).toLocaleDateString()}` : ' (lifetime)'}` : ' — no grant (percentage discount, awaiting payment)'}
              </Typography>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  )
}
