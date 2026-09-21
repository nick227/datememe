import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import {
  ApiError,
  useAdminImportImage,
  useAdminReferenceImage,
  useAdminSearchImages,
  useAdminUploadImage,
  type components,
} from '@project/sdk'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'

type MediaAsset = components['schemas']['AdminMediaAsset']
type ImageCandidate = components['schemas']['AdminImageCandidate']

type Target = { entityId?: string; entityTypeId?: string; categoryId?: string }

type Props = {
  target: Target
  query: string
  entityTypeLabel?: string
  parentPath?: string
  asset: MediaAsset | null
  onAttached: (asset: MediaAsset) => void
}

/**
 * Native port of apps/admin's MediaAssetPicker (search-provider / upload /
 * attach-reference), reused across Taxonomy entity + type editing and List
 * Definition editing — same target contract, same three attach paths.
 * The web version's canvas zoom/offset cropper doesn't have a native
 * equivalent worth building: expo-image-picker's own allowsEditing + a
 * locked 1:1 aspect already gives a real native crop UI for free, and the
 * server re-encodes to WebP either way — see usePhotoPicker.ts for the same
 * pattern already used for profile photos.
 */
export function AdminImagePicker({ target, query, entityTypeLabel, parentPath, asset, onAttached }: Props) {
  const [candidates, setCandidates] = useState<ImageCandidate[] | null>(null)
  const sheet = useActionSheet()

  const search = useAdminSearchImages()
  const importImage = useAdminImportImage()
  const referenceImage = useAdminReferenceImage()
  const uploadImage = useAdminUploadImage()

  const attaching = importImage.isPending || referenceImage.isPending || uploadImage.isPending

  function showError(title: string, err: unknown) {
    sheet.show({ title, message: err instanceof ApiError ? err.message : 'Try again in a moment.', buttons: [{ text: 'OK' }] })
  }

  async function handleChooseUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    })
    const picked = result.assets?.[0]
    if (result.canceled || !picked) return

    uploadImage.mutate(
      { target, file: { uri: picked.uri, name: picked.fileName ?? `image-${Date.now()}.jpg`, type: picked.mimeType ?? 'image/jpeg' } },
      {
        onSuccess: (uploaded) => onAttached(uploaded),
        onError: (err) => showError('Upload failed', err),
      },
    )
  }

  function handleSearch() {
    if (!query.trim()) return
    search.mutate(
      { query, entityTypeLabel, parentPath },
      {
        onSuccess: (result) => setCandidates(result),
        onError: (err) => showError('Search failed', err),
      },
    )
  }

  function handleAttachCandidate(candidate: ImageCandidate) {
    const body = { ...target, candidate }
    const mutation = candidate.importRule === 'IMPORT_ALLOWED' ? importImage : referenceImage
    mutation.mutate(body, {
      onSuccess: (attached) => {
        onAttached(attached)
        setCandidates(null)
      },
      onError: (err) => showError('Could not attach image', err),
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Typography variant="label">Thumbnail image</Typography>
          <Typography variant="bodyMuted">Search trusted sources or upload your own.</Typography>
        </View>
        {asset?.provider ? (
          <View style={styles.providerPill}>
            <Typography variant="label" style={{ color: colors.inkMuted }}>{asset.provider}</Typography>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.previewCol}>
          <View style={styles.preview}>
            {asset?.publicUrl ? (
              <Image source={{ uri: asset.publicUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Typography variant="label" style={{ color: colors.inkMuted }}>No image</Typography>
            )}
            {attaching ? (
              <View style={[StyleSheet.absoluteFill, styles.previewOverlay]}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </View>
          {asset?.attribution ? <Typography variant="label" style={styles.provenance}>{asset.attribution}</Typography> : null}
          {asset?.license ? <Typography variant="label" style={styles.provenance}>{asset.license}</Typography> : null}
        </View>

        <View style={styles.actionsCol}>
          <View style={styles.buttonRow}>
            <Button label="Choose upload" variant="secondary" onPress={handleChooseUpload} disabled={attaching} />
            <Button
              label={search.isPending ? 'Searching…' : 'Find image'}
              variant="secondary"
              onPress={handleSearch}
              disabled={search.isPending || !query.trim()}
            />
          </View>

          {candidates && candidates.length > 0 ? (
            <View style={styles.candidateGrid}>
              {candidates.map((candidate) => (
                <Pressable
                  key={`${candidate.provider}:${candidate.externalId}`}
                  style={styles.candidateTile}
                  disabled={attaching}
                  onPress={() => handleAttachCandidate(candidate)}
                >
                  <Image source={{ uri: candidate.previewUrl }} style={styles.candidateImage} resizeMode="cover" />
                  <Typography variant="label" numberOfLines={1} style={styles.candidateTitle}>{candidate.title}</Typography>
                  <Typography variant="label" numberOfLines={1} style={styles.candidateMeta}>
                    {candidate.provider} · {candidate.importRule === 'IMPORT_ALLOWED' ? 'import' : 'reference'}
                  </Typography>
                </Pressable>
              ))}
            </View>
          ) : candidates && candidates.length === 0 ? (
            <Typography variant="bodyMuted">No results.</Typography>
          ) : null}
        </View>
      </View>

      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  providerPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  body: { gap: spacing.md },
  previewCol: { gap: spacing.xs },
  preview: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewOverlay: {
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  provenance: { color: colors.inkMuted, width: 120 },
  actionsCol: { gap: spacing.md },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  candidateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  candidateTile: {
    width: '31%',
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  candidateImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
  },
  candidateTitle: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    color: colors.ink,
  },
  candidateMeta: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
    color: colors.inkMuted,
  },
})
