import * as ImagePicker from 'expo-image-picker'
import { useUploadMedia } from '@project/sdk'

/**
 * The reusable primitive for "let the user pick a photo and get back a hosted URL" —
 * anywhere in the app that needs a photo (profile avatar, gallery slots, anything
 * added later) should go through this, not call expo-image-picker directly. Picking
 * lives here (Expo-specific, so it can't live in the platform-agnostic SDK); uploading
 * delegates to `useUploadMedia` from `@project/sdk` so there's exactly one upload
 * implementation.
 */
export function usePhotoPicker() {
  const upload = useUploadMedia()

  async function pick(): Promise<string | null> {
    // Permission prompts are a no-op on web; harmless to call unconditionally.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return null

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })
    const asset = result.assets?.[0]
    if (result.canceled || !asset) return null

    const uploaded = await upload.mutateAsync({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    })
    return uploaded.url
  }

  return { pick, isUploading: upload.isPending }
}
