import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCurrentUser, useUpdateMyProfile } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { PhotoPicker } from '../../../ui/PhotoPicker'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { spacing } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>

const MAX_GALLERY_PHOTOS = 6

export function EditProfileScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const update = useUpdateMyProfile()
  const sheet = useActionSheet()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || !me.data?.profile) return
    setDisplayName(me.data.profile.displayName)
    setBio(me.data.profile.bio ?? '')
    setAvatarUrl(me.data.profile.avatarUrl ?? null)
    setGalleryUrls(me.data.profile.photos ?? [])
    setHydrated(true)
  }, [me.data, hydrated])

  function updateGalleryPhoto(index: number, url: string) {
    setGalleryUrls((prev) => prev.map((u, i) => (i === index ? url : u)))
  }

  function removeGalleryPhoto(index: number) {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    try {
      await update.mutateAsync({
        displayName,
        bio: bio.trim() || null,
        avatarUrl,
        photos: galleryUrls,
      })
      navigation.goBack()
    } catch (err: any) {
      sheet.show({ title: 'Could not save', message: err?.message ?? 'Try again in a moment', buttons: [{ testID: 'edit-profile.dialog.ok', text: 'OK' }] })
    }
  }

  return (
    <ScreenContainer testID="screen.edit-profile" width="narrow">
      <TopNavigation testID="edit-profile.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Edit profile" />
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <PhotoPicker testID="edit-profile.avatar"
            uri={avatarUrl}
            onChange={setAvatarUrl}
            size={112}
            placeholder={displayName.charAt(0).toUpperCase() || '+'}
          />
          <Typography variant="bodyMuted" style={{ marginTop: spacing.sm }}>
            Tap to change your main photo
          </Typography>
        </View>

        <TextField testID="edit-profile.display-name" label="Display name" value={displayName} onChangeText={setDisplayName} />
        <TextField testID="edit-profile.bio"
          label="Tagline"
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, 150))}
          placeholder="A short line about you (150 chars max)"
          multiline
        />

        <Typography variant="label" style={{ marginBottom: spacing.sm }}>
          MORE PHOTOS
        </Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {galleryUrls.map((url, i) => (
              <PhotoPicker testID={`edit-profile.gallery-slot.${i}`}
                key={i}
                uri={url}
                onChange={(newUrl) => updateGalleryPhoto(i, newUrl)}
                onRemove={() => removeGalleryPhoto(i)}
                size={72}
                shape="square"
              />
            ))}
            {galleryUrls.length < MAX_GALLERY_PHOTOS ? (
              <PhotoPicker testID="edit-profile.add-photo"
                uri={null}
                onChange={(newUrl) => setGalleryUrls((prev) => [...prev, newUrl])}
                size={72}
                shape="square"
              />
            ) : null}
          </View>
        </ScrollView>

        <Button testID="edit-profile.save" label="Save" onPress={handleSave} loading={update.isPending} />
      </ScrollView>
      <ActionSheet testID="edit-profile.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}
