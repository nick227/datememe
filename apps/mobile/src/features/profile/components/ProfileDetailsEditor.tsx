import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useUpdateMyProfile, type components } from '@project/sdk'
import { Typography } from '../../../ui/Typography'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { colors, spacing } from '../../../theme'
import { AttributeFields } from './AttributeFields'
import { ChoiceChips } from './ChoiceChips'

type Profile = components['schemas']['Profile']
const GENDERS = [{ value: 'MALE', label: 'Man' }, { value: 'FEMALE', label: 'Woman' }, { value: 'NON_BINARY', label: 'Nonbinary' }, { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' }]
const SEEKING = [{ value: 'MALE', label: 'Men' }, { value: 'FEMALE', label: 'Women' }, { value: 'NON_BINARY', label: 'Nonbinary' }]

export function ProfileDetailsEditor({ profile }: { profile: Profile }) {
  const initial = { displayName: profile.displayName, bio: profile.bio ?? '', locationLabel: profile.locationLabel ?? '', genderIdentity: profile.genderIdentity, seekingGenders: profile.seekingGenders, isA: profile.isA, lookingFor: profile.lookingFor }
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const update = useUpdateMyProfile()
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const validName = draft.displayName.trim().length > 0

  function change(patch: Partial<typeof draft>) {
    setDraft(value => ({ ...value, ...patch }))
    setMessage('')
    setError('')
  }

  async function save() {
    if (!validName) return
    setError('')
    try {
      const result = await update.mutateAsync({ ...draft, displayName: draft.displayName.trim(), bio: draft.bio.trim() || null, locationLabel: draft.locationLabel.trim() || null })
      const next = { displayName: result.displayName, bio: result.bio ?? '', locationLabel: result.locationLabel ?? '', genderIdentity: result.genderIdentity, seekingGenders: result.seekingGenders, isA: result.isA, lookingFor: result.lookingFor }
      setDraft(next)
      setSaved(next)
      setMessage('Your details are saved')
    } catch (err: any) { setError(err?.message ?? 'Could not save your details. Please try again.') }
  }

  return (
    <View style={styles.section}>
      <Typography variant="title">About you</Typography>
      <Typography variant="bodyMuted">The little details that help people get to know you.</Typography>
      <View style={styles.fields}>
        <TextField testID="profile.display-name" accessibilityLabel="Display name" label="Display name" value={draft.displayName} onChangeText={displayName => change({ displayName })} maxLength={50} editable={!update.isPending} style={styles.input} error={!validName ? 'Enter your display name' : undefined} />
        <TextField testID="profile.city" accessibilityLabel="City" label="City" placeholder="e.g. Austin, TX" value={draft.locationLabel} onChangeText={locationLabel => change({ locationLabel })} editable={!update.isPending} style={styles.input} />
        <View style={styles.ageRow}>
          <View><Typography variant="label">Age</Typography><Typography variant="heading">{profile.age != null ? `${profile.age} years old` : 'Not available'}</Typography></View>
        </View>


        <Typography variant="label" style={styles.fieldLabel}>About you</Typography>
        <ChoiceChips mode="single" options={GENDERS} selected={draft.genderIdentity ? [draft.genderIdentity] : []} disabled={update.isPending} onToggle={(value) => change({ genderIdentity: draft.genderIdentity === value ? null : value })} />
        <AttributeFields title="Looking for" selected={draft.lookingFor} disabled={update.isPending} onChange={(lookingFor) => change({ lookingFor })} />
        <TextField testID="profile.about" accessibilityLabel="About you" label="About" placeholder="A little about you and what you enjoy…" value={draft.bio} onChangeText={bio => change({ bio })} maxLength={150} multiline editable={!update.isPending} style={[styles.input, styles.bio]} />
        <Typography variant="bodyMuted" style={styles.counter}>{draft.bio.length} / 150</Typography>
      </View>
      {error ? <Typography accessibilityRole="alert" style={styles.error}>{error}</Typography> : null}
      <View style={styles.saveRow}>
        <View style={styles.saveButton}><Button testID="profile.save-details" label="Save details" onPress={save} loading={update.isPending} disabled={!dirty || !validName} /></View>
        {dirty ? <Pressable accessibilityRole="button" disabled={update.isPending} onPress={() => { setDraft(saved); setError(''); setMessage('') }} style={styles.reset}><Typography variant="bodyMuted">Cancel</Typography></Pressable> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  fields: { marginTop: spacing.sm },
  input: { borderColor: colors.border, backgroundColor: colors.surfaceMuted, fontFamily: 'PlusJakartaSans_400Regular' },
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceMuted, borderRadius: 14, marginBottom: spacing.xl },
  ageHelp: { fontSize: 12, maxWidth: 160 },
  fieldLabel: { marginBottom: spacing.sm },
  helper: { fontSize: 12 },
  bio: { minHeight: 108, textAlignVertical: 'top', lineHeight: 24 },
  counter: { textAlign: 'right', fontSize: 12 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  saveButton: { flex: 1 },
  reset: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  error: { color: colors.danger },
})
