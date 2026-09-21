import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useAdminBanUser,
  useAdminCreateMembershipGrant,
  useAdminRevokeMembershipGrant,
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

const GRANT_DURATIONS: { label: string; days: number | null }[] = [
  { label: 'Lifetime', days: null },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '365 days', days: 365 },
]

export function AdminUserDetailScreen({ route, navigation }: Props) {
  const { userId } = route.params
  const me = useCurrentUser()
  const detail = useAdminUserDetail(userId)
  const banUser = useAdminBanUser()
  const verifyUser = useAdminVerifyUser()
  const createGrant = useAdminCreateMembershipGrant()
  const revokeGrant = useAdminRevokeMembershipGrant()
  const sheet = useActionSheet()

  const isSelf = me.data?.id === userId

  function showError(title: string, err: unknown) {
    sheet.show({ title, message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'admin-user-detail.dialog.ok', text: 'OK' }] })
  }

  function handleToggleBan(currentlySuspended: boolean) {
    sheet.show({
      title: currentlySuspended ? 'Restore this account?' : 'Suspend this account?',
      message: currentlySuspended ? 'The user will be able to log in again.' : 'This will ban this account. Continue?',
      buttons: [
        { testID: 'admin-user-detail.dialog.cancel', text: 'Cancel', style: 'cancel' },
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

  function handleGrantMembership() {
    sheet.show({
      title: 'Grant membership',
      message: 'Independent of any Subscription — for how long?',
      buttons: [
        ...GRANT_DURATIONS.map((d) => ({
          testID: `admin-user-detail.dialog.grant.${d.days ?? "lifetime"}`,
          text: d.label,
          onPress: () =>
            createGrant.mutate(
              {
                userId,
                expiresAt: d.days ? new Date(Date.now() + d.days * 24 * 60 * 60 * 1000).toISOString() : null,
                reason: 'Granted via admin user detail screen',
              },
              { onError: (err) => showError('Could not create grant', err) },
            ),
        })),
        { testID: 'admin-user-detail.dialog.cancel', text: 'Cancel', style: 'cancel' as const },
      ],
    })
  }

  function handleRevokeGrant(grantId: string) {
    sheet.show({
      title: 'Revoke this grant?',
      buttons: [
        { testID: 'admin-user-detail.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'admin-user-detail.dialog.revoke', text: 'Revoke', style: 'destructive', onPress: () => revokeGrant.mutate({ id: grantId }, { onError: (err) => showError('Could not revoke grant', err) }) },
      ],
    })
  }

  if (detail.isLoading) {
    return (
      <ScreenContainer testID="screen.admin-user-detail" width="narrow">
        <TopNavigation testID="admin-user-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="User" />
        <View style={{ gap: spacing.md }}>
          <Skeleton height={140} />
          <Skeleton height={140} />
        </View>
      </ScreenContainer>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <ScreenContainer testID="screen.admin-user-detail" width="narrow">
        <TopNavigation testID="admin-user-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="User" />
        <ErrorState testID="admin-user-detail.error" subtitle="Couldn't load this user." onRetry={() => detail.refetch()} />
      </ScreenContainer>
    )
  }

  const { user, auditEvents } = detail.data
  const activeSubscription = user.subscriptions[0]
  const now = Date.now()
  const isGrantActive = (g: (typeof user.membershipGrants)[number]) => !g.revokedAt && (!g.expiresAt || new Date(g.expiresAt).getTime() > now)

  return (
    <ScreenContainer testID="screen.admin-user-detail" width="narrow">
      <TopNavigation testID="admin-user-detail.header"
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
          <Button testID="admin-user-detail.toggle-verify"
            label={user.isVerified ? 'Unverify' : 'Verify'}
            variant="secondary"
            disabled={isSelf}
            loading={verifyUser.isPending}
            onPress={() => handleToggleVerify(user.isVerified)}
          />
          <Button testID="admin-user-detail.toggle-ban"
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
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Subscription</Typography>
        {activeSubscription ? (
          <>
            <Row label="Plan" value={activeSubscription.plan.label} />
            <Row label="Price" value={`$${(activeSubscription.plan.priceCents / 100).toFixed(2)}`} />
            <Row label="Started" value={new Date(activeSubscription.createdAt).toLocaleDateString()} last />
          </>
        ) : (
          <Typography variant="bodyMuted">No active paid subscription.</Typography>
        )}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Typography variant="heading">Membership grants</Typography>
        </View>
        {user.membershipGrants.length === 0 ? (
          <Typography variant="bodyMuted">No grants — independent of Subscription, for support/comp access, signup promotions, or coupons.</Typography>
        ) : (
          user.membershipGrants.map((grant, i) => {
            const active = isGrantActive(grant)
            return (
              <View testID={`admin-user-detail.grant.${grant.id}`} key={grant.id} style={[styles.grantRow, i > 0 && styles.grantRowDivider]}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body">{grant.source.replace(/_/g, ' ')}</Typography>
                  {grant.reason ? <Typography variant="bodyMuted" style={{ marginTop: 2 }}>{grant.reason}</Typography> : null}
                  <Typography variant="label" style={{ color: colors.inkMuted, marginTop: 2 }}>
                    {grant.expiresAt ? `Expires ${new Date(grant.expiresAt).toLocaleDateString()}` : 'Lifetime'}
                    {grant.revokedAt ? ` · Revoked ${new Date(grant.revokedAt).toLocaleDateString()}` : ''}
                  </Typography>
                </View>
                {active ? (
                  <Button testID={`admin-user-detail.revoke.${grant.id}`} label="Revoke" variant="danger" loading={revokeGrant.isPending} onPress={() => handleRevokeGrant(grant.id)} />
                ) : (
                  <Typography variant="label" style={{ color: grant.revokedAt ? colors.danger : colors.inkMuted }}>
                    {grant.revokedAt ? 'Revoked' : 'Expired'}
                  </Typography>
                )}
              </View>
            )
          })
        )}
        <View style={styles.actionsRow}>
          <Button testID="admin-user-detail.grant-membership" label="Grant membership" variant="secondary" loading={createGrant.isPending} onPress={handleGrantMembership} />
        </View>
      </View>

      <View style={styles.card}>
        <Typography variant="heading" style={{ marginBottom: spacing.md }}>Admin audit history</Typography>
        {auditEvents.length === 0 ? (
          <Typography variant="bodyMuted">No admin actions recorded.</Typography>
        ) : (
          auditEvents.map((evt, i) => (
            <View testID={`admin-user-detail.evt.${evt.id}`} key={evt.id} style={[styles.auditRow, i > 0 && styles.auditRowDivider]}>
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

      <ActionSheet testID="admin-user-detail.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
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
  grantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  grantRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
