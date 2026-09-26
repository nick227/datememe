import { useState, useEffect } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { catalogCommand, useAdminCatalog, type CatalogOperation, type CatalogCommand } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Typography } from '../../../ui/Typography'
import { Button } from '../../../ui/Button'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminContentListDetail'>
export function AdminContentListDetailScreen({ navigation, route }: Props) {
  const { draftId } = route.params
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()
  
  const state = useAdminCatalog({ draftId })
  const draft = state.data?.draft

  const [title, setTitle] = useState(draft?.title || '')
  const [groupId, setGroupId] = useState(draft?.groupId || '')

  useEffect(() => {
    if (draft) {
      setTitle(draft.title)
      setGroupId(draft.groupId || '')
    }
  }, [draft?.title, draft?.groupId])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] })

  const executeBackground = async (ops: CatalogOperation[]) => {
    let completed = 0, failed = 0
    for (const op of ops) {
      try {
        const result = await catalogCommand<CatalogOperation>({ action: 'execute', id: op.id })
        if (result.status === 'SUCCEEDED') completed++; else failed++
      } catch { failed++ }
      await refresh()
    }
  }

  const saveDraft = async (updates: Partial<CatalogCommand>) => {
    if (!draft) return
    await catalogCommand({
      action: 'draft',
      id: draft.id,
      title: draft.title,
      slug: draft.slug,
      prompt: draft.prompt,
      entityTypeId: draft.entityTypeId,
      groupId: draft.groupId,
      rules: draft.rules,
      approvalState: draft.approvalState,
      ...updates
    })
    await refresh()
  }

  const generateMoreValues = async () => {
    if (!draft) return
    setBusy(true)
    setMessage('Generating values...')
    try {
      const typeId = draft.entityTypeId || state.data?.types[0]?.id
      await saveDraft({ title, groupId, entityTypeId: typeId, approvalState: 'APPROVED' })
      
      const ops = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind: 'VALUES', ids: [draft.id], count: 20 })
      await executeBackground(ops)
      
      // Auto-resolve values
      const candidates = state.data?.draft?.candidates || []
      const candidateIds = candidates.map(c => c.id)
      if (candidateIds.length > 0) {
        await catalogCommand({ action: 'resolve-existing', ids: candidateIds })
        for (const c of candidates) {
          if (c.resolutionState !== 'EXISTING' && c.resolutionState !== 'AMBIGUOUS' && c.reviewState !== 'APPROVED') {
             await catalogCommand({ action: 'candidate', id: c.id, name: c.name, slug: c.slug, reviewState: 'APPROVED', resolutionState: 'NEW' })
          }
        }
      }
      
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  const publish = async () => {
    if (!draft) return
    setBusy(true)
    setMessage('Publishing...')
    try {
      const typeId = draft.entityTypeId || state.data?.types[0]?.id
      await saveDraft({ title, groupId, entityTypeId: typeId, approvalState: 'APPROVED' })
      
      await catalogCommand({ action: 'publish', id: draft.id })
      setMessage('Published successfully.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  if (state.isLoading) return <ScreenContainer><Typography>Loading...</Typography></ScreenContainer>
  if (!draft) return <ScreenContainer><Typography>List not found</Typography></ScreenContainer>

  const locked = !!draft.publishedCategoryId

  return (
    <ScreenContainer testID="screen.admin-content-list-detail" width="wide">
      <TopNavigation testID="admin-content-list-detail.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title={draft.title} subtitle="List Details" />
      <ScrollView contentContainerStyle={styles.content}>
        {!!message && <Typography variant="body" color="primary">{message}</Typography>}
        
        <View style={styles.card}>
          <TextField label="Title" value={title} onChangeText={setTitle} editable={!locked} onBlur={() => saveDraft({ title })} />
          
          <SelectField 
            label="Group" 
            value={groupId} 
            options={state.data?.groups.map(g => ({ label: g.label, value: g.id })) || []} 
            onSelect={(id) => {
              setGroupId(id)
              saveDraft({ groupId: id })
            }} 
            disabled={locked}
          />
        </View>

        <View style={styles.card}>
          <Typography variant="heading">Values</Typography>
          {draft.candidates?.map(c => (
            <Typography key={c.id} variant="body">• {c.name} {c.resolutionState === 'AMBIGUOUS' ? '(Needs manual review)' : ''}</Typography>
          ))}
          {draft.candidates?.length === 0 && <Typography variant="bodyMuted">No values generated yet.</Typography>}
        </View>

        <View style={styles.actions}>
          <Button label="Generate more values" disabled={busy} onPress={generateMoreValues} />
          <Button label="Publish" disabled={busy || locked} onPress={publish} />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  card: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }
})
