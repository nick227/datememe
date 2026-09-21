import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCurrentUser, useLogout, useSendVerificationEmail } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Button } from '../../../ui/Button'
import { Icon } from '../../../ui/Icon'
import { clearToken } from '../../../lib/authToken'
import { borderWidth, colors, radius, spacing, type } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Account'>

export function AccountScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const logout = useLogout()
  const sendVerification = useSendVerificationEmail()

  const isPremium = me.data?.membership.state === 'MEMBER'

  async function handleLogout() {
    await logout.mutateAsync()
    await clearToken()
  }

  if (me.isLoading) {
    return (
      <ScreenContainer width="narrow">
        <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Account" />
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer width="narrow">
      <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Account" />

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
        <View style={styles.row}>
          <Typography variant="heading">Email</Typography>
          <View style={[styles.tierBadge, !me.data?.isVerified && styles.tierBadgeWarning]}>
            <Text style={[styles.tierBadgeText, !me.data?.isVerified && styles.tierBadgeTextWarning]}>
              {me.data?.isVerified ? 'Verified' : 'Not verified'}
            </Text>
          </View>
        </View>

        {!me.data?.isVerified ? (
          <View style={{ marginTop: spacing.md }}>
            <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
              Verify {me.data?.email} to keep your account secure.
            </Typography>
            <Button
              label="Send verification code"
              onPress={async () => {
                await sendVerification.mutateAsync()
                navigation.navigate('VerifyEmail')
              }}
              loading={sendVerification.isPending}
            />
          </View>
        ) : null}
      </View>

      {me.data?.role === 'ADMIN' ? (
        <Pressable style={styles.card} onPress={() => navigation.navigate('Admin')}>
          <View style={styles.row}>
            <View style={styles.adminRowLeft}>
              <Icon name="Shield" size={20} color={colors.ink} />
              <Typography variant="heading">Admin</Typography>
            </View>
            <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
          </View>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Actions</Typography>
        <Button label="Log out" variant="secondary" onPress={handleLogout} loading={logout.isPending} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tierBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tierBadgeText: { ...type.label, color: colors.primary },
  tierBadgeWarning: { backgroundColor: colors.surfaceMuted },
  tierBadgeTextWarning: { color: colors.danger },
})
