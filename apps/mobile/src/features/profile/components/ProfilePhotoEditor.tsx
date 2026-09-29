import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Plus, Star, Trash2 } from 'lucide-react-native'
import { useUpdateMyProfile } from '@project/sdk'
import { usePhotoPicker } from '../../../lib/usePhotoPicker'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

const MAX_PHOTOS = 7 // One main photo and six gallery photos.

type Props = { avatarUrl: string | null; photos: string[] }

export function ProfilePhotoEditor({ avatarUrl, photos: initialPhotos }: Props) {
  const [photos, setPhotos] = useState(() => Array.from(new Set([avatarUrl, ...initialPhotos].filter((url): url is string => !!url))))
  const [selected, setSelected] = useState(0)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const update = useUpdateMyProfile()
  const { pick } = usePhotoPicker({ crop: false })
  const sheet = useActionSheet()
  const current = photos[selected]

  async function save(next: string[], nextSelected: number) {
    await update.mutateAsync({ avatarUrl: next[0] ?? null, photos: next.slice(1) })
    setPhotos(next)
    setSelected(Math.max(0, Math.min(nextSelected, next.length - 1)))
    setStatus('Photos saved')
  }

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setStatus('')
    try { await action() } catch (error: any) {
      sheet.show({ title: 'Could not update photos', message: error?.message ?? 'Please try again.', buttons: [{ text: 'OK' }] })
    } finally { setBusy(false) }
  }

  function upload(replace: boolean) {
    void run(async () => {
      const url = await pick()
      if (!url) return
      const next = [...photos]
      if (replace) next[selected] = url
      else next.push(url)
      await save(next, replace ? selected : next.length - 1)
    })
  }

  function move(offset: number) {
    void run(async () => {
      const next = [...photos]
      const target = selected + offset
      ;[next[selected], next[target]] = [next[target], next[selected]]
      await save(next, target)
    })
  }

  function remove() {
    sheet.show({
      title: 'Remove this photo?',
      message: selected === 0 && photos.length > 1 ? 'Your next photo will become your main photo.' : 'You can add another photo any time.',
      buttons: [
        { text: 'Keep photo', style: 'cancel' },
        { text: 'Remove photo', style: 'destructive', onPress: () => { void run(() => save(photos.filter((_, i) => i !== selected), selected)) } },
      ],
    })
  }

  return (
    <View style={styles.section}>
      <View style={styles.hero}>
        {current ? (
          <>
            <Image source={{ uri: current }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel={`Your photo ${selected + 1}`} />
            <View style={styles.mainBadge}>
              {selected === 0 ? <Star size={14} color={colors.white} /> : null}
              <Typography style={styles.badgeText}>{selected === 0 ? 'Main photo' : `Photo ${selected + 1}`}</Typography>
            </View>
          </>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Add your first photo" testID="profile.photos.first" disabled={busy} onPress={() => upload(false)} style={styles.empty}>
            <View style={styles.emptyIcon}><ImagePlus size={30} color={colors.accent} /></View>
            <Typography variant="heading">Make it feel like you</Typography>
            <Typography variant="bodyMuted">Add your first photo</Typography>
          </Pressable>
        )}
        {busy ? <View style={styles.loading}><ActivityIndicator color={colors.white} /><Typography style={styles.badgeText}>Updating photos…</Typography></View> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
        {photos.map((url, index) => (
          <Pressable key={`${url}-${index}`} accessibilityRole="button" accessibilityLabel={`Select photo ${index + 1}${index === 0 ? ', main photo' : ''}`} accessibilityState={{ selected: selected === index }} disabled={busy} onPress={() => setSelected(index)} style={[styles.thumbnail, selected === index && styles.selected]}>
            <Image source={{ uri: url }} style={styles.thumbnailImage} />
            {index === 0 ? <View style={styles.star}><Star size={12} color={colors.white} fill={colors.white} /></View> : null}
          </Pressable>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add photo" testID="profile.photos.add" disabled={busy} onPress={() => upload(false)} style={[styles.thumbnail, styles.add]}>
            <Plus size={24} color={colors.accent} /><Typography style={styles.addText}>Add photo</Typography>
          </Pressable>
        ) : null}
      </ScrollView>
      {current ? (
        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => upload(true)} style={styles.tool}><Camera size={17} color={colors.ink} /><Typography style={styles.toolText}>Replace</Typography></Pressable>
          {selected > 0 ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(() => save([current, ...photos.filter((_, i) => i !== selected)], 0)) }} style={styles.tool}><Star size={17} color={colors.ink} /><Typography style={styles.toolText}>Make main</Typography></Pressable> : null}
          <View style={styles.orderControls}>
            <Pressable accessibilityRole="button" accessibilityLabel="Move photo earlier" disabled={busy || selected === 0} onPress={() => move(-1)} style={[styles.iconTool, (busy || selected === 0) && styles.disabled]}><ArrowLeft size={18} color={colors.ink} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Move photo later" disabled={busy || selected === photos.length - 1} onPress={() => move(1)} style={[styles.iconTool, (busy || selected === photos.length - 1) && styles.disabled]}><ArrowRight size={18} color={colors.ink} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove selected photo" disabled={busy} onPress={remove} style={styles.iconTool}><Trash2 size={18} color={colors.inkMuted} /></Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.caption}>
        {status ? <Check size={14} color={colors.accent} /> : null}
        <Typography variant="bodyMuted" accessibilityLiveRegion="polite" style={styles.captionText}>{status || 'Your first photo is your main photo. Changes save automatically.'}</Typography>
      </View>
      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  hero: { aspectRatio: 1.25, backgroundColor: colors.surfaceMuted, borderRadius: 20, overflow: 'hidden' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  mainBadge: { position: 'absolute', left: spacing.md, bottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.overlay },
  badgeText: { color: colors.white, fontSize: 13 },
  thumbnails: { gap: spacing.sm, paddingVertical: 2 },
  thumbnail: { width: 76, height: 88, borderRadius: 14, borderWidth: 2, borderColor: colors.transparent, padding: 3 },
  thumbnailImage: { width: '100%', height: '100%', borderRadius: 9 },
  selected: { borderColor: colors.accent },
  star: { position: 'absolute', bottom: 7, left: 7, padding: 4, backgroundColor: colors.overlay, borderRadius: 12 },
  add: { borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted },
  addText: { fontSize: 11, color: colors.accent },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  tool: { minHeight: 44, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 24, backgroundColor: colors.surfaceMuted },
  toolText: { fontSize: 13 },
  orderControls: { flexDirection: 'row', marginLeft: 'auto' },
  iconTool: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  disabled: { opacity: 0.3 },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  caption: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  captionText: { fontSize: 12, flex: 1 },
})
