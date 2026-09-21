import { useState } from 'react'
import { StyleSheet, View, ScrollView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminCreatePlan, useAdminPlans, useAdminUpdatePlan } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminMemberships'>

const INTERVAL_OPTIONS = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Annual', value: 'ANNUAL' },
  { label: 'Lifetime', value: 'LIFETIME' },
]

const STATUS_OPTIONS = [
  { label: 'Active (visible to new signups)', value: 'active' },
  { label: 'Archived (hidden from new signups)', value: 'archived' },
]

export function AdminMembershipsScreen({ navigation }: Props) {
  const plans = useAdminPlans()
  const createPlan = useAdminCreatePlan()
  const updatePlan = useAdminUpdatePlan()
  const sheet = useActionSheet()

  const [isCreating, setIsCreating] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [interval, setInterval] = useState('MONTHLY')
  const [priceUsd, setPriceUsd] = useState('0')
  const [status, setStatus] = useState('active')

  function resetForm() {
    setLabel('')
    setSlug('')
    setInterval('MONTHLY')
    setPriceUsd('0')
    setStatus('active')
  }

  function showError(title: string, err: unknown) {
    sheet.show({ title, message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ testID: 'admin-memberships.dialog.ok', text: 'OK' }] })
  }

  function startCreate() {
    resetForm()
    setEditingPlanId(null)
    setIsCreating(true)
  }

  function startEdit(plan: NonNullable<typeof plans.data>[number]) {
    setIsCreating(false)
    setEditingPlanId(plan.id)
    setPriceUsd((plan.priceCents / 100).toFixed(2))
    setStatus(plan.isActive ? 'active' : 'archived')
  }

  function handleCreate() {
    createPlan.mutate(
      { label, slug, interval: interval as any, priceCents: Math.round(parseFloat(priceUsd || '0') * 100), isActive: status === 'active' },
      {
        onSuccess: () => setIsCreating(false),
        onError: (err) => showError('Could not create plan', err),
      },
    )
  }

  function handleSaveEdit(planId: string) {
    updatePlan.mutate(
      { planId, priceCents: Math.round(parseFloat(priceUsd || '0') * 100), isActive: status === 'active' },
      {
        onSuccess: () => setEditingPlanId(null),
        onError: (err) => showError('Could not update plan', err),
      },
    )
  }

  return (
    <ScreenContainer testID="screen.admin-memberships" width="wide">
      <TopNavigation testID="admin-memberships.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Memberships" />

      {!isCreating && (
        <Button testID="admin-memberships.open-create" label="+ Create plan" variant="secondary" onPress={startCreate} />
      )}

      {isCreating && (
        <View style={[styles.card, styles.cardHighlight]}>
          <Typography variant="heading" style={{ marginBottom: spacing.md }}>Create new plan</Typography>
          <TextField testID="admin-memberships.label" label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Premium Plan" />
          <TextField testID="admin-memberships.slug" label="Slug" value={slug} onChangeText={setSlug} placeholder="e.g. premium" autoCapitalize="none" />
          <SelectField testID="admin-memberships.interval" label="Interval" value={interval} options={INTERVAL_OPTIONS} onSelect={setInterval} />
          <TextField testID="admin-memberships.price-usd" label="Price (USD)" value={priceUsd} onChangeText={setPriceUsd} keyboardType="decimal-pad" />
          <SelectField testID="admin-memberships.status" label="Initial status" value={status} options={STATUS_OPTIONS} onSelect={setStatus} />
          <View style={styles.actionsRow}>
            <Button testID="admin-memberships.create" label="Create plan" loading={createPlan.isPending} onPress={handleCreate} />
            <Button testID="admin-memberships.cancel" label="Cancel" variant="secondary" onPress={() => setIsCreating(false)} />
          </View>
        </View>
      )}

      {plans.isLoading ? (
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {[0, 1].map((i) => <Skeleton key={i} height={160} />)}
        </View>
      ) : plans.isError ? (
        <ErrorState testID="admin-memberships.error" subtitle="Couldn't load plans." onRetry={() => plans.refetch()} />
      ) : (
        <ScrollView style={{ marginTop: spacing.md }}>
          {(plans.data ?? []).map((plan) => (
            <View testID={`admin-memberships.plan.${plan.id}`} key={plan.id} style={[styles.card, !plan.isActive && styles.cardArchived]}>
              <View style={styles.row}>
                <Typography variant="heading">{plan.label}</Typography>
                {!plan.isActive ? (
                  <View style={styles.archivedPill}><Typography variant="label" style={{ color: colors.inkMuted }}>Archived</Typography></View>
                ) : null}
              </View>

              {editingPlanId === plan.id ? (
                <>
                  <SelectField testID={`admin-memberships.status.${plan.id}`} label="Status" value={status} options={STATUS_OPTIONS} onSelect={setStatus} />
                  <TextField testID={`admin-memberships.price-usd.${plan.id}`} label="Price (USD)" value={priceUsd} onChangeText={setPriceUsd} keyboardType="decimal-pad" />
                  <View style={styles.actionsRow}>
                    <Button testID={`admin-memberships.save-changes.${plan.id}`} label="Save changes" loading={updatePlan.isPending} onPress={() => handleSaveEdit(plan.id)} />
                    <Button testID={`admin-memberships.cancel.${plan.id}`} label="Cancel" variant="secondary" onPress={() => setEditingPlanId(null)} />
                  </View>
                </>
              ) : (
                <>
                  <Typography variant="display" style={{ marginVertical: spacing.sm }}>
                    ${(plan.priceCents / 100).toFixed(2)}{' '}
                    <Typography variant="bodyMuted">/{plan.interval.toLowerCase()}</Typography>
                  </Typography>
                  <View style={styles.footerRow}>
                    <Typography variant="bodyMuted">{plan._count.subscriptions} active subs</Typography>
                    <Button testID={`admin-memberships.edit-plan.${plan.id}`} label="Edit plan" variant="secondary" onPress={() => startEdit(plan)} />
                  </View>
                </>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <ActionSheet testID="admin-memberships.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
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
  cardHighlight: { borderColor: colors.primary },
  cardArchived: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archivedPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
