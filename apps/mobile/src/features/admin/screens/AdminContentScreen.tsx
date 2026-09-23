import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { catalogCommand, useAdminCatalog, type CatalogCommand, type CatalogDraft, type CatalogCandidate, type CatalogEntity, type CatalogOperation } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Typography } from '../../../ui/Typography'
import { Button } from '../../../ui/Button'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminContent'>
export function AdminContentScreen({ navigation }: Props) {
  const [tab, setTab] = useState<'concepts' | 'lists' | 'values'>('concepts')
  const [offset, setOffset] = useState(0)
  const [draftId, setDraftId] = useState<string>()
  const [conceptId, setConceptId] = useState<string>()
  const [selected, setSelected] = useState<string[]>([])
  const [brief, setBrief] = useState('Everyday interests, culture, and things people love')
  const [count, setCount] = useState('50')
  const [listsPerConcept, setListsPerConcept] = useState('10')
  const [manual, setManual] = useState('')
  const [batchGroup, setBatchGroup] = useState('')
  const [batchType, setBatchType] = useState('')
  const [candidateIds, setCandidateIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [inspected, setInspected] = useState<CatalogOperation | null>(null)
  const running = useRef(false)
  const stop = useRef(false)
  const queryClient = useQueryClient()
  const state = useAdminCatalog({ offset, conceptId, draftId })
  useEffect(() => () => { stop.current = true }, [])
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })
  const act = async (body: CatalogCommand) => {
    const result = await catalogCommand(body)
    await refresh()
    return result
  }
  const perform = async (work: () => Promise<unknown>) => {
    if (running.current) return
    running.current = true; setBusy(true); setMessage('')
    try { await work() } catch (e) { setMessage(e instanceof Error ? e.message : String(e)) }
    finally { running.current = false; setBusy(false); await refresh() }
  }
  const execute = async (ops: CatalogOperation[]) => {
    stop.current = false
    let completed = 0, failed = 0
    for (const op of ops) {
      if (stop.current) break
      try {
        const result = await catalogCommand<CatalogOperation>({ action: 'execute', id: op.id })
        if (result.status === 'SUCCEEDED') completed++; else failed++
      } catch { failed++ }
      setMessage(`${completed} completed · ${failed} failed · ${ops.length - completed - failed} remaining`)
      await refresh()
    }
    if (stop.current) {
      const remaining = ops.slice(completed + failed).map(o => o.id)
      for (let i = 0; i < remaining.length; i += 100) await catalogCommand({ action: 'cancel', ids: remaining.slice(i, i + 100) })
      setMessage(`Stopped. ${completed} completed; saved proposals are ready to review.`)
    }
  }
  const generate = (kind: 'CONCEPTS' | 'LIST_IDEAS' | 'VALUES', ids?: string[]) => perform(async () => {
    const ops = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind, ids, count: Number(count), ...(brief.trim() ? { brief } : {}) })
    await execute(ops)
  })
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const changeTab = (next: typeof tab) => { setTab(next); setSelected([]); setOffset(0); setCount(next === 'concepts' ? '50' : '20') }
  const selectDraft = (id: string) => { setCandidateIds([]); setDraftId(id); changeTab('values') }
  const batchDraft = (approvalState: 'APPROVED' | 'REJECTED') => perform(async () => {
    for (const d of state.data!.drafts.filter(d => selected.includes(d.id) && !d.publishedCategoryId)) await act({ ...draftFields(d), approvalState })
    setMessage('Selected definitions updated. Assign taxonomy before generating values.')
  })
  const selectedRows = tab === 'concepts' ? state.data?.concepts ?? [] : state.data?.drafts ?? []
  const total = tab === 'concepts' ? state.data?.conceptCount ?? 0 : state.data?.draftCount ?? 0
  return <ScreenContainer testID="screen.admin-content" width="wide">
    <TopNavigation testID="admin-content.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Content factory" subtitle="Concepts → Lists → Values · Local catalog" />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>{(['concepts', 'lists', 'values'] as const).map(t => <Button key={t} label={t === 'concepts' ? 'Concept Inbox' : t === 'lists' ? 'List review' : 'Value review'} variant={tab === t ? 'primary' : 'secondary'} onPress={() => changeTab(t)} />)}</View>
      <Typography variant="bodyMuted">Generate in batches, then review each stage. Closing this screen pauses dispatch; resume pending operations below.</Typography>
      {!!message && <Typography testID="admin-content.message" variant="body">{message}</Typography>}
      {state.isLoading && <Typography variant="body">Loading workspace…</Typography>}
      {state.isError && <><Typography variant="body">{state.error.message}</Typography><Button label="Retry loading" onPress={() => { void state.refetch() }} /></>}
      {state.data && <>
        {tab !== 'values' && <View style={styles.card}>
          <TextField testID="admin-content.brief" label="Generation brief" value={brief} onChangeText={setBrief} />
          <TextField testID="admin-content.count" label={tab === 'concepts' ? 'Concept count' : 'Values per List'} value={count} keyboardType="number-pad" onChangeText={setCount} />
          {tab === 'concepts' && <Button testID="admin-content.generate-concepts" label="Generate concepts" loading={busy} onPress={() => { void generate('CONCEPTS') }} />}
        </View>}
        {tab === 'concepts' && <>
          <View style={styles.row}><TextField testID="admin-content.manual-concept" label="Or enter a concept" value={manual} onChangeText={setManual} /><Button label="Add" disabled={busy || !manual.trim()} onPress={() => { void perform(async () => { await act({ action: 'concept', label: manual }); setManual('') }) }} /></View>
          <View style={styles.row}>
            <Button label="Use selected" disabled={busy || !selected.length} onPress={() => { void perform(() => act({ action: 'concept-status', ids: selected, status: 'USE' })) }} />
            <Button label="Skip selected" variant="secondary" disabled={busy || !selected.length} onPress={() => { void perform(() => act({ action: 'concept-status', ids: selected, status: 'SKIP' })) }} />
            <TextField label="Lists per concept" value={listsPerConcept} onChangeText={setListsPerConcept} keyboardType="number-pad" />
            <Button label="Generate Lists" disabled={busy || !state.data.concepts.some(c => selected.includes(c.id) && c.status === 'USE')} onPress={() => { void perform(async () => {
              const ops = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind: 'LIST_IDEAS', ids: state.data!.concepts.filter(c => selected.includes(c.id) && c.status === 'USE').map(c => c.id), count: Number(listsPerConcept), ...(brief.trim() ? { brief } : {}) }); await execute(ops)
            }) }} />
          </View>
          {state.data.concepts.map(c => <Pressable testID={`admin-content.concept.${c.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(c.id) }} key={c.id} style={[styles.card, selected.includes(c.id) && styles.selected]} onPress={() => toggle(c.id)}>
            <Typography variant="heading">{selected.includes(c.id) ? '✓ ' : ''}{c.label}</Typography>
            <Typography variant="bodyMuted">{c.status} · {c._count.drafts} Lists</Typography>
            <Button label="Review Lists" variant="secondary" onPress={() => { setConceptId(c.id); changeTab('lists') }} />
          </Pressable>)}
        </>}
        {tab === 'lists' && <>
          <SelectField label="Source concept" value={conceptId ?? ''} options={[{ label: 'All concepts', value: '' }, ...state.data.concepts.map(c => ({ label: c.label, value: c.id }))]} onSelect={v => { setConceptId(v || undefined); setOffset(0); setSelected([]) }} />
          <View style={styles.row}>
            <Button label="Approve selected" disabled={busy || !selected.length} onPress={() => { void batchDraft('APPROVED') }} />
            <Button label="Reject selected" disabled={busy || !selected.length} variant="secondary" onPress={() => { void batchDraft('REJECTED') }} />
            <Button label="Generate Values for ready Lists" disabled={busy || !selected.length} onPress={() => { void perform(async () => {
              const ops = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind: 'VALUES', ids: state.data!.drafts.filter(d => selected.includes(d.id) && d.approvalState === 'APPROVED' && d.groupId && d.entityTypeId).map(d => d.id), count: Number(count) }); await execute(ops)
            }) }} />
            <Button label="Publish selected ready Lists" disabled={busy || !selected.length} onPress={() => { void perform(async () => {
              let published = 0; const errors: string[] = []
              for (const d of state.data!.drafts.filter(d => selected.includes(d.id))) { try { await act({ action: 'publish', id: d.id }); published++ } catch (e) { errors.push(`${d.title}: ${e instanceof Error ? e.message : String(e)}`) } }
              setMessage(`${published} published. ${errors.join(' · ')}`)
            }) }} />
          </View>
          <View style={styles.card}>
            <Typography variant="label">Assign selected Lists</Typography>
            <SelectField label="Group" value={batchGroup} options={state.data.groups.map(g => ({ label: g.label, value: g.id }))} onSelect={setBatchGroup} />
            <SelectField label="Value type" value={batchType} options={state.data.types.map(t => ({ label: t.label, value: t.id }))} onSelect={setBatchType} />
            <Button label="Assign to selected drafts" disabled={busy || !selected.length || !batchGroup || !batchType} onPress={() => { void perform(async () => {
              for (const d of state.data!.drafts.filter(d => selected.includes(d.id) && !d.publishedCategoryId)) await act({ ...draftFields(d), groupId: batchGroup, entityTypeId: batchType })
              setMessage('Taxonomy assigned. Changing the type resets candidate approvals for review.')
            }) }} />
          </View>
          {state.data.drafts.map(d => <View key={d.id} style={[styles.card, selected.includes(d.id) && styles.selected]}>
            <Button label={`${selected.includes(d.id) ? '✓ Selected' : 'Select'} · ${d.title}`} variant="secondary" onPress={() => toggle(d.id)} />
            <Typography variant="bodyMuted">{d.concept?.label} · {d.approvalState} · {d.publishedCategoryId ? 'Published' : !d.entityTypeId || !d.groupId ? 'Needs taxonomy assignment' : 'Assigned'} · {d._count?.candidates ?? 0} candidates</Typography>
            <Button label="Edit / review values" onPress={() => selectDraft(d.id)} />
          </View>)}
        </>}
        {tab !== 'values' && <View style={styles.row}>
          <Button label="Select page" variant="secondary" onPress={() => setSelected(selectedRows.map(r => r.id))} />
          <Button label="Clear selection" variant="secondary" onPress={() => setSelected([])} />
          <Button label="Previous" disabled={offset === 0} onPress={() => { setOffset(Math.max(0, offset - 100)); setSelected([]) }} />
          <Typography variant="body">{total ? offset + 1 : 0}–{Math.min(offset + 100, total)} of {total}</Typography>
          <Button label="Next" disabled={offset + 100 >= total} onPress={() => { setOffset(offset + 100); setSelected([]) }} />
        </View>}
        {tab === 'values' && (state.data.draft ? <>
          <DraftEditor key={state.data.draft.id + state.data.draft.approvalState + state.data.draft.publishedCategoryId} draft={state.data.draft} groups={state.data.groups} types={state.data.types} disabled={busy} save={b => perform(() => act(b))} />
          <TextField label="New candidate count" value={count} onChangeText={setCount} keyboardType="number-pad" />
          <TextField label="Expansion brief (optional)" value={brief} onChangeText={setBrief} />
          <View style={styles.row}>
            <Button label={state.data.draft.publishedCategoryId ? 'Generate more Values' : 'Generate Values'} disabled={busy} onPress={() => { void generate('VALUES', [draftId!]) }} />
            <Button label={state.data.draft.publishedCategoryId ? 'Add approved Values' : 'Publish approved List locally'} disabled={busy} onPress={() => { void perform(async () => {
              const result = await act({ action: 'publish', id: draftId! }) as { added: number }; setMessage(`Published: ${result.added} net new value relationships.`)
            }) }} />
          </View>
          <View style={styles.row}>
            <Button label="Select candidate page" variant="secondary" onPress={() => setCandidateIds((state.data!.draft!.candidates ?? []).slice(0, 100).map(c => c.id))} />
            <Button label="Approve exact existing matches" disabled={busy || !candidateIds.length} onPress={() => { void perform(async () => {
              const result = await act({ action: 'resolve-existing', ids: candidateIds }) as { approved: number }; setMessage(`${result.approved} exact existing identities approved; review the remaining candidates individually.`)
            }) }} />
            <Button label="Reject selected values" variant="secondary" disabled={busy || !candidateIds.length} onPress={() => { void perform(async () => {
              for (const id of candidateIds) await act({ action: 'candidate', id, reviewState: 'REJECTED' })
            }) }} />
          </View>
          {(state.data.draft.candidates ?? []).map(c => <View key={c.id}>
            <Button label={candidateIds.includes(c.id) ? '✓ Selected' : 'Select value'} variant="secondary" onPress={() => setCandidateIds(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : ids.length < 100 ? [...ids, c.id] : ids)} />
            <CandidateEditor candidate={c} disabled={busy} perform={perform} act={act} />
          </View>)}
        </> : <Typography variant="body">Choose a List from List review to edit its definition and review values.</Typography>)}
        <View style={styles.card}>
          <Typography variant="heading">Generation progress</Typography>
          <View style={styles.row}>
            <Button label="Resume pending" disabled={busy || !state.data.operations.some(o => o.status === 'PENDING')} onPress={() => { void perform(() => execute(state.data!.operations.filter(o => o.status === 'PENDING').reverse())) }} />
            <Button label="Stop after current" variant="secondary" disabled={!busy} onPress={() => { stop.current = true }} />
          </View>
          {state.data.operations.map(op => <View key={op.id} style={styles.card}>
            <Typography variant="body">{op.kind} · {op.status}</Typography>
            {!!op.error && <Typography variant="bodyMuted">{op.error}</Typography>}
            <View style={styles.row}>
              <Button label="Inspect prompts / result" variant="secondary" disabled={busy} onPress={() => { void perform(async () => setInspected(await catalogCommand<CatalogOperation>({ action: 'operation', id: op.id }))) }} />
              <Button label="Cancel" variant="secondary" disabled={busy || !['RUNNING', 'PENDING'].includes(op.status)} onPress={() => { void perform(() => act({ action: 'cancel', ids: [op.id] })) }} />
              <Button label="Retry failed / stale" disabled={busy || !['RUNNING', 'FAILED', 'CANCELED'].includes(op.status)} onPress={() => { void perform(async () => { const ops = await catalogCommand<CatalogOperation[]>({ action: 'retry', id: op.id }); await execute(ops) }) }} />
            </View>
          </View>)}
          {inspected && <><Typography variant="body">{inspected.model} · prompt v{inspected.promptVersion}</Typography><Typography variant="bodyMuted">{inspected.systemPrompt}{'\n'}{inspected.userPrompt}{'\n'}{JSON.stringify(inspected.output, null, 2)}</Typography>{inspected.kind === 'FACETS' && inspected.status === 'SUCCEEDED' && inspected.output?.items.map((f, i) => <Button key={i} label={`Accept ${f.axis}: ${f.value}`} disabled={busy} onPress={() => { void perform(() => act({ action: 'facet-accept', id: inspected.id, indices: [i] })) }} />)}<Button label="Close inspection" variant="secondary" onPress={() => setInspected(null)} /></>}
        </View>
      </>}
    </ScrollView>
  </ScreenContainer>
}

function draftFields(d: CatalogDraft): CatalogCommand {
  return { action: 'draft', id: d.id, title: d.title, slug: d.slug, prompt: d.prompt, entityTypeId: d.entityTypeId, groupId: d.groupId, rules: d.rules, approvalState: d.approvalState }
}
function DraftEditor({ draft, groups, types, disabled, save }: { draft: CatalogDraft; groups: { id: string; label: string }[]; types: { id: string; label: string }[]; disabled: boolean; save: (body: CatalogCommand) => Promise<unknown> }) {
  const [form, setForm] = useState(draft)
  const locked = !!draft.publishedCategoryId
  return <View style={styles.card}>
    <Typography variant="heading">{locked ? 'Published List — expand values below' : 'Review definition and assign taxonomy'}</Typography>
    <TextField label="Title" value={form.title} editable={!locked} onChangeText={title => setForm(f => ({ ...f, title }))} />
    <TextField label="Question" value={form.prompt} editable={!locked} onChangeText={prompt => setForm(f => ({ ...f, prompt }))} />
    <TextField label="List key" value={form.slug} editable={!locked} onChangeText={slug => setForm(f => ({ ...f, slug }))} />
    {!locked && <>
      <SelectField label="Site group" value={form.groupId ?? ''} options={[{ label: 'Unassigned', value: '' }, ...groups.map(t => ({ label: t.label, value: t.id }))]} onSelect={groupId => setForm(f => ({ ...f, groupId: groupId || null }))} />
      <SelectField label="Value type" value={form.entityTypeId ?? ''} options={[{ label: 'Unassigned', value: '' }, ...types.map(t => ({ label: t.label, value: t.id }))]} onSelect={entityTypeId => setForm(f => ({ ...f, entityTypeId: entityTypeId || null }))} />
      <View style={styles.row}>
        <TextField label="Minimum answers" value={String(form.rules.minItems)} keyboardType="number-pad" onChangeText={v => setForm(f => ({ ...f, rules: { ...f.rules, minItems: Number(v) } }))} />
        <TextField label="Maximum answers" value={String(form.rules.maxItems)} keyboardType="number-pad" onChangeText={v => setForm(f => ({ ...f, rules: { ...f.rules, maxItems: Number(v) } }))} />
      </View>
      <SelectField label="Ordering" value={form.rules.orderingMode} options={['RANKED', 'UNRANKED'].map(v => ({ label: v, value: v }))} onSelect={v => setForm(f => ({ ...f, rules: { ...f.rules, orderingMode: v as 'RANKED' | 'UNRANKED' } }))} />
      <View style={styles.row}>{(['DRAFT', 'APPROVED', 'REJECTED'] as const).map(status => <Button key={status} label={status === 'DRAFT' ? 'Save draft' : status === 'APPROVED' ? 'Approve definition' : 'Reject'} disabled={disabled} variant={status === 'APPROVED' ? 'primary' : 'secondary'} onPress={() => { void save({ ...draftFields(form), approvalState: status }) }} />)}</View>
    </>}
  </View>
}

function CandidateEditor({ candidate: c, disabled, perform, act }: { candidate: CatalogCandidate; disabled: boolean; perform: (fn: () => Promise<unknown>) => Promise<void>; act: (b: CatalogCommand) => Promise<unknown> }) {
  const [name, setName] = useState(c.name), [slug, setSlug] = useState(c.slug)
  const [query, setQuery] = useState(c.name)
  const [matches, setMatches] = useState<CatalogEntity[]>([])
  const [suggestions, setSuggestions] = useState<CatalogOperation | null>(null)
  return <View style={styles.card}>
    <Typography variant="heading">{c.name}</Typography>
    <Typography variant="bodyMuted">{c.reviewState} · {c.resolutionState}{c.entity ? ` · Shared: ${c.entity.canonicalName}` : ''}</Typography>
    <Typography variant="bodyMuted">{c.details || 'No disambiguating details supplied.'}</Typography>
    <TextField label="Reviewed name (disambiguate if needed)" value={name} onChangeText={setName} />
    <TextField label="Stable entity key" value={slug} onChangeText={setSlug} />
    <View style={styles.row}>
      <TextField label="Search shared values" value={query} onChangeText={setQuery} />
      <Button label="Find existing" disabled={disabled} onPress={() => { void perform(async () => setMatches(await catalogCommand<CatalogEntity[]>({ action: 'matches', id: c.id, query }))) }} />
      <Button label="Approve as NEW identity" disabled={disabled} onPress={() => { void perform(() => act({ action: 'candidate', id: c.id, name, slug, reviewState: 'APPROVED', resolutionState: 'NEW' })) }} />
      <Button label="Reject" disabled={disabled} variant="secondary" onPress={() => { void perform(() => act({ action: 'candidate', id: c.id, reviewState: 'REJECTED' })) }} />
    </View>
    {matches.map(e => <Button key={e.id} label={`Use ${e.canonicalName} (${e.slug})`} disabled={disabled} variant="secondary" onPress={() => { void perform(() => act({ action: 'candidate', id: c.id, reviewState: 'APPROVED', resolvedEntityId: e.id })) }} />)}
    {c.resolvedEntityId && <>
      <Button label="Suggest reusable facets" disabled={disabled} variant="secondary" onPress={() => { void perform(async () => {
        const [op] = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind: 'FACETS', ids: [c.resolvedEntityId!] })
        const result = await catalogCommand<CatalogOperation>({ action: 'execute', id: op!.id })
        if (result.status !== 'SUCCEEDED') throw new Error(result.error || 'Facet generation failed')
        setSuggestions(result)
      }) }} />
      {c.entity?.facets?.map(f => <View key={f.id} style={styles.row}><Typography variant="body">{f.axis}: {f.value}</Typography><Button label="Remove facet" variant="secondary" disabled={disabled} onPress={() => { void perform(() => act({ action: 'facet-remove', id: f.id })) }} /></View>)}
      {suggestions?.output?.items.map((f, i) => <View key={i} style={styles.row}><Typography variant="body">{f.axis}: {f.value} — {f.reason}</Typography><Button label="Accept facet" disabled={disabled} onPress={() => { void perform(() => act({ action: 'facet-accept', id: suggestions.id, indices: [i] })) }} /></View>)}
    </>}
  </View>
}
const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  card: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  selected: { borderColor: colors.primary, borderWidth: 2 },
})
