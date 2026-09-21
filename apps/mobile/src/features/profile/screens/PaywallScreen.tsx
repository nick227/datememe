import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useCurrentUser, useDevPurchase, usePlans, useRedeemCoupon } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { borderWidth, colors, radius, spacing, type } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Paywall'>

const PERKS = [
  'Read every message you receive',
  'Send unlimited messages',
  "See other members' photos",
]

export function PaywallScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const plans = usePlans()
  const devPurchase = useDevPurchase()
  const redeemCoupon = useRedeemCoupon()
  const sheet = useActionSheet()
  const [couponCode, setCouponCode] = useState('')

  async function handleSubscribe(planSlug: string) {
    try {
      await devPurchase.mutateAsync({ planSlug })
      sheet.show({
        title: 'You’re premium!',
        message: 'This used the dev-purchase simulation — real Apple/Google IAP wiring is a follow-up.',
        buttons: [{ testID: 'paywall.dialog.ok', text: 'OK', onPress: () => navigation.goBack() }],
      })
    } catch (err: any) {
      sheet.show({ title: 'Purchase failed', message: err?.message ?? 'Try again in a moment', buttons: [{ testID: 'paywall.dialog.ok', text: 'OK' }] })
    }
  }

  function handleRedeem() {
    if (!couponCode.trim()) return
    redeemCoupon.mutate(couponCode.trim(), {
      onSuccess: (result) => {
        setCouponCode('')
        sheet.show({
          title: result.grant ? 'You’re premium!' : 'Code applied',
          message: result.grant
            ? `Your code unlocked MEMBER${result.grant.expiresAt ? ` until ${new Date(result.grant.expiresAt).toLocaleDateString()}` : ' — lifetime'}.`
            : `This code is a ${result.redemption.discountPercent}% discount — it's recorded on your account, and applies once you subscribe.`,
          buttons: [{ testID: 'paywall.dialog.ok', text: 'OK', onPress: () => result.grant && navigation.goBack() }],
        })
      },
      onError: (err) => sheet.show({ title: 'Could not redeem code', message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'paywall.dialog.ok', text: 'OK' }] }),
    })
  }

  const isPremium = me.data?.membership.state === 'MEMBER'

  return (
    <ScreenContainer testID="screen.paywall" width="narrow">
      <TopNavigation testID="paywall.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Go Premium" />
      <View style={styles.perks}>
        {PERKS.map((perk) => (
          <Text key={perk} style={styles.perk}>
            •  {perk}
          </Text>
        ))}
      </View>

      {isPremium ? (
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>You're already premium — thank you!</Text>
        </View>
      ) : plans.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          {(plans.data ?? []).map((plan) => (
            <View testID={`paywall.plan.${plan.id}`} key={plan.id} style={styles.planCard}>
              <View style={{ flex: 1 }}>
                <Typography variant="heading">{plan.label}</Typography>
                <Typography variant="bodyMuted">
                  ${(plan.priceCents / 100).toFixed(2)} / {plan.interval.toLowerCase()}
                </Typography>
              </View>
              <Button testID={`paywall.subscribe.${plan.id}`}
                label="Subscribe"
                onPress={() => handleSubscribe(plan.slug)}
                loading={devPurchase.isPending}
              />
            </View>
          ))}
        </View>
      )}

      {!isPremium ? (
        <View style={styles.couponBox}>
          <Typography variant="label" style={{ marginBottom: spacing.xs }}>Have a code?</Typography>
          <View style={styles.couponRow}>
            <View style={{ flex: 1 }}>
              <TextField testID="paywall.coupon" value={couponCode} onChangeText={setCouponCode} placeholder="Enter code" autoCapitalize="characters" />
            </View>
            <Button testID="paywall.redeem" label="Redeem" variant="secondary" loading={redeemCoupon.isPending} onPress={handleRedeem} />
          </View>
        </View>
      ) : null}

      <Text style={styles.devNote}>
        Dev build: subscribing here uses a simulated purchase endpoint, not a real App
        Store/Play Store charge.
      </Text>
      <ActionSheet testID="paywall.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  perks: { marginTop: spacing.md },
  perk: { ...type.body, marginBottom: spacing.xs },
  activeBadge: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    alignItems: 'center',
  },
  activeBadgeText: { ...type.heading, color: colors.primary },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  devNote: { ...type.bodyMuted, fontSize: 12, marginTop: spacing.xl, textAlign: 'center' },
  couponBox: { marginTop: spacing.xl },
  couponRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
})
