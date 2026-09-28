import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { ApiError, useAdminAddListValue, useAdminEntities, type AdminListDetail } from '@project/sdk'
import { AnimatedSheet } from '../../../ui/AnimatedSheet'
import { TextField } from '../../../ui/TextField'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, spacing } from '../../../theme'

// + Add (docs/admin-lists-roadmap.md §3.2, decision 7): pick an existing value
// of the list's type, or add a new one by name. The server matches names
// before creating anything; a merely similar value comes back for the admin
// to confirm ("Did you mean …?") or override.

type Props = { list: AdminListDetail; visible: boolean; onClose: () => void }

export function AddListValueSheet({ list, visible, onClose }: Props) {
  const entities = useAdminEntities(visible ? list.entityType.id : undefined)
  const add = useAdminAddListValue()
  const [text, setText] = useState('')
  const [similar, setSimilar] = useState<{ entityId: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inList = useMemo(() => new Set(list.values.map((v) => v.entityId)), [list.values])
  const query = text.trim().toLowerCase()
  const matches = useMemo(
    () => (entities.data ?? []).filter((e: any) => !inList.has(e.id) && !e.mergedIntoId && (!query || e.canonicalName.toLowerCase().includes(query))).slice(0, 30),
    [entities.data, inList, query],
  )

  const reset = () => { setText(''); setSimilar(null); setError(null) }
  const submit = (body: { entityId?: string; name?: string; create?: boolean }) => {
    setError(null)
    add.mutate({ id: list.id, ...body }, {
      onSuccess: (result) => {
        if (result.status === 'similar' && result.match) setSimilar(result.match)
        else reset()
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not add that value.'),
    })
  }

  return (
    <AnimatedSheet testID="add-value" visible={visible} onClose={() => { reset(); onClose() }} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Typography variant="heading">Add a value</Typography>
        <Pressable testID="add-value.close" hitSlop={12} onPress={() => { reset(); onClose() }}><Typography variant="heading">✕</Typography></Pressable>
      </View>
      <TextField testID="add-value.search" placeholder={`Search ${list.entityType.label} values…`} value={text} onChangeText={(t) => { setText(t); setSimilar(null) }} autoFocus autoCorrect={false} />

      {similar ? (
        <View style={styles.similar}>
          <Typography variant="body">Did you mean <Typography variant="body" style={styles.bold}>{similar.name}</Typography>?</Typography>
          <View style={styles.similarActions}>
            <Pressable testID="add-value.use-similar" onPress={() => submit({ entityId: similar.entityId })}><Typography variant="label" style={styles.action}>Use {similar.name}</Typography></Pressable>
            <Pressable testID="add-value.create-anyway" onPress={() => submit({ name: text, create: true })}><Typography variant="label" style={styles.action}>Add “{text.trim()}” as new</Typography></Pressable>
          </View>
        </View>
      ) : null}
      {error ? <Typography variant="bodyMuted" style={{ color: colors.danger }}>{error}</Typography> : null}

      <FlatList
        style={styles.results}
        keyboardShouldPersistTaps="handled"
        data={matches}
        keyExtractor={(e: any) => e.id}
        ListHeaderComponent={query && !similar ? (
          <Pressable testID="add-value.new" style={styles.row} disabled={add.isPending} onPress={() => submit({ name: text })}>
            <Typography variant="body" style={styles.bold}>+ Add “{text.trim()}”</Typography>
          </Pressable>
        ) : null}
        renderItem={({ item }: { item: any }) => (
          <Pressable testID={`add-value.pick.${item.slug}`} style={styles.row} disabled={add.isPending} onPress={() => submit({ entityId: item.id })}>
            <Typography variant="body">{item.canonicalName}</Typography>
          </Pressable>
        )}
        ListEmptyComponent={entities.isLoading ? <Typography variant="bodyMuted">Loading…</Typography> : null}
      />
    </AnimatedSheet>
  )
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopWidth: borderWidth.thick, borderColor: colors.ink, padding: spacing.lg, alignSelf: 'center', maxWidth: 720 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  similar: { gap: spacing.sm, paddingBottom: spacing.md },
  similarActions: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  action: { color: colors.ink },
  bold: { fontFamily: 'PlusJakartaSans_700Bold' },
  results: { maxHeight: 360 },
  row: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
})
