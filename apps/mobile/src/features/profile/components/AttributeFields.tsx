import { StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { spacing } from '../../../theme'
import { PROFILE_ATTRIBUTE_GROUPS, type ProfileAttributeKey } from '../profileAttributes'
import { ChoiceChips } from './ChoiceChips'

type Props = {
  title: string
  helper: string
  selected: readonly ProfileAttributeKey[]
  onChange: (next: ProfileAttributeKey[]) => void
  disabled?: boolean
}

export function AttributeFields({ title, helper, selected, onChange, disabled }: Props) {
  return (
    <View>
      <Typography variant="label" style={styles.fieldLabel}>{title}</Typography>
      <Typography variant="bodyMuted" style={styles.helper}>{helper}</Typography>
      {PROFILE_ATTRIBUTE_GROUPS.map((group) => (
        <View key={group.title}>
          <ChoiceChips
            mode="multi"
            options={group.options}
            selected={selected}
            disabled={disabled}
            onToggle={(value) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])}
          />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  fieldLabel: { marginBottom: spacing.sm },
  helper: { fontSize: 12 },
  group: { fontSize: 12, marginTop: spacing.sm },
})
