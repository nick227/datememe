import { Pressable, ScrollView, StyleSheet } from 'react-native'
import { Typography } from '../Typography'
import { borderWidth, colors, spacing } from '../../theme'
import type { FilterChip } from './types'

type Props = {
  chips: FilterChip[]
  selectedId: string
  onSelect: (id: string) => void
}

export function FilterChipsRow({ chips, selectedId, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((chip) => {
        const selected = chip.id === selectedId
        return (
          <Pressable key={chip.id} style={[styles.chip, selected && styles.chipSelected]} onPress={() => onSelect(chip.id)}>
            <Typography variant="label" style={selected ? styles.labelSelected : styles.label}>
              {chip.label}
            </Typography>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
  chip: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  label: { color: colors.ink },
  labelSelected: { color: colors.white },
})
