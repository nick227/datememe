import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useAdminCreateSitePickGroup,
  useAdminListDefinitions,
  useAdminSitePickGroups,
  useAdminUpdateSitePickGroup,
  useAdminUpdateSitePickGroupItems,
} from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSitePickGroupDetail'>

// A group is meant to hold exactly 4 curated List Definitions (see
// docs/shared-content-system-proposal.md and ContentFeedService.getListsFeed)
// — enforced here in the picker, not the server, which just stores whatever
// full set it's given (same posture as CuratedValuesEditor's entity cap-less
// design, except this one really does cap).
const GROUP_SIZE = 4

type FormState = {
  slug: string
  label: string
  sortOrder: string
  isActive: boolean
}

const BLANK_FORM: FormState = {
  slug: 'new-site-picks-group',
  label: 'New group',
  sortOrder: '0',
  isActive: true,
}

export function AdminSitePickGroupDetailScreen({ route, navigation }: Props) {
  const groupId = route.params?.groupId

  const groups = useAdminSitePickGroups()
  const group = groupId ? groups.data?.find((g) => g.id === groupId) : undefined

  const createGroup = useAdminCreateSitePickGroup()
  const updateGroup = useAdminUpdateSitePickGroup()
  const sheet = useActionSheet()

  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!groupId) {
      hydrated.current = true
      return
    }
    if (hydrated.current || !group) return
    setForm({
      slug: group.slug,
      label: group.label,
      sortOrder: String(group.sortOrder),
      isActive: group.isActive,
    })
    hydrated.current = true
  }, [group, groupId])

  function handleSaveConfig() {
    const body = {
      slug: form.slug.trim(),
      label: form.label.trim(),
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      isActive: form.isActive,
    }
    if (!body.slug || !body.label) {
      sheet.show({ title: 'Missing fields', message: 'Slug and label are both required.', buttons: [{ testID: 'admin-site-pick-group-detail.dialog.ok', text: 'OK' }] })
      return
    }
    if (groupId) {
      updateGroup.mutate(
        { id: groupId, ...body },
        {
          onSuccess: () => sheet.show({ title: 'Saved', message: 'Group details saved.', buttons: [{ testID: 'admin-site-pick-group-detail.dialog.ok', text: 'OK' }] }),
          onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-site-pick-group-detail.dialog.ok', text: 'OK' }] }),
        },
      )
    } else {
      createGroup.mutate(body, {
        onSuccess: (created) => {
          navigation.setParams({ groupId: created.id })
          sheet.show({ title: 'Group created', message: 'Now pick 4 lists below.', buttons: [{ testID: 'admin-site-pick-group-detail.dialog.ok', text: 'OK' }] })
        },
        onError: (err) => sheet.show({ title: 'Could not create', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-site-pick-group-detail.dialog.ok', text: 'OK' }] }),
      })
    }
  }

  if (groupId && groups.isLoading) {
    return (
      <ScreenContainer testID="screen.admin-site-pick-group-detail" width="wide">
        <TopNavigation testID="admin-site-pick-group-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Site Picks group" />
        <Skeleton height={300} />
      </ScreenContainer>
    )
  }

  if (groupId && (groups.isError || !group)) {
    return (
      <ScreenContainer testID="screen.admin-site-pick-group-detail" width="wide">
        <TopNavigation testID="admin-site-pick-group-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Site Picks group" />
        <ErrorState testID="admin-site-pick-group-detail.error" subtitle="Couldn't load this group." onRetry={() => groups.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.admin-site-pick-group-detail" width="wide">
      <TopNavigation testID="admin-site-pick-group-detail.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={groupId ? 'Edit group' : 'New group'}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Typography variant="heading" style={styles.cardTitle}>Group configuration</Typography>

          <TextField testID="admin-site-pick-group-detail.label" label="Group label (shown as the grid's title)" value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} />
          <TextField testID="admin-site-pick-group-detail.slug" label="Slug" value={form.slug} onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))} autoCapitalize="none" />
          <TextField testID="admin-site-pick-group-detail.sort-order" label="Sort order" value={form.sortOrder} onChangeText={(v) => setForm((f) => ({ ...f, sortOrder: v }))} keyboardType="number-pad" />

          <View style={styles.toggleRow}>
            <Typography variant="body">Active (shown on the Lists feed)</Typography>
            <Button testID="admin-site-pick-group-detail.active" label={form.isActive ? 'Active' : 'Archived'} variant="secondary" onPress={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} />
          </View>

          <Button testID="admin-site-pick-group-detail.save-config" label="Save configuration" loading={createGroup.isPending || updateGroup.isPending} onPress={handleSaveConfig} />
        </View>

        {groupId && group ? <CuratedListsEditor key={groupId} groupId={groupId} initialItems={group.items} /> : null}
      </ScrollView>

      <ActionSheet testID="admin-site-pick-group-detail.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

type CuratedItem = { categoryId: string; shortLabel: string }

function CuratedListsEditor({
  groupId,
  initialItems,
}: {
  groupId: string
  initialItems: { categoryId: string; sortOrder: number; category: { shortLabel: string } }[]
}) {
  const allLists = useAdminListDefinitions()
  const saveItems = useAdminUpdateSitePickGroupItems()
  const sheet = useActionSheet()

  const [selectedDraft, setSelectedDraft] = useState<CuratedItem[] | null>(null)
  const selectedValues = selectedDraft ?? initialItems
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({ categoryId: i.categoryId, shortLabel: i.category.shortLabel }))
  const [searchQuery, setSearchQuery] = useState('')
  const editingDisabled = saveItems.isPending

  function setSelectedValues(update: (previous: CuratedItem[]) => CuratedItem[]) {
    setSelectedDraft((previous) => update(previous ?? selectedValues))
  }

  const filteredAvailable = (allLists.data ?? []).filter(
    (c) => c.shortLabel.toLowerCase().includes(searchQuery.trim().toLowerCase()) && !selectedValues.some((s) => s.categoryId === c.id),
  )

  function addCategory(category: { id: string; shortLabel: string }) {
    if (editingDisabled || selectedValues.length >= GROUP_SIZE) return
    setSelectedValues((prev) => prev.some((c) => c.categoryId === category.id)
      ? prev
      : [...prev, { categoryId: category.id, shortLabel: category.shortLabel }])
  }

  function removeCategory(categoryId: string) {
    setSelectedValues((prev) => prev.filter((c) => c.categoryId !== categoryId))
  }

  function moveCategory(index: number, delta: number) {
    setSelectedValues((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleSave() {
    if (editingDisabled) return
    saveItems.mutate(
      { id: groupId, items: selectedValues.map((c, i) => ({ categoryId: c.categoryId, sortOrder: i })) },
      {
        onSuccess: () => sheet.show({ title: 'Saved', message: 'Curated lists saved.', buttons: [{ testID: 'admin-site-pick-group-detail.curated-dialog.ok', text: 'OK' }] }),
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-site-pick-group-detail.curated-dialog.ok', text: 'OK' }] }),
      },
    )
  }

  return (
    <View style={styles.card}>
      <Typography variant="heading">Curated lists</Typography>
      <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>
        Pick exactly {GROUP_SIZE} List Definitions ({selectedValues.length} of {GROUP_SIZE} selected). These reuse the real lists elsewhere in the app — nothing is duplicated.
      </Typography>

      <TextField testID="admin-site-pick-group-detail.search-query" placeholder="Search list definitions…" value={searchQuery} onChangeText={setSearchQuery} />

      <Typography variant="label" style={styles.selectedValuesLabel}>Available lists</Typography>
      <ScrollView testID="admin-site-pick-group-detail.available-values" style={styles.availableList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {allLists.isLoading ? (
          <Skeleton height={80} />
        ) : allLists.isError ? (
          <ErrorState testID="admin-site-pick-group-detail.available-error" subtitle="Couldn't load list definitions." onRetry={() => allLists.refetch()} />
        ) : filteredAvailable.length === 0 ? (
          <Typography variant="bodyMuted" style={styles.centeredHint}>{searchQuery.trim() ? 'No lists match your search.' : 'All lists are selected.'}</Typography>
        ) : (
          filteredAvailable.map((category) => (
            <View testID={`admin-site-pick-group-detail.category.${category.id}`} key={category.id} style={styles.availableRow}>
              <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>{category.shortLabel}</Typography>
              <Pressable
                testID={`admin-site-pick-group-detail.category.${category.id}.add`}
                accessibilityRole="button"
                accessibilityLabel={`Add ${category.shortLabel}`}
                style={styles.valueAction}
                disabled={editingDisabled || selectedValues.length >= GROUP_SIZE}
                onPress={() => addCategory(category)}
              >
                <Icon name="Plus" size={18} color={selectedValues.length >= GROUP_SIZE ? colors.surfaceMuted : colors.primary} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <Typography variant="label" style={styles.selectedValuesLabel}>Selected lists ({selectedValues.length} of {GROUP_SIZE})</Typography>
      {selectedValues.length === 0 ? (
        <View style={styles.emptyCurated}>
          <Typography variant="bodyMuted">No lists selected yet. Use + beside an available list to add it.</Typography>
        </View>
      ) : (
        <ScrollView testID="admin-site-pick-group-detail.selected-values" style={styles.selectedList} contentContainerStyle={{ gap: spacing.xs }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {selectedValues.map((item, index) => (
            <View testID={`admin-site-pick-group-detail.selected.${item.categoryId}`} key={item.categoryId} style={styles.curatedRow}>
              <View style={styles.reorderCol}>
                <Pressable testID={`admin-site-pick-group-detail.selected.${item.categoryId}.move-up`} accessibilityRole="button" accessibilityLabel={`Move ${item.shortLabel} up`} style={styles.valueAction} disabled={editingDisabled || index === 0} onPress={() => moveCategory(index, -1)}>
                  <Icon name="ChevronUp" size={16} color={index === 0 ? colors.surfaceMuted : colors.inkMuted} />
                </Pressable>
                <Pressable testID={`admin-site-pick-group-detail.selected.${item.categoryId}.move-down`} accessibilityRole="button" accessibilityLabel={`Move ${item.shortLabel} down`} style={styles.valueAction} disabled={editingDisabled || index === selectedValues.length - 1} onPress={() => moveCategory(index, 1)}>
                  <Icon name="ChevronDown" size={16} color={index === selectedValues.length - 1 ? colors.surfaceMuted : colors.inkMuted} />
                </Pressable>
              </View>
              <Typography variant="body" style={{ flex: 1 }} numberOfLines={1}>{item.shortLabel}</Typography>
              <Pressable testID={`admin-site-pick-group-detail.selected.${item.categoryId}.remove`} accessibilityRole="button" accessibilityLabel={`Remove ${item.shortLabel}`} style={styles.valueAction} disabled={editingDisabled} onPress={() => removeCategory(item.categoryId)}>
                <Icon name="X" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <Button testID="admin-site-pick-group-detail.save-curated" label="Save curated lists" loading={saveItems.isPending} onPress={handleSave} />

      <ActionSheet testID="admin-site-pick-group-detail.curated-dialog" config={sheet.config} onDismiss={sheet.dismiss} />
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
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
})
