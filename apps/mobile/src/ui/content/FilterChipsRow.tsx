import { Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { borderWidth, colors, spacing } from '../../theme'
import type { FilterChip } from './types'

type Props = {
  chips: FilterChip[]
  // Multi-select: any number of chips can be highlighted at once (a
  // category filter is OR'd server-side across all of them — see
  // DiscoverFeedFilters/ListsFeedFilters' groupSlugs). onSelect reports the
  // tapped chip's id; the caller owns the toggle/exclusivity logic (e.g.
  // "All" clearing everything else).
  selectedIds: string[]
  onSelect: (id: string) => void
}

// Wraps onto multiple lines rather than horizontal-scrolling — with 15+
// groups plus Discover's demographic chips, a single scrolling row hid most
// of the options off-screen with no visual cue more existed (reported live
// as chips "overflowing").
export function FilterChipsRow({ chips, selectedIds, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const selected = selectedIds.includes(chip.id)
        return (
          <Pressable testID={`feed.filter.${chip.id}`} key={chip.id} style={[styles.chip, selected && styles.chipSelected]} onPress={() => onSelect(chip.id)}>
            <Typography variant="label" style={selected ? styles.labelSelected : styles.label}>
              {chip.label}
            </Typography>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg },
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
