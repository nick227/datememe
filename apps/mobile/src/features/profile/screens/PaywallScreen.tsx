import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useDevPurchase, useMySubscription, usePlans } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Button } from '../../../ui/Button'
import { borderWidth, colors, radius, spacing, type } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Paywall'>

const PERKS = [
  'Read every message you receive',
  'Send unlimited messages (free is capped at 3/day)',
  "See other members' photos",
]

export function PaywallScreen({ navigation }: Props) {
  const plans = usePlans()
  const subscription = useMySubscription()
  const devPurchase = useDevPurchase()

  async function handleSubscribe(planSlug: string) {
    try {
      await devPurchase.mutateAsync({ planSlug })
      Alert.alert('You’re premium!', 'This used the dev-purchase simulation — real Apple/Google IAP wiring is a follow-up.')
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Purchase failed', err?.message ?? 'Try again in a moment')
    }
  }

  const isPremium = !!subscription.data?.isActive

  return (
    <ScreenContainer width="narrow">
      <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Go Premium" />
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
            <View key={plan.id} style={styles.planCard}>
              <View style={{ flex: 1 }}>
                <Typography variant="heading">{plan.label}</Typography>
                <Typography variant="bodyMuted">
                  ${(plan.priceCents / 100).toFixed(2)} / {plan.interval.toLowerCase()}
                </Typography>
              </View>
              <Button
                label="Subscribe"
                onPress={() => handleSubscribe(plan.slug)}
                loading={devPurchase.isPending}
              />
            </View>
          ))}
        </View>
      )}

      <Text style={styles.devNote}>
        Dev build: subscribing here uses a simulated purchase endpoint, not a real App
        Store/Play Store charge.
      </Text>
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
})
