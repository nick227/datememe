import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminCouponCodes, useAdminCreateCouponCode, useAdminUpdateCouponCode } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminCoupons'>

const DISCOUNT_TYPE_OPTIONS = [
  { label: 'Full (100%) — grants MEMBER', value: 'FULL' },
  { label: 'Percentage — recorded only', value: 'PERCENTAGE' },
]

export function AdminCouponsScreen({ navigation }: Props) {
  const coupons = useAdminCouponCodes()
  const createCoupon = useAdminCreateCouponCode()
  const updateCoupon = useAdminUpdateCouponCode()
  const sheet = useActionSheet()

  const [showForm, setShowForm] = useState(false)
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'FULL' | 'PERCENTAGE'>('FULL')
  const [discountPercent, setDiscountPercent] = useState('50')
  const [grantDurationDays, setGrantDurationDays] = useState('')
  const [campaign, setCampaign] = useState('')
  const [partner, setPartner] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('')

  function showError(err: unknown) {
    sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'admin-coupons.dialog.ok', text: 'OK' }] })
  }

  function handleCreate() {
    if (!code.trim()) {
      sheet.show({ title: 'Code required', buttons: [{ testID: 'admin-coupons.dialog.ok', text: 'OK' }] })
      return
    }
    createCoupon.mutate(
      {
        code: code.trim(),
        discountType,
        discountPercent: discountType === 'PERCENTAGE' ? Number(discountPercent) : undefined,
        grantDurationDays: discountType === 'FULL' && grantDurationDays ? Number(grantDurationDays) : undefined,
        campaign: campaign.trim() || undefined,
        partner: partner.trim() || undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setCode('')
          setCampaign('')
          setPartner('')
          setMaxRedemptions('')
          setGrantDurationDays('')
        },
        onError: showError,
      },
    )
  }

  return (
    <ScreenContainer testID="screen.admin-coupons" width="wide">
      <TopNavigation testID="admin-coupons.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title="Coupon Codes"
        rightElement={
          <Pressable testID="admin-coupons.show-form" hitSlop={12} onPress={() => setShowForm((v) => !v)}>
            <Typography variant="button" style={{ color: colors.primary }}>{showForm ? 'Cancel' : '+ New'}</Typography>
          </Pressable>
        }
      />
      <ScrollView>
        {showForm ? (
          <View style={styles.formCard}>
            <TextField testID="admin-coupons.code" label="Code" value={code} onChangeText={setCode} autoCapitalize="characters" />
            <SelectField testID="admin-coupons.discount-type" label="Discount" value={discountType} options={DISCOUNT_TYPE_OPTIONS} onSelect={(v) => setDiscountType(v as typeof discountType)} />
            {discountType === 'PERCENTAGE' ? (
              <TextField testID="admin-coupons.discount-percent" label="Discount percent" value={discountPercent} onChangeText={setDiscountPercent} keyboardType="number-pad" />
            ) : (
              <TextField testID="admin-coupons.grant-duration-days" label="Grant duration in days (blank = lifetime)" value={grantDurationDays} onChangeText={setGrantDurationDays} keyboardType="number-pad" />
            )}
            <TextField testID="admin-coupons.campaign" label="Campaign (optional)" value={campaign} onChangeText={setCampaign} />
            <TextField testID="admin-coupons.partner" label="Partner (optional)" value={partner} onChangeText={setPartner} />
            <TextField testID="admin-coupons.max-redemptions" label="Max redemptions (optional, blank = unlimited)" value={maxRedemptions} onChangeText={setMaxRedemptions} keyboardType="number-pad" />
            <Button testID="admin-coupons.create" label="Create coupon" loading={createCoupon.isPending} onPress={handleCreate} />
          </View>
        ) : null}

        {coupons.isLoading ? (
          <Skeleton height={100} />
        ) : coupons.isError ? (
          <ErrorState testID="admin-coupons.error" subtitle="Couldn't load coupons." onRetry={() => coupons.refetch()} />
        ) : (coupons.data ?? []).length === 0 ? (
          <EmptyState testID="admin-coupons.empty" title="No coupons yet" />
        ) : (
          (coupons.data ?? []).map((coupon) => (
            <Pressable testID={`admin-coupons.coupon.${coupon.id}`}
              key={coupon.id}
              style={styles.row}
              onPress={() => navigation.navigate('AdminCouponRedemptions', { couponId: coupon.id, code: coupon.code })}
            >
              <View style={{ flex: 1 }}>
                <Typography variant="body" style={!coupon.isActive ? styles.inactiveText : undefined}>{coupon.code}</Typography>
                <Typography variant="bodyMuted">
                  {coupon.discountType === 'FULL' ? 'Full (100%)' : `${coupon.discountPercent}%`}
                  {coupon.campaign ? ` · ${coupon.campaign}` : ''}
                  {coupon.partner ? ` · ${coupon.partner}` : ''}
                  {' · '}{coupon._count.redemptions} redeemed{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}
                </Typography>
              </View>
              <Button testID={`admin-coupons.toggle.${coupon.id}`}
                label={coupon.isActive ? 'Active' : 'Inactive'}
                variant="secondary"
                loading={updateCoupon.isPending}
                onPress={() => updateCoupon.mutate({ id: coupon.id, isActive: !coupon.isActive }, { onError: showError })}
              />
              <Icon name="ChevronRight" size={18} color={colors.inkMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>
      <ActionSheet testID="admin-coupons.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inactiveText: { color: colors.inkMuted, textDecorationLine: 'line-through' },
})
