import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCurrentUser, useLogout, useMySubscription } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { Button } from '../../../ui/Button'
import { clearToken } from '../../../lib/authToken'
import { colors, radius, spacing, type } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Account'>

export function AccountScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const subscription = useMySubscription()
  const logout = useLogout()

  const isPremium = !!subscription.data?.isActive

  async function handleLogout() {
    await logout.mutateAsync()
    await clearToken()
  }

  if (me.isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <Typography variant="title" style={styles.title}>Account</Typography>

      <View style={styles.card}>
        <View style={styles.row}>
          <Typography variant="heading">Membership</Typography>
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>{isPremium ? 'Premium member' : 'Free member'}</Text>
          </View>
        </View>

        {!isPremium ? (
          <View style={{ marginTop: spacing.md }}>
            <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
              Upgrade to Premium for unlimited browsing and to see who likes you.
            </Typography>
            <Button label="Go Premium" onPress={() => navigation.navigate('Paywall')} />
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Actions</Typography>
        <Button label="Log out" variant="secondary" onPress={handleLogout} loading={logout.isPending} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tierBadgeText: { ...type.label, color: colors.primary },
})
