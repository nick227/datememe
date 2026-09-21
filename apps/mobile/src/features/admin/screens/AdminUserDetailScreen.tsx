import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useAdminBanUser,
  useAdminOverrideMembership,
  useAdminPlans,
  useAdminRevokeMembership,
  useAdminUserDetail,
  useAdminVerifyUser,
  useCurrentUser,
} from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminUserDetail'>

export function AdminUserDetailScreen({ route, navigation }: Props) {
  const { userId } = route.params
  const me = useCurrentUser()
  const detail = useAdminUserDetail(userId)
  const plans = useAdminPlans()
  const banUser = useAdminBanUser()
  const verifyUser = useAdminVerifyUser()
  const overrideMembership = useAdminOverrideMembership()
  const revokeMembership = useAdminRevokeMembership()
  const sheet = useActionSheet()

  const isSelf = me.data?.id === userId

  function showError(title: string, err: unknown) {
    sheet.show({ title, message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ text: 'OK' }] })
  }

  function handleToggleBan(currentlySuspended: boolean) {
    sheet.show({
      title: currentlySuspended ? 'Restore this account?' : 'Suspend this account?',
      message: currentlySuspended ? 'The user will be able to log in again.' : 'This will ban this account. Continue?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentlySuspended ? 'Restore' : 'Suspend',
          style: 'destructive',
          onPress: () => banUser.mutate({ userId, ban: !currentlySuspended }, { onError: (err) => showError('Could not update account', err) }),
        },
      ],
    })
  }

  function handleToggleVerify(currentlyVerified: boolean) {
    verifyUser.mutate({ userId, verify: !currentlyVerified }, { onError: (err) => showError('Could not update verification', err) })
  }

  function handleOverrideMembership() {
    const activePlans = (plans.data ?? []).filter((p) => p.isActive)
    if (activePlans.length === 0) {
      sheet.show({ title: 'No active plans', message: 'Create a plan first.', buttons: [{ text: 'OK' }] })
      return
    }
    sheet.show({
      title: 'Override membership',
      message: 'Select a plan to grant',
      buttons: [
        ...activePlans.map((p) => ({
          text: `${p.label} — $${(p.priceCents / 100).toFixed(2)}`,
          onPress: () => overrideMembership.mutate({ userId, planId: p.id }, { onError: (err) => showError('Could not override membership', err) }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    })
  }

  function handleRevokeMembership() {
    sheet.show({
      title: "Revoke this user's membership?",
      message: 'Are you sure you want to revoke this active membership?',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMembership.mutate({ userId }, { onError: (err) => showError('Could not revoke membership', err) }) },
      ],
    })
  }

  if (detail.isLoading) {
    return (
      <ScreenContainer width="narrow">
        <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="User" />
        <View style={{ gap: spacing.md }}>
          <Skeleton height={140} />
          <Skeleton height={140} />
        </View>
      </ScreenContainer>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <ScreenContainer width="narrow">
        <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="User" />
        <ErrorState subtitle="Couldn't load this user." onRetry={() => detail.refetch()} />
      </ScreenContainer>
    )
  }

  const { user, auditEvents } = detail.data
  const activeSubscription = user.subscriptions[0]

  return (
    <ScreenContainer width="narrow">
      <TopNavigation
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={user.profile?.displayName ?? user.email}
        subtitle={user.profile ? `@${user.profile.username}` : undefined}
      />

      <View style={styles.card}>
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Account state</Typography>
        <Row label="Email" value={user.email} />
        <Row label="Role" value={user.role} />
        <Row label="Status" value={user.suspendedAt ? 'Suspended' : 'Active'} tone={user.suspendedAt ? 'bad' : 'good'} />
        <Row label="Verification" value={user.isVerified ? 'Verified' : 'Unverified'} tone={user.isVerified ? 'good' : 'neutral'} />
        <Row label="Joined" value={new Date(user.createdAt).toLocaleDateString()} last />

        <View style={styles.actionsRow}>
          <Button
            label={user.isVerified ? 'Unverify' : 'Verify'}
            variant="secondary"
            disabled={isSelf}
            loading={verifyUser.isPending}
            onPress={() => handleToggleVerify(user.isVerified)}
          />
          <Button
            label={user.suspendedAt ? 'Restore account' : 'Suspend account'}
            variant={user.suspendedAt ? 'secondary' : 'danger'}
            disabled={isSelf}
            loading={banUser.isPending}
            onPress={() => handleToggleBan(!!user.suspendedAt)}
          />
        </View>
        {isSelf ? <Typography variant="label" style={{ color: colors.inkMuted, marginTop: spacing.sm }}>You cannot ban or unverify your own admin account.</Typography> : null}
      </View>

      <View style={styles.card}>
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Membership</Typography>
        {activeSubscription ? (
          <>
            <Row label="Plan" value={activeSubscription.plan.label} />
            <Row label="Price" value={`$${(activeSubscription.plan.priceCents / 100).toFixed(2)}`} />
            <Row label="Started" value={new Date(activeSubscription.createdAt).toLocaleDateString()} last />
          </>
        ) : (
          <Typography variant="bodyMuted">No active membership plan.</Typography>
        )}
        <View style={styles.actionsRow}>
          <Button label="Override membership" variant="secondary" loading={overrideMembership.isPending} onPress={handleOverrideMembership} />
          {activeSubscription ? (
            <Button label="Revoke" variant="danger" loading={revokeMembership.isPending} onPress={handleRevokeMembership} />
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Admin audit history</Typography>
        {auditEvents.length === 0 ? (
          <Typography variant="bodyMuted">No admin actions recorded.</Typography>
        ) : (
          auditEvents.map((evt, i) => (
            <View key={evt.id} style={[styles.auditRow, i > 0 && styles.auditRowDivider]}>
              <Typography variant="body">{evt.action}</Typography>
              <Typography variant="bodyMuted" style={{ marginTop: 2 }}>
                {new Date(evt.createdAt).toLocaleString()} · {evt.actor.email}
              </Typography>
              {evt.afterValue ? (
                <Typography variant="label" style={{ color: colors.inkMuted, marginTop: 2 }} numberOfLines={2}>
                  {JSON.stringify(evt.afterValue)}
                </Typography>
              ) : null}
            </View>
          ))
        )}
      </View>

      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

function Row({ label, value, tone, last }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral'; last?: boolean }) {
  const toneColor = tone === 'good' ? colors.ink : tone === 'bad' ? colors.danger : tone === 'neutral' ? colors.inkMuted : colors.ink
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Typography variant="bodyMuted">{label}</Typography>
      <Typography variant="body" style={{ color: toneColor, fontWeight: '600' }}>{value}</Typography>
    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  auditRow: { paddingVertical: spacing.sm },
  auditRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
})
