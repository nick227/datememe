import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminBulkSaveEntities, useAdminEntityTypes, useAdminGenerateEntities } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminTaxonomyGenerate'>

export function AdminTaxonomyGenerateScreen({ route, navigation }: Props) {
  const { parentEntityId, parentEntityName, parentEntityTypeId } = route.params

  const types = useAdminEntityTypes()
  // Same rule apps/admin's Taxonomy page uses: candidates get saved as the one
  // entity type that nests directly under the parent's own type.
  const childType = types.data?.find((t) => t.parentId === parentEntityTypeId)

  const [prompt, setPrompt] = useState('')
  const [candidates, setCandidates] = useState<string[] | null>(null)
  const generate = useAdminGenerateEntities()
  const bulkSave = useAdminBulkSaveEntities()
  const sheet = useActionSheet()

  function handleGenerate() {
    generate.mutate(
      { categoryName: parentEntityName, prompt, count: 10 },
      {
        onSuccess: (result) => setCandidates(result),
        onError: (err) => sheet.show({ title: 'Could not generate', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-taxonomy-generate.dialog.ok', text: 'OK' }] }),
      },
    )
  }

  function moveCandidate(index: number, delta: number) {
    setCandidates((current) => {
      if (!current) return current
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateCandidate(index: number, value: string) {
    setCandidates((current) => current?.map((c, i) => (i === index ? value : c)) ?? current)
  }

  function removeCandidate(index: number) {
    setCandidates((current) => current?.filter((_, i) => i !== index) ?? current)
  }

  function handleApprove() {
    if (!childType || !candidates || candidates.length === 0) return
    bulkSave.mutate(
      { entityTypeId: childType.id, parentId: parentEntityId, entities: candidates },
      {
        onSuccess: () => sheet.show({ title: 'Saved', buttons: [{ testID: 'admin-taxonomy-generate.dialog.ok', text: 'OK', onPress: () => navigation.goBack() }] }),
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-taxonomy-generate.dialog.ok', text: 'OK' }] }),
      },
    )
  }

  return (
    <ScreenContainer testID="screen.admin-taxonomy-generate" width="narrow">
      <TopNavigation testID="admin-taxonomy-generate.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title="Generate children"
        subtitle={parentEntityName}
      />

      {!childType ? (
        <ErrorState testID="admin-taxonomy-generate.error" title="No child type defined" subtitle={`Add an entity type whose parent is "${parentEntityName}"'s type before generating.`} />
      ) : candidates === null ? (
        <>
          <TextField testID="admin-taxonomy-generate.prompt"
            label="Prompt instructions (optional)"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={3}
            placeholder={`e.g. Generate the top 10 models for ${parentEntityName}`}
          />
          <Button testID="admin-taxonomy-generate.generate" label={generate.isPending ? 'Generating…' : 'Generate candidates'} loading={generate.isPending} onPress={handleGenerate} />
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <Typography variant="bodyMuted" style={styles.reviewHint}>
            Review, edit, and reorder candidates before saving.
          </Typography>
          <FlatList
            data={candidates}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
            renderItem={({ item, index }) => (
              <View style={styles.candidateRow}>
                <View style={styles.reorderCol}>
                  <Pressable hitSlop={6} disabled={index === 0} onPress={() => moveCandidate(index, -1)}>
                    <Icon name="ChevronUp" size={16} color={index === 0 ? colors.surfaceMuted : colors.inkMuted} />
                  </Pressable>
                  <Pressable hitSlop={6} disabled={index === candidates.length - 1} onPress={() => moveCandidate(index, 1)}>
                    <Icon name="ChevronDown" size={16} color={index === candidates.length - 1 ? colors.surfaceMuted : colors.inkMuted} />
                  </Pressable>
                </View>
                <View style={styles.candidateInputWrapper}>
                  <TextField testID="admin-taxonomy-generate.item" value={item} onChangeText={(v) => updateCandidate(index, v)} />
                </View>
                <Pressable hitSlop={8} onPress={() => removeCandidate(index)} style={styles.removeBtn}>
                  <Icon name="X" size={18} color={colors.danger} />
                </Pressable>
              </View>
            )}
            ListFooterComponent={
              <Pressable testID="admin-taxonomy-generate.candidates" style={styles.addRow} onPress={() => setCandidates((c) => [...(c ?? []), 'New item'])}>
                <Typography variant="label">+ Add custom item</Typography>
              </Pressable>
            }
          />

          <View style={styles.footer}>
            <Button testID="admin-taxonomy-generate.discard-start-over" label="Discard & start over" variant="secondary" onPress={() => setCandidates(null)} />
            <Button testID="admin-taxonomy-generate.approve"
              label={bulkSave.isPending ? 'Saving…' : `Approve & save ${candidates.length}`}
              loading={bulkSave.isPending}
              disabled={candidates.length === 0}
              onPress={handleApprove}
            />
          </View>
        </View>
      )}

      <ActionSheet testID="admin-taxonomy-generate.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  reviewHint: { marginBottom: spacing.md },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reorderCol: {
    width: 20,
    gap: 2,
  },
  candidateInputWrapper: {
    flex: 1,
  },
  removeBtn: {
    padding: spacing.xs,
  },
  addRow: {
    borderWidth: borderWidth.thin,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
})
