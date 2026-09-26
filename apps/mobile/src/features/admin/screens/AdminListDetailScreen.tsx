import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AnimatedSheet } from '../../../ui/AnimatedSheet'
import {
  ApiError,
  useAdminBulkSaveEntities,
  useAdminCreateListDefinition,
  useAdminEntities,
  useAdminEntitiesByParent,
  useAdminEntityTypes,
  useAdminGenerateEntities,
  useAdminListCuratedEntities,
  useAdminListDefinitions,
  useAdminUpdateListCuratedEntities,
  useAdminUpdateListDefinition,
  useCategoryGroups,
} from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { AdminImagePicker } from '../components/AdminImagePicker'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminListDetail'>

const ORDERING_OPTIONS = [
  { label: 'Ranked', value: 'RANKED' },
  { label: 'Unranked', value: 'UNRANKED' },
]

type FormState = {
  groupId: string
  entityTypeId: string
  parentEntityId: string | null
  slug: string
  prompt: string
  shortLabel: string
  minItems: string
  maxItems: string
  orderingMode: 'RANKED' | 'UNRANKED'
  isMatchSignal: boolean
  isPremiumOnly: boolean
  isActive: boolean
}

const BLANK_FORM: FormState = {
  groupId: '',
  entityTypeId: '',
  parentEntityId: null,
  slug: 'new-list',
  prompt: 'Rank the following...',
  shortLabel: 'New List',
  minItems: '1',
  maxItems: '5',
  orderingMode: 'RANKED',
  isMatchSignal: true,
  isPremiumOnly: false,
  isActive: true,
}

