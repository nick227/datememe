import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useAdminCreateList,
  useAdminEntityTypes,
  useAdminList,
  useAdminSetListValues,
  useAdminUpdateList,
  useCategoryGroups,
  type AdminListDetail,
} from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { ListCoverSheet } from '../components/ListCoverSheet'
import { AddListValueSheet } from '../components/AddListValueSheet'
import { borderWidth, colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

// Admin → Lists: one list, one page — Cover, Text, Values, Visibility, and
// Advanced collapsed (docs/admin-lists-roadmap.md §3.2). Without a listId it
// is New list: title, question, group and value type, then the same page.

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminListDetail'>

export function AdminListDetailScreen({ route, navigation }: Props) {
  const listId = route.params?.listId
  const list = useAdminList(listId)

  if (!listId) return <NewList navigation={navigation} />
  if (list.isLoading) {
    return (
      <ScreenContainer testID="screen.admin-list-detail" width="standard">
        <TopNavigation testID="admin-list-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="List" />
        <Skeleton height={300} />
      </ScreenContainer>
    )
  }
  if (list.isError || !list.data) {
    return (
      <ScreenContainer testID="screen.admin-list-detail" width="standard">
        <TopNavigation testID="admin-list-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="List" />
        <ErrorState testID="admin-list-detail.error" subtitle="Couldn't load this list." onRetry={() => list.refetch()} />
      </ScreenContainer>
    )
  }
  // Keyed so the form re-seeds when another list opens, never on background refetches.
  return <EditList key={list.data.id} list={list.data} onBack={() => navigation.goBack()} />
}

type Form = {
  title: string; prompt: string; groupId: string; isActive: boolean
  slug: string; orderingMode: 'RANKED' | 'UNRANKED'; minItems: string; maxItems: string; isMatchSignal: boolean
}
const formOf = (l: AdminListDetail): Form => ({
  title: l.title, prompt: l.prompt, groupId: l.group.id, isActive: l.isActive,
  slug: l.slug, orderingMode: l.orderingMode, minItems: String(l.minItems), maxItems: String(l.maxItems), isMatchSignal: l.isMatchSignal,
})

function EditList({ list, onBack }: { list: AdminListDetail; onBack: () => void }) {
  const groups = useCategoryGroups()
  const update = useAdminUpdateList()
  const setValues = useAdminSetListValues()
  const [saved, setSaved] = useState(() => formOf(list))
  const [form, setForm] = useState(saved)
  const [advanced, setAdvanced] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  function save() {
    update.mutate(
      {
        id: list.id, title: form.title, prompt: form.prompt, groupId: form.groupId, isActive: form.isActive,
        slug: form.slug, orderingMode: form.orderingMode, minItems: Number(form.minItems), maxItems: Number(form.maxItems), isMatchSignal: form.isMatchSignal,
      },
      {
        onSuccess: (l) => { const next = formOf(l); setSaved(next); setForm(next); setMessage({ text: 'Saved.' }) },
        onError: (e) => setMessage({ text: e instanceof ApiError ? e.message : 'Could not save.', error: true }),
      },
    )
  }
  const values = list.values
  const move = (from: number, to: number) => {
    // Moving is only enabled for curated lists, so all are included.
    const ids = values.map((v) => v.entityId)
    const [id] = ids.splice(from, 1)
    ids.splice(to, 0, id!)
    setValues.mutate({ id: list.id, entityIds: ids })
  }
  const remove = (index: number) => {
    const target = values[index]
    const isExcluded = (target as any).status === 'excluded'
    const currentlyIncluded = values.filter(v => (v as any).status !== 'excluded').map(v => v.entityId)
    const newIds = isExcluded ? [...currentlyIncluded, target.entityId] : currentlyIncluded.filter(id => id !== target.entityId)
    setValues.mutate({ id: list.id, entityIds: newIds })
  }

  const status = list.isActive ? 'Live ●' : list.neverPublished ? 'Hidden · Never published' : 'Hidden'
  const cover = list.cover
  const suggesting = list.coverSuggest?.status === 'running'

  return (
    <ScreenContainer testID="screen.admin-list-detail" width="standard">
      <TopNavigation testID="admin-list-detail.header" alignment="left" leftAction="back" onLeftAction={onBack} title={list.title} subtitle={status}
        rightElement={
          <Pressable testID="admin-list-detail.save" hitSlop={12} disabled={!dirty || update.isPending} onPress={save}>
            <Typography variant="button" style={{ color: dirty ? colors.ink : colors.inkMuted }}>{update.isPending ? 'Saving…' : 'Save'}</Typography>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {message ? <Typography variant="body" style={{ color: message.error ? colors.danger : colors.ink }}>{message.text}</Typography> : null}
        {list.issues.length ? (
          <View testID="admin-list-detail.issues" style={styles.issues}>
            {list.issues.map((i) => <Typography key={i.code + i.detail} variant="body" style={{ color: colors.danger }}>⚠ {i.detail}</Typography>)}
          </View>
        ) : null}

        <Section title="Cover">
          <View style={styles.coverRow}>
            <View style={styles.cover}>
              {cover.imageCardUrl ? <Image source={{ uri: cover.imageCardUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Typography variant="body" numberOfLines={2}>
                {cover.imageCardUrl ? cover.title ?? 'Uploaded image' : cover.status === 'none' ? 'No cover (placeholder)' : suggesting ? 'Finding a cover…' : 'No cover yet'}
              </Typography>
              {cover.credit ? (
                <Typography variant="bodyMuted" numberOfLines={2}>{[cover.credit.license?.toUpperCase(), cover.credit.creator].filter(Boolean).join(' · ')}</Typography>
              ) : null}
              {list.problems.includes('cover-failed') ? <Typography variant="bodyMuted" style={{ color: colors.danger }}>Automatic cover failed — choose one.</Typography> : null}
              <View style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}>
                <Button testID="admin-list-detail.change-cover" label="Change" variant="secondary" onPress={() => setCoverOpen(true)} />
              </View>
            </View>
          </View>
        </Section>

        <Section title="Text">
          <TextField testID="admin-list-detail.title" label="Title" value={form.title} onChangeText={(v) => set('title', v)} />
          <TextField testID="admin-list-detail.prompt" label="Question" value={form.prompt} onChangeText={(v) => set('prompt', v)} multiline />
          <SelectField testID="admin-list-detail.group" label="Group" value={form.groupId} options={(groups.data ?? []).map((g) => ({ label: g.label, value: g.id }))} onSelect={(v) => set('groupId', v)} />
        </Section>

        <Section title={`Values (${list.valueCount})`}
          action={<Pressable testID="admin-list-detail.add-value" hitSlop={8} onPress={() => setAddOpen(true)}><Typography variant="label" style={{ color: colors.ink }}>+ Add</Typography></Pressable>}>
          {!list.curated ? (
            <Typography variant="bodyMuted" style={{ marginBottom: spacing.md }}>{`This list is populated automatically from ${list.entityType.label} filters. Changes here override the automatic pool.`}</Typography>
          ) : null}
          {values.length === 0 ? (
            <Typography variant="bodyMuted">No values yet. Add at least {list.maxItems}.</Typography>
          ) : values.map((v, i) => (
            <View key={v.entityId} style={styles.valueRow}>
              <Typography variant="body" style={{ flex: 1, textDecorationLine: (v as any).status === 'excluded' ? 'line-through' : 'none', color: (v as any).status === 'excluded' ? colors.inkMuted : colors.ink }} numberOfLines={1}>
                {v.name}
                {v.isNew ? <Typography variant="label"> · new</Typography> : null}
                {(v as any).status === 'automatic' ? <Typography variant="label" style={{ color: colors.inkMuted }}> · automatic</Typography> : null}
                {(v as any).status === 'added' ? <Typography variant="label" style={{ color: colors.success }}> · added manually</Typography> : null}
                {(v as any).status === 'excluded' ? <Typography variant="label" style={{ color: colors.danger }}> · excluded</Typography> : null}
              </Typography>
              <Pressable testID={`admin-list-detail.value.${i}.up`} hitSlop={6} disabled={i === 0 || setValues.isPending || !list.curated} onPress={() => move(i, i - 1)}><Typography variant="body" style={[styles.icon, (i === 0 || !list.curated) && styles.iconOff]}>↑</Typography></Pressable>
              <Pressable testID={`admin-list-detail.value.${i}.down`} hitSlop={6} disabled={i === values.length - 1 || setValues.isPending || !list.curated} onPress={() => move(i, i + 1)}><Typography variant="body" style={[styles.icon, (i === values.length - 1 || !list.curated) && styles.iconOff]}>↓</Typography></Pressable>
              <Pressable testID={`admin-list-detail.value.${i}.remove`} hitSlop={6} disabled={setValues.isPending} onPress={() => remove(i)}>
                <Typography variant="body" style={styles.icon}>{(v as any).status === 'excluded' ? '+' : '×'}</Typography>
              </Pressable>
            </View>
          ))}
          {values.filter(v => (v as any).status !== 'excluded').length < list.maxItems ? (
            <Typography variant="bodyMuted" style={{ color: colors.danger }}>Needs at least {list.maxItems} values to go live.</Typography>
          ) : null}
        </Section>

        <Section title="Visibility">
          <View style={styles.toggleRow}>
            <Typography variant="body">Live on app</Typography>
            <Switch testID="admin-list-detail.live" value={form.isActive} onValueChange={(v) => set('isActive', v)} trackColor={{ true: colors.ink, false: colors.border }} />
          </View>
          {form.isActive !== saved.isActive ? <Typography variant="bodyMuted">Press Save to {form.isActive ? 'publish' : 'hide'} this list.</Typography> : null}
        </Section>

        <Pressable testID="admin-list-detail.advanced" onPress={() => setAdvanced((a) => !a)}>
          <Typography variant="label" style={{ color: colors.ink }}>{advanced ? '▾' : '▸'} Advanced</Typography>
        </Pressable>
        {advanced ? (
          <View style={styles.section}>
            <TextField testID="admin-list-detail.slug" label="Slug" value={form.slug} onChangeText={(v) => set('slug', v)} autoCapitalize="none" autoCorrect={false} />
            <SelectField testID="admin-list-detail.ordering" label="Ordering" value={form.orderingMode} options={[{ label: 'Ranked', value: 'RANKED' }, { label: 'Unranked', value: 'UNRANKED' }]} onSelect={(v) => set('orderingMode', v as Form['orderingMode'])} />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}><TextField testID="admin-list-detail.min" label="Min picks" value={form.minItems} onChangeText={(v) => set('minItems', v)} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><TextField testID="admin-list-detail.max" label="Max picks" value={form.maxItems} onChangeText={(v) => set('maxItems', v)} keyboardType="number-pad" /></View>
            </View>
            <View style={styles.toggleRow}>
              <Typography variant="body">Counts toward matching</Typography>
              <Switch testID="admin-list-detail.match-signal" value={form.isMatchSignal} onValueChange={(v) => set('isMatchSignal', v)} trackColor={{ true: colors.ink, false: colors.border }} />
            </View>
            <Typography variant="bodyMuted">Value type: {list.entityType.label}{list.parentEntity ? ` (within ${list.parentEntity.name})` : ''} · {list.takes} takes</Typography>
          </View>
        ) : null}

        {dirty ? <Button testID="admin-list-detail.save-bottom" label="Save" loading={update.isPending} onPress={save} /> : null}
      </ScrollView>

      <ListCoverSheet list={list} visible={coverOpen} onClose={() => setCoverOpen(false)} />
      {list.curated ? <AddListValueSheet list={list} visible={addOpen} onClose={() => setAddOpen(false)} /> : null}
    </ScreenContainer>
  )
}

function NewList({ navigation }: { navigation: Props['navigation'] }) {
  const groups = useCategoryGroups()
  const types = useAdminEntityTypes()
  const create = useAdminCreateList()
  const [form, setForm] = useState({ title: '', prompt: '', groupId: '', entityTypeId: '' })
  const [error, setError] = useState<string | null>(null)
  const ready = form.title.trim() && form.prompt.trim() && form.groupId && form.entityTypeId

  return (
    <ScreenContainer testID="screen.admin-list-new" width="standard">
      <TopNavigation testID="admin-list-new.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="New list" subtitle="Starts hidden" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField testID="admin-list-new.title" label="Title" value={form.title} onChangeText={(title) => setForm((f) => ({ ...f, title }))} placeholder="Favorite Road Trip Snacks" />
        <TextField testID="admin-list-new.prompt" label="Question" value={form.prompt} onChangeText={(prompt) => setForm((f) => ({ ...f, prompt }))} placeholder="What do you pack for a road trip?" multiline />
        <SelectField testID="admin-list-new.group" label="Group" value={form.groupId} placeholder="Choose a group" options={(groups.data ?? []).map((g) => ({ label: g.label, value: g.id }))} onSelect={(groupId) => setForm((f) => ({ ...f, groupId }))} />
        <SelectField testID="admin-list-new.type" label="Value type" value={form.entityTypeId} placeholder="Choose what the values are"
          options={(types.data ?? []).filter((t: any) => t.isActive !== false).map((t: any) => ({ label: t.label, value: t.id }))} onSelect={(entityTypeId) => setForm((f) => ({ ...f, entityTypeId }))} />
        <Typography variant="bodyMuted">Next: add values. A cover is found automatically once the list has enough of them.</Typography>
        {error ? <Typography variant="body" style={{ color: colors.danger }}>{error}</Typography> : null}
        <Button testID="admin-list-new.create" label="Create list" disabled={!ready} loading={create.isPending}
          onPress={() => create.mutate(form, {
            onSuccess: (l) => navigation.replace('AdminListDetail', { listId: l.id }),
            onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not create the list.'),
          })} />
      </ScrollView>
    </ScreenContainer>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Typography variant="label">{title}</Typography>
        {action}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: borderWidth.thick, borderBottomColor: colors.ink, paddingBottom: spacing.xs, marginBottom: spacing.xs },
  coverRow: { flexDirection: 'row', gap: spacing.lg },
  cover: { width: 120, height: 160, backgroundColor: colors.surfaceMuted, borderWidth: borderWidth.thin, borderColor: colors.border, overflow: 'hidden' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { fontSize: 18, width: 22, textAlign: 'center' },
  iconOff: { color: colors.border },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  issues: { gap: spacing.xs, borderLeftWidth: borderWidth.thick, borderLeftColor: colors.danger, paddingLeft: spacing.md },
})
