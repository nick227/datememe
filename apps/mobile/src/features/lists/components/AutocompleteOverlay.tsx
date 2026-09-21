import { FlatList, StyleSheet, View } from 'react-native'
import { colors, radius, spacing } from '../../../theme'
import { FastPickTile } from './FastPickTile'
import { Typography } from '../../../ui/Typography'

type Entity = {
  id: string
  canonicalName: string
  imageUrl?: string | null
  status?: string
}

type Props = {
  query: string
  results: Entity[]
  pickedRanks: Record<string, number>
  onToggle: (id: string, name: string, imageUrl?: string | null) => void
  onSuggestNew: (query: string) => void
  isPendingNew?: boolean
}

export function AutocompleteOverlay({ query, results, pickedRanks, onToggle, onSuggestNew, isPendingNew }: Props) {
  if (query.trim().length === 0) return null

  const hasExactMatch = results.some(
    (r) => r.canonicalName.toLowerCase() === query.trim().toLowerCase()
  )

  return (
    <View style={styles.overlay}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <FastPickTile
              name={item.canonicalName}
              imageUrl={item.imageUrl}
              pickedRank={pickedRanks[item.id] ?? null}
              onToggle={() => onToggle(item.id, item.canonicalName, item.imageUrl)}
            />
          </View>
        )}
        ListFooterComponent={
          query.trim().length > 1 && !hasExactMatch ? (
            <View style={styles.suggestWrapper}>
              <FastPickTile
                name={query.trim()}
                pickedRank={null}
                onToggle={() => onSuggestNew(query.trim())}
                isPending={isPendingNew}
              />
              <Typography variant="label" style={styles.suggestLabel}>
                Suggest new option
              </Typography>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 60, // below search bar
    left: 0,
    right: 0,
    maxHeight: 300,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 100,
    overflow: 'hidden',
  },
  list: {
    padding: spacing.sm,
  },
  itemWrapper: {
    marginBottom: spacing.xs,
  },
  suggestWrapper: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  suggestLabel: {
    position: 'absolute',
    right: 48,
    top: spacing.sm + 16, // align visually
    color: colors.primary,
  },
})