export function AdminListDetailScreen({ route, navigation }: Props) {
  const listId = route.params?.listId

  const lists = useAdminListDefinitions()
  const groups = useCategoryGroups()
  const types = useAdminEntityTypes()
  const list = listId ? lists.data?.find((l) => l.id === listId) : undefined

  const createList = useAdminCreateListDefinition()
  const updateList = useAdminUpdateListDefinition()
  const sheet = useActionSheet()

  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!listId) {
      hydrated.current = true
      return
    }
    if (hydrated.current || !list) return
    setForm({
      groupId: list.groupId,
      entityTypeId: list.entityTypeId,
      parentEntityId: list.parentEntityId,
      slug: list.slug,
      prompt: list.prompt,
      shortLabel: list.shortLabel,
      minItems: String(list.minItems),
      maxItems: String(list.maxItems),
      orderingMode: list.orderingMode as 'RANKED' | 'UNRANKED',
      isMatchSignal: list.isMatchSignal,
      isPremiumOnly: list.isPremiumOnly,
      isActive: list.isActive,
    })
    hydrated.current = true
  }, [list, listId])

  // Reparenting rule reused from Taxonomy: a List's "parent entity
  // constraint" must be an entity of the type its own entity type nests
  // under, same hierarchy check apps/server's updateEntity enforces.
  const selectedType = types.data?.find((t) => t.id === form.entityTypeId)
  const parentTypeId = selectedType?.parentId ?? undefined
  const parentCandidates = useAdminEntities(parentTypeId)

  function handleEntityTypeChange(id: string) {
    setForm((f) => ({ ...f, entityTypeId: id, parentEntityId: null }))
  }

  function handleSaveConfig() {
    const body = {
      groupId: form.groupId,
      entityTypeId: form.entityTypeId,
      parentEntityId: form.parentEntityId,
      slug: form.slug.trim(),
      prompt: form.prompt.trim(),
      shortLabel: form.shortLabel.trim(),
      minItems: parseInt(form.minItems, 10) || 1,
      maxItems: parseInt(form.maxItems, 10) || 1,
      orderingMode: form.orderingMode,
      isMatchSignal: form.isMatchSignal,
      isPremiumOnly: form.isPremiumOnly,
      isActive: form.isActive,
    }
    if (!body.groupId || !body.entityTypeId || !body.slug || !body.prompt || !body.shortLabel) {
      sheet.show({ title: 'Missing fields', message: 'Group, entity type, slug, prompt, and name are all required.', buttons: [{ testID: 'admin-list-detail.dialog.ok', text: 'OK' }] })
      return
    }
    if (listId) {
      updateList.mutate(
        { id: listId, ...body },
        {
          onSuccess: () => sheet.show({ title: 'Saved', message: 'List details saved.', buttons: [{ testID: 'admin-list-detail.dialog.ok', text: 'OK' }] }),
          onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-list-detail.dialog.ok', text: 'OK' }] }),
        },
      )
    } else {
      createList.mutate(body, {
        onSuccess: (created) => {
          navigation.setParams({ listId: created.id })
          sheet.show({ title: 'List created', message: 'Now add curated values below.', buttons: [{ testID: 'admin-list-detail.dialog.ok', text: 'OK' }] })
        },
        onError: (err) => sheet.show({ title: 'Could not create', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-list-detail.dialog.ok', text: 'OK' }] }),
      })
    }
  }

  if (listId && lists.isLoading) {
    return (
      <ScreenContainer testID="screen.admin-list-detail" width="wide">
        <TopNavigation testID="admin-list-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="List" />
        <Skeleton height={300} />
      </ScreenContainer>
    )
  }

  if (listId && (lists.isError || !list)) {
    return (
      <ScreenContainer testID="screen.admin-list-detail" width="wide">
        <TopNavigation testID="admin-list-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="List" />
        <ErrorState testID="admin-list-detail.error" subtitle="Couldn't load this list." onRetry={() => lists.refetch()} />
      </ScreenContainer>
    )
  }

  const groupOptions = (groups.data ?? []).map((g) => ({ label: g.label, value: g.id }))
  const typeOptions = (types.data ?? []).map((t) => ({ label: t.label, value: t.id }))
  const parentOptions = [
    { label: '(No parent constraint — all entities of this type)', value: '' },
    ...(parentCandidates.data ?? []).map((e) => ({ label: e.canonicalName, value: e.id })),
  ]

  return (
    <ScreenContainer testID="screen.admin-list-detail" width="wide">
      <TopNavigation testID="admin-list-detail.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={listId ? 'Edit List' : 'New List'}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Typography variant="heading" style={styles.cardTitle}>List configuration</Typography>

          <TextField testID="admin-list-detail.short-label" label="List name (short label)" value={form.shortLabel} onChangeText={(v) => setForm((f) => ({ ...f, shortLabel: v }))} />
          <TextField testID="admin-list-detail.slug" label="Slug" value={form.slug} onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))} autoCapitalize="none" />
          <TextField testID="admin-list-detail.prompt" label="Prompt (question)" value={form.prompt} onChangeText={(v) => setForm((f) => ({ ...f, prompt: v }))} />

          <View style={styles.scopeBox}>
            <Typography variant="label" style={styles.scopeTitle}>Taxonomy scope</Typography>
            <SelectField testID="admin-list-detail.group-id" label="Group" value={form.groupId} options={groupOptions} onSelect={(v) => setForm((f) => ({ ...f, groupId: v }))} placeholder="Select a group…" />
            <SelectField testID="admin-list-detail.entity-type-id" label="Entity type (required)" value={form.entityTypeId} options={typeOptions} onSelect={handleEntityTypeChange} placeholder="Select a type…" />
            {parentTypeId ? (
              <>
                <SelectField testID="admin-list-detail.parent-entity-id"
                  label="Parent entity constraint (optional)"
                  value={form.parentEntityId ?? ''}
                  options={parentOptions}
                  onSelect={(v) => setForm((f) => ({ ...f, parentEntityId: v || null }))}
                  placeholder="No constraint"
                />
                <Typography variant="bodyMuted" style={styles.scopeHint}>Leave empty to include all entities of the type.</Typography>
              </>
            ) : null}
          </View>

          <View style={styles.row}>
            <View style={styles.rowField}>
              <TextField testID="admin-list-detail.min-items" label="Min items" value={form.minItems} onChangeText={(v) => setForm((f) => ({ ...f, minItems: v }))} keyboardType="number-pad" />
            </View>
            <View style={styles.rowField}>
              <TextField testID="admin-list-detail.max-items" label="Max items" value={form.maxItems} onChangeText={(v) => setForm((f) => ({ ...f, maxItems: v }))} keyboardType="number-pad" />
            </View>
          </View>
          <SelectField testID="admin-list-detail.ordering-mode" label="Ordering" value={form.orderingMode} options={ORDERING_OPTIONS} onSelect={(v) => setForm((f) => ({ ...f, orderingMode: v as 'RANKED' | 'UNRANKED' }))} />

          <View style={styles.toggleRow}>
            <Typography variant="body">Active (visible in app)</Typography>
            <Button testID="admin-list-detail.active" label={form.isActive ? 'Active' : 'Archived'} variant="secondary" onPress={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} />
          </View>
          <View style={styles.toggleRow}>
            <Typography variant="body">Premium only</Typography>
            <Button testID="admin-list-detail.premium-only" label={form.isPremiumOnly ? 'Yes' : 'No'} variant="secondary" onPress={() => setForm((f) => ({ ...f, isPremiumOnly: !f.isPremiumOnly }))} />
          </View>

          <Button testID="admin-list-detail.save-config" label="Save configuration" loading={createList.isPending || updateList.isPending} onPress={handleSaveConfig} />

          {listId && list ? (
            <AdminImagePicker
              target={{ categoryId: listId }}
              query={form.shortLabel}
              entityTypeLabel={selectedType?.label}
              asset={list.mediaAssets.find((m) => m.isPrimary) ?? null}
              onAttached={() => {}}
            />
          ) : null}
        </View>

        {listId ? (
          <CuratedValuesEditor key={listId} listId={listId} entityTypeId={form.entityTypeId} parentEntityId={form.parentEntityId} shortLabel={form.shortLabel} />
        ) : null}
      </ScrollView>

      <ActionSheet testID="admin-list-detail.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

