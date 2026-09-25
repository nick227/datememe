import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminEntitlementPolicy, useAdminUpdateEntitlementPolicy } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMemberFeatures'>

const BOOLEAN_KEYS = [
  { key: 'profile.fullPhotoAccess' as const, label: 'Full photo access', description: 'See other members’ photos in messages and profiles.' },
  { key: 'messaging.readIncoming' as const, label: 'Read incoming messages', description: 'Read the body of messages sent to you (vs. a locked placeholder).' },
  { key: 'lists.memberOnly' as const, label: 'Member-only lists', description: 'View lists that are restricted to members.' },
]

export function AdminMemberFeaturesScreen({ navigation }: Props) {
  const policy = useAdminEntitlementPolicy()
  const update = useAdminUpdateEntitlementPolicy()
  const sheet = useActionSheet()

  const [limitDraft, setLimitDraft] = useState({ FREE: '', MEMBER: '' })
  const hydratedLimit = useRef(false)

  useEffect(() => {
    if (hydratedLimit.current || !policy.data) return
    setLimitDraft({
      FREE: String(policy.data.FREE['messaging.dailySendLimit']),
      MEMBER: String(policy.data.MEMBER['messaging.dailySendLimit']),
    })
    hydratedLimit.current = true
  }, [policy.data])

  function showError(err: unknown) {
    sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'admin-member-features.dialog.ok', text: 'OK' }] })
  }

  function toggleBoolean(state: 'FREE' | 'MEMBER', key: (typeof BOOLEAN_KEYS)[number]['key'], current: boolean) {
    update.mutate({ state, key, value: !current }, { onError: showError })
  }

  function saveLimit(state: 'FREE' | 'MEMBER') {
    const raw = limitDraft[state].trim().toUpperCase()
    const value = raw === 'UNLIMITED' ? ('UNLIMITED' as const) : Number(raw)
    if (value !== 'UNLIMITED' && (!Number.isInteger(value) || value < 0)) {
      sheet.show({ title: 'Invalid value', message: 'Enter a non-negative whole number, or "Unlimited".', buttons: [{ testID: 'admin-member-features.dialog.ok', text: 'OK' }] })
      return
    }
    update.mutate({ state, key: 'messaging.dailySendLimit', value }, { onError: showError })
  }

  if (policy.isLoading) {
    return (
      <ScreenContainer testID="screen.admin-member-features" width="wide">
        <TopNavigation testID="admin-member-features.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Member Features" />
        <Skeleton height={300} />
      </ScreenContainer>
    )
  }

  if (policy.isError || !policy.data) {
    return (
      <ScreenContainer testID="screen.admin-member-features" width="wide">
        <TopNavigation testID="admin-member-features.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Member Features" />
        <ErrorState testID="admin-member-features.error" subtitle="Couldn't load the policy." onRetry={() => policy.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.admin-member-features" width="wide">
      <TopNavigation testID="admin-member-features.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Member Features" subtitle="FREE / MEMBER entitlement policy" />
      <ScrollView>
        <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
          Changes take effect immediately for everyone at that tier. Existing members keep whatever a subscription or grant already promised them — see Grandfathering.
        </Typography>

        {BOOLEAN_KEYS.map(({ key, label, description }) => (
          <View key={key} style={styles.card}>
            <Typography variant="heading">{label}</Typography>
            <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>{description}</Typography>
            <View style={styles.tierRow}>
              {(['FREE', 'MEMBER'] as const).map((state) => (
                <View key={state} style={styles.tierCol}>
                  <Typography variant="label" style={{ color: colors.inkMuted }}>{state}</Typography>
                  <Button testID={`admin-member-features.toggle.${key}.${state}`}
                    label={policy.data![state][key] ? 'On' : 'Off'}
                    variant="secondary"
                    loading={update.isPending}
                    onPress={() => toggleBoolean(state, key, policy.data![state][key])}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.card}>
          <Typography variant="heading">Daily message send limit</Typography>
          <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>A whole number, or &quot;Unlimited&quot;.</Typography>
          <View style={styles.tierRow}>
            {(['FREE', 'MEMBER'] as const).map((state) => (
              <View key={state} style={styles.tierCol}>
                <Typography variant="label" style={{ color: colors.inkMuted }}>{state}</Typography>
                <TextField testID={`admin-member-features.limit.${state}`} value={limitDraft[state]} onChangeText={(v) => setLimitDraft((d) => ({ ...d, [state]: v }))} autoCapitalize="characters" />
                <Button testID={`admin-member-features.save.${state}`} label="Save" variant="secondary" loading={update.isPending} onPress={() => saveLimit(state)} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <ActionSheet testID="admin-member-features.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
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
  tierRow: { flexDirection: 'row', gap: spacing.lg },
  tierCol: { flex: 1, gap: spacing.xs },
})
