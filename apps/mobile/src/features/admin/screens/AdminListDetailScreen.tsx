import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
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
      sheet.show({ title: 'Missing fields', message: 'Group, entity type, slug, prompt, and name are all required.', buttons: [{ text: 'OK' }] })
      return
    }
    if (listId) {
      updateList.mutate(
        { id: listId, ...body },
        {
          onSuccess: () => sheet.show({ title: 'Saved', message: 'List details saved.', buttons: [{ text: 'OK' }] }),
          onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ text: 'OK' }] }),
        },
      )
    } else {
      createList.mutate(body, {
        onSuccess: (created) => {
          navigation.setParams({ listId: created.id })
          sheet.show({ title: 'List created', message: 'Now add curated values below.', buttons: [{ text: 'OK' }] })
        },
        onError: (err) => sheet.show({ title: 'Could not create', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ text: 'OK' }] }),
      })
    }
  }

  if (listId && lists.isLoading) {
    return (
      <ScreenContainer width="wide">
        <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="List" />
        <Skeleton height={300} />
      </ScreenContainer>
    )
  }

  if (listId && (lists.isError || !list)) {
    return (
      <ScreenContainer width="wide">
        <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="List" />
        <ErrorState subtitle="Couldn't load this list." onRetry={() => lists.refetch()} />
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
    <ScreenContainer width="wide" padded={false}>
      <TopNavigation
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={listId ? 'Edit List' : 'New List'}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Typography variant="heading" style={styles.cardTitle}>List configuration</Typography>

          <TextField label="List name (short label)" value={form.shortLabel} onChangeText={(v) => setForm((f) => ({ ...f, shortLabel: v }))} />
          <TextField label="Slug" value={form.slug} onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))} autoCapitalize="none" />
          <TextField label="Prompt (question)" value={form.prompt} onChangeText={(v) => setForm((f) => ({ ...f, prompt: v }))} />

          <View style={styles.scopeBox}>
            <Typography variant="label" style={styles.scopeTitle}>Taxonomy scope</Typography>
            <SelectField label="Group" value={form.groupId} options={groupOptions} onSelect={(v) => setForm((f) => ({ ...f, groupId: v }))} placeholder="Select a group…" />
            <SelectField label="Entity type (required)" value={form.entityTypeId} options={typeOptions} onSelect={handleEntityTypeChange} placeholder="Select a type…" />
            {parentTypeId ? (
              <>
                <SelectField
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
            <TextField label="Min items" value={form.minItems} onChangeText={(v) => setForm((f) => ({ ...f, minItems: v }))} keyboardType="number-pad" style={styles.rowField} />
            <TextField label="Max items" value={form.maxItems} onChangeText={(v) => setForm((f) => ({ ...f, maxItems: v }))} keyboardType="number-pad" style={styles.rowField} />
          </View>
          <SelectField label="Ordering" value={form.orderingMode} options={ORDERING_OPTIONS} onSelect={(v) => setForm((f) => ({ ...f, orderingMode: v as 'RANKED' | 'UNRANKED' }))} />

          <View style={styles.toggleRow}>
            <Typography variant="body">Active (visible in app)</Typography>
            <Button label={form.isActive ? 'Active' : 'Archived'} variant="secondary" onPress={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} />
          </View>
          <View style={styles.toggleRow}>
            <Typography variant="body">Premium only</Typography>
            <Button label={form.isPremiumOnly ? 'Yes' : 'No'} variant="secondary" onPress={() => setForm((f) => ({ ...f, isPremiumOnly: !f.isPremiumOnly }))} />
          </View>

          <Button label="Save configuration" loading={createList.isPending || updateList.isPending} onPress={handleSaveConfig} />

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
          <CuratedValuesEditor listId={listId} entityTypeId={form.entityTypeId} parentEntityId={form.parentEntityId} shortLabel={form.shortLabel} />
        ) : null}
      </ScrollView>

      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
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

  const [curatedList, setCuratedList] = useState<CuratedItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const hydrated = useRef(false)
  const hydratedForListId = useRef<string | null>(null)

  useEffect(() => {
    // Re-hydrate when switching to a different list's curated editor
    // (e.g. right after create) — but never clobber in-progress local edits.
    if (hydratedForListId.current !== listId) {
      hydrated.current = false
      hydratedForListId.current = listId
    }
    if (hydrated.current || !curated.data) return
    setCuratedList(
      curated.data
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({ entityId: c.entityId, name: c.entity.canonicalName, imageUrl: c.entity.imageUrl })),
    )
    hydrated.current = true
  }, [curated.data, listId])

  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [genCandidates, setGenCandidates] = useState<string[] | null>(null)
  const generate = useAdminGenerateEntities()
  const bulkSave = useAdminBulkSaveEntities()

  const filteredAvailable = (available.data ?? []).filter(
    (e) => e.canonicalName.toLowerCase().includes(searchQuery.toLowerCase()) && !curatedList.some((c) => c.entityId === e.id),
  )

  function addEntity(entity: { id: string; canonicalName: string; imageUrl?: string | null }) {
    if (curatedList.some((c) => c.entityId === entity.id)) return
    setCuratedList((prev) => [...prev, { entityId: entity.id, name: entity.canonicalName, imageUrl: entity.imageUrl }])
  }

  function removeEntity(entityId: string) {
    setCuratedList((prev) => prev.filter((c) => c.entityId !== entityId))
  }

  function moveEntity(index: number, delta: number) {
    setCuratedList((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleSaveCurated() {
    saveCurated.mutate(
      { id: listId, entities: curatedList.map((c, i) => ({ entityId: c.entityId, sortOrder: i })) },
      {
        onSuccess: () => sheet.show({ title: 'Saved', message: 'Curated values saved.', buttons: [{ text: 'OK' }] }),
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ text: 'OK' }] }),
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
        onError: (err) => sheet.show({ title: 'Could not generate', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ text: 'OK' }] }),
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
          setCuratedList((prev) => [
            ...prev,
            ...result.entities
              .filter((e) => !prev.some((c) => c.entityId === e.id))
              .map((e) => ({ entityId: e.id, name: e.canonicalName, imageUrl: e.imageUrl })),
          ])
          closeGenerateModal()
        },
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ text: 'OK' }] }),
      },
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.curatedHeader}>
        <View style={{ flex: 1 }}>
          <Typography variant="heading">Curated values</Typography>
          <Typography variant="bodyMuted">Explicitly pick and order the entities available in this list.</Typography>
        </View>
        <Pressable hitSlop={8} onPress={() => setShowGenerateModal(true)}>
          <Typography variant="button" style={styles.aiLink}>AI suggest…</Typography>
        </Pressable>
      </View>

      <TextField placeholder="Search available values…" value={searchQuery} onChangeText={setSearchQuery} />

      <View style={styles.availableList}>
        {available.isLoading ? (
          <Skeleton height={80} />
        ) : filteredAvailable.length === 0 ? (
          <Typography variant="bodyMuted" style={styles.centeredHint}>No available entities match.</Typography>
        ) : (
          filteredAvailable.map((entity) => (
            <View key={entity.id} style={styles.availableRow}>
              <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>{entity.canonicalName}</Typography>
              <Pressable hitSlop={8} onPress={() => addEntity(entity)}>
                <Icon name="Plus" size={18} color={colors.primary} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Typography variant="label" style={styles.curatedListLabel}>Selected values ({curatedList.length})</Typography>
      {curatedList.length === 0 ? (
        <View style={styles.emptyCurated}>
          <Typography variant="bodyMuted">No curated values. Add from above.</Typography>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {curatedList.map((item, index) => (
            <View key={item.entityId} style={styles.curatedRow}>
              <View style={styles.reorderCol}>
                <Pressable hitSlop={6} disabled={index === 0} onPress={() => moveEntity(index, -1)}>
                  <Icon name="ChevronUp" size={16} color={index === 0 ? colors.surfaceMuted : colors.inkMuted} />
                </Pressable>
                <Pressable hitSlop={6} disabled={index === curatedList.length - 1} onPress={() => moveEntity(index, 1)}>
                  <Icon name="ChevronDown" size={16} color={index === curatedList.length - 1 ? colors.surfaceMuted : colors.inkMuted} />
                </Pressable>
              </View>
              <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>{item.name}</Typography>
              <Pressable hitSlop={8} onPress={() => removeEntity(item.entityId)}>
                <Icon name="X" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Button label="Save curated values" loading={saveCurated.isPending} onPress={handleSaveCurated} />

      <Modal visible={showGenerateModal} animationType="slide" transparent onRequestClose={closeGenerateModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="heading">Curate AI values for {shortLabel}</Typography>
              <Pressable hitSlop={8} onPress={closeGenerateModal}>
                <Icon name="X" size={22} />
              </Pressable>
            </View>

            {genCandidates === null ? (
              <View style={{ padding: spacing.lg }}>
                <TextField
                  label="Prompt instructions (optional)"
                  value={genPrompt}
                  onChangeText={setGenPrompt}
                  multiline
                  numberOfLines={3}
                  placeholder={`e.g. Generate the top 10 examples for ${shortLabel}`}
                />
                <Button label={generate.isPending ? 'Generating…' : 'Generate candidates'} loading={generate.isPending} onPress={handleGenerate} />
              </View>
            ) : (
              <ScrollView style={{ padding: spacing.lg }}>
                <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
                  Review, edit, and reorder candidates before saving.
                </Typography>
                <View style={{ gap: spacing.sm }}>
                  {genCandidates.map((candidate, index) => (
                    <View key={index} style={styles.candidateRow}>
                      <View style={styles.reorderCol}>
                        <Pressable hitSlop={6} disabled={index === 0} onPress={() => moveCandidate(index, -1)}>
                          <Icon name="ChevronUp" size={16} color={index === 0 ? colors.surfaceMuted : colors.inkMuted} />
                        </Pressable>
                        <Pressable hitSlop={6} disabled={index === genCandidates.length - 1} onPress={() => moveCandidate(index, 1)}>
                          <Icon name="ChevronDown" size={16} color={index === genCandidates.length - 1 ? colors.surfaceMuted : colors.inkMuted} />
                        </Pressable>
                      </View>
                      <View style={styles.candidateInputWrapper}>
                        <TextField value={candidate} onChangeText={(v) => updateCandidate(index, v)} />
                      </View>
                      <Pressable hitSlop={8} onPress={() => removeCandidate(index)}>
                        <Icon name="X" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.addRow} onPress={() => setGenCandidates((c) => [...(c ?? []), 'New item'])}>
                  <Typography variant="label">+ Add custom item</Typography>
                </Pressable>

                <View style={styles.modalFooter}>
                  <Button label="Discard & start over" variant="secondary" onPress={() => setGenCandidates(null)} />
                  <Button
                    label={bulkSave.isPending ? 'Saving…' : `Approve & add ${genCandidates.length}`}
                    loading={bulkSave.isPending}
                    disabled={genCandidates.length === 0}
                    onPress={handleApproveCandidates}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
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
  curatedListLabel: { marginBottom: spacing.sm },
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
  reorderCol: { width: 20, gap: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
