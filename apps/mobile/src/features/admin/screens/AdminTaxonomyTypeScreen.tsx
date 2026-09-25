import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminEntityTypes, useAdminUpdateEntityType } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { AdminImagePicker } from '../components/AdminImagePicker'
import { spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminTaxonomyType'>

export function AdminTaxonomyTypeScreen({ route, navigation }: Props) {
  const { typeId } = route.params
  const types = useAdminEntityTypes()
  const updateType = useAdminUpdateEntityType()
  const sheet = useActionSheet()

  const type = types.data?.find((t) => t.id === typeId)

  const [label, setLabel] = useState('')
  const [pluralLabel, setPluralLabel] = useState('')
  const [slug, setSlug] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (type) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabel(type.label)
      setPluralLabel(type.pluralLabel)
      setSlug(type.slug)
      setIsActive(type.isActive)
    }
  }, [type])

  function handleSave() {
    updateType.mutate(
      { id: typeId, slug, label, pluralLabel, parentId: type?.parentId ?? null, isActive },
      {
        onSuccess: () => sheet.show({ title: 'Saved', buttons: [{ testID: 'admin-taxonomy-type.dialog.ok', text: 'OK', onPress: () => navigation.goBack() }] }),
        onError: (err) => sheet.show({ title: 'Could not save', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-taxonomy-type.dialog.ok', text: 'OK' }] }),
      },
    )
  }

  if (types.isLoading) {
    return (
      <ScreenContainer testID="screen.admin-taxonomy-type" width="narrow">
        <TopNavigation testID="admin-taxonomy-type.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Edit type" />
        <Skeleton height={200} />
      </ScreenContainer>
    )
  }

  if (types.isError || !type) {
    return (
      <ScreenContainer testID="screen.admin-taxonomy-type" width="narrow">
        <TopNavigation testID="admin-taxonomy-type.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Edit type" />
        <ErrorState testID="admin-taxonomy-type.error" subtitle="Couldn't load this type." onRetry={() => types.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.admin-taxonomy-type" width="narrow">
      <TopNavigation testID="admin-taxonomy-type.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Edit Type" />

      <ScrollView>
        <TextField testID="admin-taxonomy-type.label" label="Label" value={label} onChangeText={setLabel} />
        <TextField testID="admin-taxonomy-type.plural-label" label="Plural label" value={pluralLabel} onChangeText={setPluralLabel} />
        <TextField testID="admin-taxonomy-type.slug" label="Slug" value={slug} onChangeText={setSlug} autoCapitalize="none" />

        <View style={styles.toggleRow}>
          <Typography variant="body">Active (visible in app)</Typography>
          <Button testID="admin-taxonomy-type.is-active" label={isActive ? 'Active' : 'Archived'} variant="secondary" onPress={() => setIsActive((v) => !v)} />
        </View>

        <Button testID="admin-taxonomy-type.save" label="Save changes" loading={updateType.isPending} onPress={handleSave} />

        <AdminImagePicker
          target={{ entityTypeId: typeId }}
          query={label}
          asset={type.mediaAssets.find((m) => m.isPrimary) ?? null}
          onAttached={() => {}}
        />
      </ScrollView>

      <ActionSheet testID="admin-taxonomy-type.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
})
