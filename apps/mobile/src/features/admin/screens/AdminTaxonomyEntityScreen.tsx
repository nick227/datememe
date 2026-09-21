import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminEntities, useAdminEntityTypes, useAdminUpdateEntity } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { AdminImagePicker } from '../components/AdminImagePicker'
import { colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminTaxonomyEntity'>

const STATUS_OPTIONS = [
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Archived (Rejected)', value: 'REJECTED' },
]

export function AdminTaxonomyEntityScreen({ route, navigation }: Props) {
  const { id, entityTypeId, canonicalName, slug, parentId, status } = route.params

  const types = useAdminEntityTypes()
  const currentType = types.data?.find((t) => t.id === entityTypeId)
  // Reparenting only ever targets entities of the type this entity's type
  // nests under (mirrors the check apps/server's updateEntity makes), so the
  // picker's candidate pool is entities of that one type, not everything.
  const parentTypeId = currentType?.parentId ?? undefined
  const parentCandidates = useAdminEntities(parentTypeId)
  const hasChildType = !!types.data?.some((t) => t.parentId === entityTypeId)

  // Same-type fetch, separate from the reparent candidates above — this one
  // is just to read this entity's own current thumbnail for the picker.
  const sameTypeEntities = useAdminEntities(entityTypeId)
  const currentAsset = sameTypeEntities.data?.find((e) => e.id === id)?.mediaAssets.find((m) => m.isPrimary) ?? null

  const updateEntity = useAdminUpdateEntity()
  const sheet = useActionSheet()

  const [form, setForm] = useState({ canonicalName, slug, parentId, status })

  function handleSave() {
    updateEntity.mutate(
      { id, canonicalName: form.canonicalName, slug: form.slug, parentId: form.parentId, status: form.status as any },
      {
        onSuccess: () => sheet.show({ title: 'Saved', buttons: [{ testID: 'admin-taxonomy-entity.dialog.ok', text: 'OK', onPress: () => navigation.goBack() }] }),
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-taxonomy-entity.dialog.ok', text: 'OK' }] }),
      },
    )
  }

  const parentOptions = [
    { label: '(No parent — root level)', value: '' },
    ...(parentCandidates.data ?? [])
      .filter((e) => e.id !== id)
      .map((e) => ({ label: e.canonicalName, value: e.id })),
  ]

  return (
    <ScreenContainer testID="screen.admin-taxonomy-entity" width="narrow">
      <TopNavigation testID="admin-taxonomy-entity.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title="Edit Value"
        rightElement={
          hasChildType ? (
            <Pressable testID="admin-taxonomy-entity.open-admin-taxonomy-generate"
              hitSlop={12}
              onPress={() =>
                navigation.navigate('AdminTaxonomyGenerate', {
                  parentEntityId: id,
                  parentEntityName: form.canonicalName,
                  parentEntityTypeId: entityTypeId,
                })
              }
            >
              <Typography variant="button" style={styles.generateLink}>Generate…</Typography>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView>
        <TextField testID="admin-taxonomy-entity.canonical-name" label="Canonical name" value={form.canonicalName} onChangeText={(v) => setForm((f) => ({ ...f, canonicalName: v }))} />
        <TextField testID="admin-taxonomy-entity.slug" label="Slug" value={form.slug} onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))} autoCapitalize="none" />

        {parentTypeId ? (
          <View style={styles.reparentBox}>
            <Typography variant="label" style={styles.reparentTitle}>Move / reparent</Typography>
            <Typography variant="bodyMuted" style={styles.reparentWarning}>
              Moving this value affects every List scoped to its current parent.
            </Typography>
            <SelectField testID="admin-taxonomy-entity.parent-id"
              value={form.parentId ?? ''}
              options={parentOptions}
              onSelect={(v) => setForm((f) => ({ ...f, parentId: v || null }))}
              placeholder="Parent"
            />
          </View>
        ) : null}

        <SelectField testID="admin-taxonomy-entity.status"
          label="Status"
          value={form.status}
          options={STATUS_OPTIONS}
          onSelect={(v) => setForm((f) => ({ ...f, status: v }))}
        />

        <Button testID="admin-taxonomy-entity.save" label="Save changes" loading={updateEntity.isPending} onPress={handleSave} />

        <AdminImagePicker
          target={{ entityId: id }}
          query={form.canonicalName}
          entityTypeLabel={currentType?.label}
          asset={currentAsset}
          onAttached={() => {}}
        />
      </ScrollView>

      <ActionSheet testID="admin-taxonomy-entity.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  reparentBox: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reparentTitle: { marginBottom: spacing.xs },
  reparentWarning: { marginBottom: spacing.sm },
  generateLink: { color: colors.primary },
})
