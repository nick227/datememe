import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useQueryClient } from '@tanstack/react-query'
import { catalogCommand, useAdminCatalog, type CatalogOperation } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Typography } from '../../../ui/Typography'
import { Button } from '../../../ui/Button'
import { colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminContent'>
export function AdminContentScreen({ navigation }: Props) {
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()
  const state = useAdminCatalog({ offset: 0 })

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

  const generateConcepts = async () => {
    setBusy(true)
    setMessage('Generating concepts...')
    try {
      const ops = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind: 'CONCEPTS', count: 50, brief: 'Everyday interests, culture, and things people love' })
      await executeBackground(ops)
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  const generateLists = async () => {
    if (!selectedConcepts.length) return
    setBusy(true)
    setMessage('Generating lists...')
    try {
      await catalogCommand({ action: 'concept-status', ids: selectedConcepts, status: 'USE' })
      
      const ops = await catalogCommand<CatalogOperation[]>({ action: 'enqueue', kind: 'LIST_IDEAS', ids: selectedConcepts, count: 10 })
      await executeBackground(ops)
      setMessage('')
      setSelectedConcepts([])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  const toggleConcept = (id: string) => setSelectedConcepts(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <ScreenContainer testID="screen.admin-content" width="wide">
      <TopNavigation testID="admin-content.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Content Factory" />
      <ScrollView contentContainerStyle={styles.content}>
        {!!message && <Typography variant="body" color="primary">{message}</Typography>}
        
        <View style={styles.section}>
          <Typography variant="heading">Concepts</Typography>
          <Button label="Generate concepts" disabled={busy} onPress={generateConcepts} />
          
          <View style={styles.conceptList}>
            {state.data?.concepts.map(c => (
              <Pressable key={c.id} style={[styles.conceptItem, selectedConcepts.includes(c.id) && styles.selected]} onPress={() => toggleConcept(c.id)}>
                <Typography variant="body">{selectedConcepts.includes(c.id) ? '☑ ' : '☐ '}{c.label}</Typography>
              </Pressable>
            ))}
          </View>
          
          <Button label="Generate lists" disabled={busy || !selectedConcepts.length} onPress={generateLists} />
        </View>

        <View style={styles.section}>
          <Typography variant="heading">Lists</Typography>
          {state.data?.drafts.map(d => (
            <View key={d.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Typography variant="body" weight="bold">{d.title}</Typography>
                {d.publishedCategoryId && <Typography variant="bodyMuted">Published</Typography>}
              </View>
              <Button label="Open" variant="secondary" onPress={() => navigation.navigate('AdminContentListDetail', { draftId: d.id })} />
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.xl },
  section: { gap: spacing.md },
  conceptList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  conceptItem: { padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceHighlight },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, gap: spacing.md },
})
