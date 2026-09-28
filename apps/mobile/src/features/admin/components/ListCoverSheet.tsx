import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, useAdminSetListCover, useAdminSuggestListCover, useAdminUploadImage, type AdminListDetail } from '@project/sdk'
import { AnimatedSheet } from '../../../ui/AnimatedSheet'
import { Button } from '../../../ui/Button'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, spacing } from '../../../theme'

// Change cover (docs/admin-lists-roadmap.md §3.3): the cover automation's top
// candidates for this list (already duplicate-safe), plus Upload, No cover
// and Revert previous. Suggestions run on the server for ~20–40 s; the list
// query polls while they do.

type Props = { list: AdminListDetail; visible: boolean; onClose: () => void }

export function ListCoverSheet({ list, visible, onClose }: Props) {
  const queryClient = useQueryClient()
  const suggest = useAdminSuggestListCover()
  const setCover = useAdminSetListCover()
  const upload = useAdminUploadImage()
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const state = list.coverSuggest
  const candidates = state?.status === 'done' ? state.candidates ?? [] : []
  const busy = setCover.isPending || upload.isPending

  // Opening the sheet starts a suggestion run unless there's a usable one.
  useEffect(() => {
    if (visible && (!state || state.status === 'failed') && !suggest.isPending) suggest.mutate(list.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])
  // The best candidate is preselected until the admin taps another.
  const chosen = candidates.some((c) => c.id === selected) ? selected : candidates[0]?.id ?? null

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Something went wrong; try again.')
  const done = { onSuccess: () => { setError(null); onClose() }, onError: fail }

  async function handleUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [3, 4] })
    const picked = result.assets?.[0]
    if (result.canceled || !picked) return
    upload.mutate(
      { target: { categoryId: list.id }, file: { uri: picked.uri, name: picked.fileName ?? `cover-${Date.now()}.jpg`, type: picked.mimeType ?? 'image/jpeg' } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'list', list.id] }); queryClient.invalidateQueries({ queryKey: ['admin', 'lists'] }); done.onSuccess() }, onError: fail },
    )
  }

  return (
    <AnimatedSheet testID="list-cover" visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.header}>
        <Typography variant="heading">Change cover</Typography>
        <Pressable testID="list-cover.close" hitSlop={12} onPress={onClose}><Typography variant="heading">✕</Typography></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
        <View style={styles.sectionHead}>
          <Typography variant="label">Suggested</Typography>
          {state?.status !== 'running' && !suggest.isPending ? (
            <Pressable testID="list-cover.resuggest" onPress={() => suggest.mutate(list.id, { onError: fail })}>
              <Typography variant="label" style={{ color: colors.ink }}>Find new</Typography>
            </Pressable>
          ) : null}
        </View>

        {state?.status === 'running' || suggest.isPending ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.ink} />
            <Typography variant="bodyMuted">Finding covers… about 30 seconds.</Typography>
          </View>
        ) : state?.status === 'failed' ? (
          <Typography variant="bodyMuted">{`Couldn't find covers: ${state.error}. Try "Find new", upload one, or choose No cover.`}</Typography>
        ) : state?.status === 'done' && !candidates.length ? (
          <Typography variant="bodyMuted">No good, unused cover found for this list. Upload one or choose No cover.</Typography>
        ) : (
          <View style={styles.grid}>
            {candidates.map((c) => (
              <Pressable key={c.id} testID={`list-cover.candidate.${c.id}`} style={[styles.cell, chosen === c.id && styles.cellOn]} onPress={() => setSelected(c.id)}>
                <View style={styles.image}>
                  <Image source={{ uri: c.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                </View>
                <Typography variant="bodyMuted" numberOfLines={1} style={styles.credit}>{c.license.toUpperCase()}{c.creator ? ` · ${c.creator}` : ''}</Typography>
              </Pressable>
            ))}
          </View>
        )}

        {candidates.length && !candidates.some((c) => c.good) ? (
          <Typography variant="bodyMuted">None of these is a strong match for this list — uploading your own may be better.</Typography>
        ) : null}
        {error ? <Typography variant="bodyMuted" style={{ color: colors.danger }}>{error}</Typography> : null}

        <Button testID="list-cover.use" label="Use this cover" disabled={!chosen || busy} loading={setCover.isPending && setCover.variables?.action === 'use'}
          onPress={() => chosen && setCover.mutate({ id: list.id, action: 'use', candidateId: chosen }, done)} />
        <Button testID="list-cover.upload" label="Upload" variant="secondary" disabled={busy} loading={upload.isPending} onPress={handleUpload} />
        <Button testID="list-cover.none" label="No cover" variant="secondary" disabled={busy || list.cover.status === 'none'}
          onPress={() => setCover.mutate({ id: list.id, action: 'none' }, done)} />
        <Button testID="list-cover.revert" label="Revert previous" variant="secondary" disabled={busy || !list.cover.canRevert}
          onPress={() => setCover.mutate({ id: list.id, action: 'revert' }, done)} />
      </ScrollView>
    </AnimatedSheet>
  )
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopWidth: borderWidth.thick, borderColor: colors.ink, padding: spacing.lg, alignSelf: 'center', maxWidth: 720 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31.5%', borderWidth: borderWidth.thick, borderColor: colors.transparent, padding: 2 },
  cellOn: { borderColor: colors.ink },
  image: { aspectRatio: 3 / 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  credit: { fontSize: 11, marginTop: 2 },
})
