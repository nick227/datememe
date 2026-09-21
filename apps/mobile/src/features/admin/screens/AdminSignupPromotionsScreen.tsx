import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useAdminCreateGlobalMembershipWindow,
  useAdminCreateSignupPromotion,
  useAdminGlobalMembershipWindows,
  useAdminSignupPromotions,
  useAdminUpdateGlobalMembershipWindow,
  useAdminUpdateSignupPromotion,
} from '@project/sdk'
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
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSignupPromotions'>

const AWARD_TYPE_OPTIONS = [
  { label: 'Lifetime MEMBER', value: 'LIFETIME_MEMBER' },
  { label: 'Temporary MEMBER', value: 'TEMPORARY_MEMBER' },
]

// Dates as plain YYYY-MM-DD — no date/time picker exists yet in this app's
// primitives, and this is admin-only tooling; the day is treated as
// midnight UTC, precise enough for a promotion window.
function toIsoStartOfDay(dateStr: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null
  const date = new Date(`${dateStr.trim()}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function AdminSignupPromotionsScreen({ navigation }: Props) {
  const sheet = useActionSheet()

  return (
    <ScreenContainer testID="screen.admin-signup-promotions" width="wide">
      <TopNavigation testID="admin-signup-promotions.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Signup Promotions" />
      <ScrollView>
        <SignupPromotionsSection sheet={sheet} />
        <GlobalWindowsSection sheet={sheet} />
      </ScrollView>
      <ActionSheet testID="admin-signup-promotions.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

function SignupPromotionsSection({ sheet }: { sheet: ReturnType<typeof useActionSheet> }) {
  const promotions = useAdminSignupPromotions()
  const createPromotion = useAdminCreateSignupPromotion()
  const updatePromotion = useAdminUpdateSignupPromotion()

  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [awardType, setAwardType] = useState<'LIFETIME_MEMBER' | 'TEMPORARY_MEMBER'>('LIFETIME_MEMBER')
  const [durationDays, setDurationDays] = useState('')

  function showError(err: unknown) {
    sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'admin-signup-promotions.dialog.ok', text: 'OK' }] })
  }

  function handleCreate() {
    const startIso = toIsoStartOfDay(startAt)
    const endIso = toIsoStartOfDay(endAt)
    if (!label.trim() || !startIso || !endIso) {
      sheet.show({ title: 'Missing fields', message: 'Label, start date, and end date (YYYY-MM-DD) are required.', buttons: [{ testID: 'admin-signup-promotions.dialog.ok', text: 'OK' }] })
      return
    }
    createPromotion.mutate(
      {
        label: label.trim(),
        startAt: startIso,
        endAt: endIso,
        awardType,
        durationDays: awardType === 'TEMPORARY_MEMBER' ? Number(durationDays) : undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setLabel('')
          setStartAt('')
          setEndAt('')
          setDurationDays('')
        },
        onError: showError,
      },
    )
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Typography variant="title">Signup Promotions</Typography>
        <Button testID="admin-signup-promotions.show-form" label={showForm ? 'Cancel' : '+ New'} variant="secondary" onPress={() => setShowForm((v) => !v)} />
      </View>
      <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
        [start, end) window — a user who registers inside it is granted MEMBER, lifetime or temporary.
      </Typography>

      {showForm ? (
        <View style={styles.formCard}>
          <TextField testID="admin-signup-promotions.label" label="Label" value={label} onChangeText={setLabel} />
          <View style={styles.dateRow}>
            <TextField testID="admin-signup-promotions.start-at" label="Start (YYYY-MM-DD)" value={startAt} onChangeText={setStartAt} style={{ flex: 1 }} />
            <TextField testID="admin-signup-promotions.end-at" label="End (YYYY-MM-DD)" value={endAt} onChangeText={setEndAt} style={{ flex: 1 }} />
          </View>
          <SelectField testID="admin-signup-promotions.award-type" label="Award" value={awardType} options={AWARD_TYPE_OPTIONS} onSelect={(v) => setAwardType(v as typeof awardType)} />
          {awardType === 'TEMPORARY_MEMBER' ? (
            <TextField testID="admin-signup-promotions.duration-days" label="Duration (days)" value={durationDays} onChangeText={setDurationDays} keyboardType="number-pad" />
          ) : null}
          <Button testID="admin-signup-promotions.create" label="Create promotion" loading={createPromotion.isPending} onPress={handleCreate} />
        </View>
      ) : null}

      {promotions.isLoading ? (
        <Skeleton height={80} />
      ) : promotions.isError ? (
        <ErrorState testID="admin-signup-promotions.error" subtitle="Couldn't load promotions." onRetry={() => promotions.refetch()} />
      ) : (promotions.data ?? []).length === 0 ? (
        <EmptyState testID="admin-signup-promotions.empty" title="No signup promotions yet" />
      ) : (
        (promotions.data ?? []).map((promo) => (
          <View testID={`admin-signup-promotions.promo.${promo.id}`} key={promo.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={!promo.isActive ? styles.inactiveText : undefined}>{promo.label}</Typography>
              <Typography variant="bodyMuted">
                {new Date(promo.startAt).toLocaleDateString()} → {new Date(promo.endAt).toLocaleDateString()} · {promo.awardType === 'LIFETIME_MEMBER' ? 'Lifetime' : `${promo.durationDays}d`} · {promo._count.grants} granted
              </Typography>
            </View>
            <Button testID={`admin-signup-promotions.toggle.${promo.id}`}
              label={promo.isActive ? 'Active' : 'Inactive'}
              variant="secondary"
              loading={updatePromotion.isPending}
              onPress={() => updatePromotion.mutate({ id: promo.id, isActive: !promo.isActive }, { onError: showError })}
            />
          </View>
        ))
      )}
    </View>
  )
}

function GlobalWindowsSection({ sheet }: { sheet: ReturnType<typeof useActionSheet> }) {
  const windows = useAdminGlobalMembershipWindows()
  const createWindow = useAdminCreateGlobalMembershipWindow()
  const updateWindow = useAdminUpdateGlobalMembershipWindow()

  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  function showError(err: unknown) {
    sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'admin-signup-promotions.dialog.ok', text: 'OK' }] })
  }

  function handleCreate() {
    const startIso = toIsoStartOfDay(startAt)
    const endIso = toIsoStartOfDay(endAt)
    if (!label.trim() || !startIso || !endIso) {
      sheet.show({ title: 'Missing fields', message: 'Label, start date, and end date (YYYY-MM-DD) are required.', buttons: [{ testID: 'admin-signup-promotions.dialog.ok', text: 'OK' }] })
      return
    }
    createWindow.mutate(
      { label: label.trim(), startAt: startIso, endAt: endIso },
      {
        onSuccess: () => {
          setShowForm(false)
          setLabel('')
          setStartAt('')
          setEndAt('')
        },
        onError: showError,
      },
    )
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Typography variant="title">Global MEMBER Windows</Typography>
        <Button testID="admin-signup-promotions.windows.show-form" label={showForm ? 'Cancel' : '+ New'} variant="secondary" onPress={() => setShowForm((v) => !v)} />
      </View>
      <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
        [start, end) window where every user — new or existing — resolves as MEMBER, with no per-user grant.
      </Typography>

      {showForm ? (
        <View style={styles.formCard}>
          <TextField testID="admin-signup-promotions.windows.label" label="Label" value={label} onChangeText={setLabel} />
          <View style={styles.dateRow}>
            <TextField testID="admin-signup-promotions.windows.start-at" label="Start (YYYY-MM-DD)" value={startAt} onChangeText={setStartAt} style={{ flex: 1 }} />
            <TextField testID="admin-signup-promotions.windows.end-at" label="End (YYYY-MM-DD)" value={endAt} onChangeText={setEndAt} style={{ flex: 1 }} />
          </View>
          <Button testID="admin-signup-promotions.windows.create" label="Create window" loading={createWindow.isPending} onPress={handleCreate} />
        </View>
      ) : null}

      {windows.isLoading ? (
        <Skeleton height={80} />
      ) : windows.isError ? (
        <ErrorState testID="admin-signup-promotions.windows.error" subtitle="Couldn't load windows." onRetry={() => windows.refetch()} />
      ) : (windows.data ?? []).length === 0 ? (
        <EmptyState testID="admin-signup-promotions.windows.empty" title="No global windows yet" />
      ) : (
        (windows.data ?? []).map((window) => (
          <View testID={`admin-signup-promotions.window.${window.id}`} key={window.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={!window.isActive ? styles.inactiveText : undefined}>{window.label}</Typography>
              <Typography variant="bodyMuted">
                {new Date(window.startAt).toLocaleDateString()} → {new Date(window.endAt).toLocaleDateString()}
              </Typography>
            </View>
            <Button testID={`admin-signup-promotions.windows.toggle.${window.id}`}
              label={window.isActive ? 'Active' : 'Inactive'}
              variant="secondary"
              loading={updateWindow.isPending}
              onPress={() => updateWindow.mutate({ id: window.id, isActive: !window.isActive }, { onError: showError })}
            />
          </View>
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  formCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inactiveText: { color: colors.inkMuted, textDecorationLine: 'line-through' },
})
