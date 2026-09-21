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
  { label: 'Active (visible)', value: 'active' },
  { label: 'Archived (grandfathered)', value: 'archived' },
]

function parseFeaturesOrNull(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

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
  const [featuresText, setFeaturesText] = useState('{}')

  function resetForm() {
    setLabel('')
    setSlug('')
    setInterval('MONTHLY')
    setPriceUsd('0')
    setStatus('active')
    setFeaturesText('{}')
  }

  function showError(title: string, err: unknown) {
    sheet.show({ title, message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ text: 'OK' }] })
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
    setFeaturesText(JSON.stringify(plan.features ?? {}, null, 2))
  }

  function handleCreate() {
    const features = parseFeaturesOrNull(featuresText)
    if (features === null) {
      sheet.show({ title: 'Invalid entitlements', message: 'Features must be valid JSON.', buttons: [{ text: 'OK' }] })
      return
    }
    createPlan.mutate(
      { label, slug, interval: interval as any, priceCents: Math.round(parseFloat(priceUsd || '0') * 100), isActive: status === 'active', features },
      {
        onSuccess: () => setIsCreating(false),
        onError: (err) => showError('Could not create plan', err),
      },
    )
  }

  function handleSaveEdit(planId: string) {
    const features = parseFeaturesOrNull(featuresText)
    if (features === null) {
      sheet.show({ title: 'Invalid entitlements', message: 'Features must be valid JSON.', buttons: [{ text: 'OK' }] })
      return
    }
    updatePlan.mutate(
      { planId, priceCents: Math.round(parseFloat(priceUsd || '0') * 100), isActive: status === 'active', features },
      {
        onSuccess: () => setEditingPlanId(null),
        onError: (err) => showError('Could not update plan', err),
      },
    )
  }

  return (
    <ScreenContainer width="wide">
      <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Memberships" />

      {!isCreating && (
        <Button label="+ Create plan" variant="secondary" onPress={startCreate} />
      )}

      {isCreating && (
        <View style={[styles.card, styles.cardHighlight]}>
          <Typography variant="heading" style={{ marginBottom: spacing.md }}>Create new plan</Typography>
          <TextField label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Premium Plan" />
          <TextField label="Slug" value={slug} onChangeText={setSlug} placeholder="e.g. premium" autoCapitalize="none" />
          <SelectField label="Interval" value={interval} options={INTERVAL_OPTIONS} onSelect={setInterval} />
          <TextField label="Price (USD)" value={priceUsd} onChangeText={setPriceUsd} keyboardType="decimal-pad" />
          <TextField label="Entitlements (JSON)" value={featuresText} onChangeText={setFeaturesText} multiline style={styles.jsonInput} />
          <SelectField label="Initial status" value={status} options={STATUS_OPTIONS} onSelect={setStatus} />
          <View style={styles.actionsRow}>
            <Button label="Create plan" loading={createPlan.isPending} onPress={handleCreate} />
            <Button label="Cancel" variant="secondary" onPress={() => setIsCreating(false)} />
          </View>
        </View>
      )}

      {plans.isLoading ? (
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {[0, 1].map((i) => <Skeleton key={i} height={160} />)}
        </View>
      ) : plans.isError ? (
        <ErrorState subtitle="Couldn't load plans." onRetry={() => plans.refetch()} />
      ) : (
        <ScrollView style={{ marginTop: spacing.md }}>
          {(plans.data ?? []).map((plan) => (
            <View key={plan.id} style={[styles.card, !plan.isActive && styles.cardArchived]}>
              <View style={styles.row}>
                <Typography variant="heading">{plan.label}</Typography>
                {!plan.isActive ? (
                  <View style={styles.archivedPill}><Typography variant="label" style={{ color: colors.inkMuted }}>Archived</Typography></View>
                ) : null}
              </View>

              {editingPlanId === plan.id ? (
                <>
                  <SelectField label="Status" value={status} options={STATUS_OPTIONS} onSelect={setStatus} />
                  <TextField label="Price (USD)" value={priceUsd} onChangeText={setPriceUsd} keyboardType="decimal-pad" />
                  <TextField label="Entitlements (JSON)" value={featuresText} onChangeText={setFeaturesText} multiline style={styles.jsonInput} />
                  <View style={styles.actionsRow}>
                    <Button label="Save changes" loading={updatePlan.isPending} onPress={() => handleSaveEdit(plan.id)} />
                    <Button label="Cancel" variant="secondary" onPress={() => setEditingPlanId(null)} />
                  </View>
                </>
              ) : (
                <>
                  <Typography variant="display" style={{ marginVertical: spacing.sm }}>
                    ${(plan.priceCents / 100).toFixed(2)}{' '}
                    <Typography variant="bodyMuted">/{plan.interval.toLowerCase()}</Typography>
                  </Typography>
                  <Typography variant="label" style={{ color: colors.inkMuted, marginBottom: spacing.xs }}>Entitlements</Typography>
                  <View style={styles.featuresBox}>
                    <Typography variant="label" style={{ fontFamily: 'monospace' as any }}>
                      {JSON.stringify(plan.features ?? {}, null, 2)}
                    </Typography>
                  </View>
                  <View style={styles.footerRow}>
                    <Typography variant="bodyMuted">{plan._count.subscriptions} active subs</Typography>
                    <Button label="Edit plan" variant="secondary" onPress={() => startEdit(plan)} />
                  </View>
                </>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
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
  jsonInput: { minHeight: 96, textAlignVertical: 'top' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  featuresBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})
