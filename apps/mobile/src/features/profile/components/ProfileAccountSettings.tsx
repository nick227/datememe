import { useState } from 'react'
import { Pressable, StyleSheet, Switch, View } from 'react-native'
import { ArrowUpRight, Check, ChevronRight, Shield } from 'lucide-react-native'
import { useCurrentUser, useLogout, useSendVerificationEmail, useUpdateMyProfile } from '@project/sdk'
import { Typography } from '../../../ui/Typography'
import { Button } from '../../../ui/Button'
import { clearToken } from '../../../lib/authToken'
import { colors, spacing } from '../../../theme'

type Props = { onPremium: () => void; onVerify: () => void; onAdmin: () => void }

export function ProfileAccountSettings({ onPremium, onVerify, onAdmin }: Props) {
  const me = useCurrentUser()
  const logout = useLogout()
  const sendVerification = useSendVerificationEmail()
  const update = useUpdateMyProfile()
  const [error, setError] = useState('')
  const [discoverable, setDiscoverable] = useState<boolean | null>(null)
  const isPremium = me.data?.membership.state === 'MEMBER'

  async function run(action: () => Promise<void>) {
    setError('')
    try { await action() } catch (err: any) { setError(err?.message ?? 'Could not update your account. Please try again.') }
  }

  return (
    <View style={styles.section}>
      <Typography variant="title">Account & settings</Typography>
      <View style={styles.panel}>
        <View style={styles.row}>
          <View style={styles.text}><Typography variant="heading">Show me in Discover</Typography><Typography variant="bodyMuted">Turn off to pause meeting new people.</Typography></View>
          <Switch testID="profile.discoverable" accessibilityLabel="Show me in Discover" value={discoverable ?? me.data?.profile?.isDiscoverable ?? false} disabled={update.isPending} trackColor={{ false: colors.border, true: colors.accent }} onValueChange={value => { void run(async () => { await update.mutateAsync({ isDiscoverable: value }); setDiscoverable(value) }) }} />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.text}><Typography variant="heading">Membership</Typography><Typography variant="bodyMuted">{isPremium ? 'Premium member' : 'Free member'}</Typography></View>
          {isPremium ? <Check size={20} color={colors.accent} /> : <Pressable testID="account.go-premium" accessibilityRole="button" onPress={onPremium} style={styles.link}><Typography style={styles.linkText}>Go Premium</Typography><ArrowUpRight size={16} color={colors.accent} /></Pressable>}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.text}><Typography variant="heading">Email</Typography><Typography variant="bodyMuted" selectable>{me.data?.email}</Typography></View>
          <Typography style={styles.status}>{me.data?.isVerified ? 'Verified' : 'Not verified'}</Typography>
        </View>
        {!me.data?.isVerified ? <Button testID="account.send-verification-code" label="Send verification code" variant="secondary" loading={sendVerification.isPending} onPress={() => { void run(async () => { await sendVerification.mutateAsync(); onVerify() }) }} /> : null}
        {me.data?.role === 'ADMIN' ? <><View style={styles.divider} /><Pressable testID="account.open-admin" accessibilityRole="button" onPress={onAdmin} style={styles.row}><Shield size={20} color={colors.ink} /><Typography variant="heading" style={styles.text}>Admin tools</Typography><ChevronRight size={20} color={colors.inkMuted} /></Pressable></> : null}
      </View>
      {error ? <Typography accessibilityRole="alert" style={styles.error}>{error}</Typography> : null}
      <Button testID="account.logout" label="Log out" variant="secondary" loading={logout.isPending} onPress={() => { void run(async () => { await logout.mutateAsync(); await clearToken() }) }} />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.lg },
  panel: { backgroundColor: colors.surfaceMuted, borderRadius: 20, padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, flexWrap: 'wrap' },
  text: { flex: 1, minWidth: 140, gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  linkText: { color: colors.accent, fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  status: { fontSize: 12, color: colors.inkMuted },
  error: { color: colors.danger },
})