type CuratedItem = { entityId: string; name: string; imageUrl?: string | null }

function CuratedValuesEditor({
  listId,
  entityTypeId,
  parentEntityId,
  shortLabel,
}: {
  listId: string
  entityTypeId: string
  parentEntityId: string | null
  shortLabel: string
}) {
  const curated = useAdminListCuratedEntities(listId)
  const available = useAdminEntitiesByParent(entityTypeId, parentEntityId, !!entityTypeId)
  const saveCurated = useAdminUpdateListCuratedEntities()
  const sheet = useActionSheet()

  // A null draft follows server data until the first edit; refetches cannot
  // overwrite an in-progress selection. The component is keyed by list ID.
  const [selectedDraft, setSelectedDraft] = useState<CuratedItem[] | null>(null)
  const selectedValues = selectedDraft ?? (curated.data ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ entityId: c.entityId, name: c.entity.canonicalName, imageUrl: c.entity.imageUrl }))
  const [searchQuery, setSearchQuery] = useState('')
  const selectionReady = curated.data !== undefined
  const editingDisabled = !selectionReady || saveCurated.isPending

  function setSelectedValues(update: (previous: CuratedItem[]) => CuratedItem[]) {
    setSelectedDraft((previous) => update(previous ?? selectedValues))
  }

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [genCandidates, setGenCandidates] = useState<string[] | null>(null)
  const generate = useAdminGenerateEntities()
  const bulkSave = useAdminBulkSaveEntities()

  const filteredAvailable = (available.data ?? []).filter(
    (e) => e.canonicalName.toLowerCase().includes(searchQuery.trim().toLowerCase()) && !selectedValues.some((c) => c.entityId === e.id),
  )

  function addEntity(entity: { id: string; canonicalName: string; imageUrl?: string | null }) {
    if (editingDisabled) return
    setSelectedValues((prev) => prev.some((c) => c.entityId === entity.id)
      ? prev
      : [...prev, { entityId: entity.id, name: entity.canonicalName, imageUrl: entity.imageUrl }])
  }

  function removeEntity(entityId: string) {
    setSelectedValues((prev) => prev.filter((c) => c.entityId !== entityId))
  }

  function moveEntity(index: number, delta: number) {
    setSelectedValues((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleSaveCurated() {
    if (editingDisabled) return
    saveCurated.mutate(
      { id: listId, entities: selectedValues.map((c, i) => ({ entityId: c.entityId, sortOrder: i })) },
      {
        onSuccess: () => sheet.show({ title: 'Saved', message: 'Curated values saved.', buttons: [{ testID: 'admin-list-detail.curated-dialog.ok', text: 'OK' }] }),
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-list-detail.curated-dialog.ok', text: 'OK' }] }),
      },
    )
  }

  function closeGenerateModal() {
    setShowGenerateModal(false)
    setGenPrompt('')
    setGenCandidates(null)
  }

  function handleGenerate() {
    generate.mutate(
      { categoryName: shortLabel, prompt: genPrompt, count: 10 },
      {
        onSuccess: (result) => setGenCandidates(result),
        onError: (err) => sheet.show({ title: 'Could not generate', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-list-detail.curated-dialog.ok', text: 'OK' }] }),
      },
    )
  }

  function updateCandidate(index: number, value: string) {
    setGenCandidates((current) => current?.map((c, i) => (i === index ? value : c)) ?? current)
  }

  function moveCandidate(index: number, delta: number) {
    setGenCandidates((current) => {
      if (!current) return current
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeCandidate(index: number) {
    setGenCandidates((current) => current?.filter((_, i) => i !== index) ?? current)
  }

  function handleApproveCandidates() {
    if (!genCandidates || genCandidates.length === 0) return
    bulkSave.mutate(
      { entityTypeId, parentId: parentEntityId, entities: genCandidates },
      {
        onSuccess: (result) => {
          setSelectedValues((prev) => [
            ...prev,
            ...result.entities
              .filter((e) => !prev.some((c) => c.entityId === e.id))
              .map((e) => ({ entityId: e.id, name: e.canonicalName, imageUrl: e.imageUrl })),
          ])
          closeGenerateModal()
        },
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-list-detail.curated-dialog.ok', text: 'OK' }] }),
      },
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.curatedHeader}>
        <View style={{ flex: 1 }}>
          <Typography variant="heading">Curated values</Typography>
          <Typography variant="bodyMuted">Add available values to your selection, then order and save them.</Typography>
        </View>
        <Pressable testID="admin-list-detail.show-generate-modal" hitSlop={8} disabled={editingDisabled || !entityTypeId} onPress={() => setShowGenerateModal(true)}>
          <Typography variant="button" style={styles.aiLink}>AI suggest…</Typography>
        </Pressable>
      </View>

      <TextField testID="admin-list-detail.search-query" placeholder="Search available values…" value={searchQuery} onChangeText={setSearchQuery} />

      <Typography variant="label" style={styles.selectedValuesLabel}>Available values</Typography>
      <ScrollView testID="admin-list-detail.available-values" style={styles.availableList} nestedScrollEnabled keyboardShouldPersistTaps="handled">

        {available.isLoading ? (
          <Skeleton height={80} />
        ) : available.isError ? (
          <ErrorState testID="admin-list-detail.available-error" subtitle="Couldn't load available values." onRetry={() => available.refetch()} />
        ) : filteredAvailable.length === 0 ? (
          <Typography variant="bodyMuted" style={styles.centeredHint}>{searchQuery.trim() ? 'No available values match your search.' : available.data?.length ? 'All available values are selected.' : 'No values are available for this list.'}</Typography>
        ) : (
          filteredAvailable.map((entity) => (
            <View testID={`admin-list-detail.entity.${entity.id}`} key={entity.id} style={styles.availableRow}>
              <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>{entity.canonicalName}</Typography>
              <Pressable testID={`admin-list-detail.entity.${entity.id}.add`} accessibilityRole="button" accessibilityLabel={`Add ${entity.canonicalName}`} style={styles.valueAction} disabled={editingDisabled} onPress={() => addEntity(entity)}>
                <Icon name="Plus" size={18} color={colors.primary} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Typography variant="label" style={styles.selectedValuesLabel}>Selected values{selectionReady ? ` (${selectedValues.length})` : ''}</Typography>
      {!selectionReady ? (
        curated.isError ? (
          <ErrorState testID="admin-list-detail.curated-error" subtitle="Couldn't load selected values. Retry before editing." onRetry={() => curated.refetch()} />
        ) : <Skeleton height={80} />
      ) : selectedValues.length === 0 ? (
        <View style={styles.emptyCurated}>
          <Typography variant="bodyMuted">No values selected yet. Use + beside an available value to add it.</Typography>
        </View>
      ) : (
        <ScrollView testID="admin-list-detail.selected-values" style={styles.selectedList} contentContainerStyle={{ gap: spacing.xs }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {selectedValues.map((item, index) => (
            <View testID={`admin-list-detail.selected.${item.entityId}`} key={item.entityId} style={styles.curatedRow}>
              <View style={styles.reorderCol}>
                <Pressable testID={`admin-list-detail.selected.${item.entityId}.move-up`} accessibilityRole="button" accessibilityLabel={`Move ${item.name} up`} style={styles.valueAction} disabled={editingDisabled || index === 0} onPress={() => moveEntity(index, -1)}>
                  <Icon name="ChevronUp" size={16} color={index === 0 ? colors.surfaceMuted : colors.inkMuted} />
                </Pressable>
                <Pressable testID={`admin-list-detail.selected.${item.entityId}.move-down`} accessibilityRole="button" accessibilityLabel={`Move ${item.name} down`} style={styles.valueAction} disabled={editingDisabled || index === selectedValues.length - 1} onPress={() => moveEntity(index, 1)}>
                  <Icon name="ChevronDown" size={16} color={index === selectedValues.length - 1 ? colors.surfaceMuted : colors.inkMuted} />
                </Pressable>
              </View>
              <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>{item.name}</Typography>
              <Pressable testID={`admin-list-detail.selected.${item.entityId}.remove`} accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} style={styles.valueAction} disabled={editingDisabled} onPress={() => removeEntity(item.entityId)}>
                <Icon name="X" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Button disabled={editingDisabled} testID="admin-list-detail.save-curated" label="Save curated values" loading={saveCurated.isPending} onPress={handleSaveCurated} />

      <AnimatedSheet testID="admin-list-detail.generate-dialog.modal" visible={showGenerateModal} onClose={closeGenerateModal} sheetStyle={styles.modalContent}>
        <View testID="admin-list-detail.generate-dialog" style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
              <Typography testID="admin-list-detail.generate-dialog.title" variant="heading">Curate AI values for {shortLabel}</Typography>
              <Pressable testID="admin-list-detail.generate-dialog.close" hitSlop={8} onPress={closeGenerateModal}>
                <Icon name="X" size={22} />
              </Pressable>
            </View>

            {genCandidates === null ? (
              <View testID="admin-list-detail.generate-dialog.prompt-step" style={{ padding: spacing.lg }}>
                <TextField testID="admin-list-detail.gen-prompt"
                  label="Prompt instructions (optional)"
                  value={genPrompt}
                  onChangeText={setGenPrompt}
                  multiline
                  numberOfLines={3}
                  placeholder={`e.g. Generate the top 10 examples for ${shortLabel}`}
                />
                <Button testID="admin-list-detail.generate" label={generate.isPending ? 'Generating…' : 'Generate candidates'} loading={generate.isPending} onPress={handleGenerate} />
              </View>
            ) : (
              <ScrollView testID="admin-list-detail.generate-dialog.review-step" style={{ padding: spacing.lg }}>
                <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
                  Review, edit, and reorder candidates before saving.
                </Typography>
                <View style={{ gap: spacing.sm }}>
                  {genCandidates.map((candidate, index) => (
                    <View testID={`admin-list-detail.generate-dialog.candidate-slot.${index}`} key={index} style={styles.candidateRow}>
                      <View style={styles.reorderCol}>
                        <Pressable testID="admin-list-detail.generate-dialog.candidate.move-up" hitSlop={6} disabled={index === 0} onPress={() => moveCandidate(index, -1)}>
                          <Icon name="ChevronUp" size={16} color={index === 0 ? colors.surfaceMuted : colors.inkMuted} />
                        </Pressable>
                        <Pressable testID="admin-list-detail.generate-dialog.candidate.move-down" hitSlop={6} disabled={index === genCandidates.length - 1} onPress={() => moveCandidate(index, 1)}>
                          <Icon name="ChevronDown" size={16} color={index === genCandidates.length - 1 ? colors.surfaceMuted : colors.inkMuted} />
                        </Pressable>
                      </View>
                      <View style={styles.candidateInputWrapper}>
                        <TextField testID="admin-list-detail.candidate" value={candidate} onChangeText={(v) => updateCandidate(index, v)} />
                      </View>
                      <Pressable testID="admin-list-detail.generate-dialog.candidate.remove" hitSlop={8} onPress={() => removeCandidate(index)}>
                        <Icon name="X" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable testID="admin-list-detail.gen-candidates" style={styles.addRow} onPress={() => setGenCandidates((c) => [...(c ?? []), 'New item'])}>
                  <Typography variant="label">+ Add custom item</Typography>
                </Pressable>

                <View style={styles.modalFooter}>
                  <Button testID="admin-list-detail.discard-start-over" label="Discard & start over" variant="secondary" onPress={() => setGenCandidates(null)} />
                  <Button testID="admin-list-detail.approve-candidates"
                    label={bulkSave.isPending ? 'Saving…' : `Approve & add ${genCandidates.length}`}
                    loading={bulkSave.isPending}
                    disabled={genCandidates.length === 0}
                    onPress={handleApproveCandidates}
                  />
                </View>
              </ScrollView>
            )}
          </View>
      </AnimatedSheet>
      <ActionSheet testID="admin-list-detail.curated-dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: { marginBottom: spacing.md },
  scopeBox: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scopeTitle: { marginBottom: spacing.sm },
  scopeHint: { marginTop: -spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  rowField: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  curatedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  aiLink: { color: colors.primary },
  availableList: {
    maxHeight: 240,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.md,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  centeredHint: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  selectedList: { maxHeight: 320, flexGrow: 0, flexShrink: 0, marginBottom: spacing.md },
  valueAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  selectedValuesLabel: { marginBottom: spacing.sm },
  emptyCurated: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  curatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  reorderCol: { minWidth: 44, gap: 2 },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  candidateInputWrapper: { flex: 1 },
  addRow: {
    borderWidth: borderWidth.thin,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  modalFooter: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
})
