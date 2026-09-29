import { Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: readonly Option<T>[]
  selected: readonly string[]
  onToggle: (value: T) => void
  disabled?: boolean
  mode: 'single' | 'multi'
}

export function ChoiceChips<T extends string>({ options, selected, onToggle, disabled, mode }: Props<T>) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const on = selected.includes(option.value)
        return (
          <Pressable
            key={option.value}
            accessibilityRole={mode === 'single' ? 'button' : 'checkbox'}
            accessibilityState={mode === 'single' ? { selected: on } : { checked: on }}
            disabled={disabled}
            onPress={() => onToggle(option.value)}
            style={[styles.chip, on && styles.selected]}
          >
            <Typography style={[styles.chipText, on && styles.selectedText]}>{option.label}</Typography>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  chip: { minHeight: 44, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontSize: 13 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedText: { color: colors.white, fontSize: 13 },
})
