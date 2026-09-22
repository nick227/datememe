import { useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { Icon } from '../Icon'
import { borderWidth, colors, spacing } from '../../theme'
import type { ContentUnit, StructureState } from './types'

type Props = {
  testID?: string
  title?: string | null
  items: ContentUnit[]
  state: StructureState
  // "list"/"favorite" — pluralized for the collapsed count line ("3 lists").
  itemNoun: string
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

/**
 * "Your lists" / "Your favorites" is a running personal history, not new
 * content to browse — it doesn't earn the same full-size horizontal cards
 * every other Rail gets. Collapsed by default to a one-line summary;
 * expanding swaps in compact vertical rows (tiny thumb + name) instead of
 * another row of large cards.
 */
export function PersonalHistorySummary({ testID, title, items, state, itemNoun, onPressItem, onRetry }: Props) {
  const [expanded, setExpanded] = useState(false)
  const count = items.length
  const countLabel = `${count} ${count === 1 ? itemNoun : `${itemNoun}s`}`

  return (
    <View testID={testID} style={styles.section}>
      <Pressable
        testID={testID ? `${testID}.toggle` : undefined}
        style={styles.summaryRow}
        onPress={() => setExpanded((e) => !e)}
        disabled={state !== 'ready' || count === 0}
      >
        {title ? (
          <Typography variant="heading" style={styles.title} numberOfLines={1}>
            {title}
          </Typography>
        ) : null}
        {state === 'ready' && count > 0 ? (
          <View style={styles.summaryRight}>
            <Typography variant="label" style={styles.count}>
              {countLabel}
            </Typography>
            <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={20} />
          </View>
        ) : null}
      </Pressable>

      {state === 'loading' ? (
        <Skeleton variant="text" width={160} height={16} style={styles.loadingLine} />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : count === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : !expanded ? null : (
        <View testID={testID ? `${testID}.rows` : undefined} style={styles.rows}>
          {items.map((unit) => (
            <HistoryRow key={unit.id} testID={testID ? `${testID}.item.${unit.id}` : undefined} unit={unit} onPress={() => onPressItem(unit)} />
          ))}
        </View>
      )}
    </View>
  )
}

function HistoryRow({ testID, unit, onPress }: { testID?: string; unit: ContentUnit; onPress: () => void }) {
  const previewEntities = unit.previewEntities ?? []
  const thumbnail = unit.imageUrl ?? previewEntities[0]?.imageUrl
  const isComplete = !!unit.relationship?.completed
  const matchMetric = unit.metrics?.find((m) => m.type === 'overlap')
  const trailing =
    unit.kind === 'category'
      ? isComplete
        ? 'Done'
        : previewEntities.length
          ? 'In progress'
          : null
      : matchMetric
        ? `${matchMetric.value} match`
        : (unit.age ?? unit.subtitle ?? null)

  return (
    <Pressable testID={testID} style={rowStyles.row} onPress={onPress}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={rowStyles.thumb} />
      ) : (
        <View style={[rowStyles.thumb, rowStyles.thumbFallback]}>
          <Typography variant="label" style={rowStyles.thumbInitial}>
            {(unit.title || '?').charAt(0).toUpperCase()}
          </Typography>
        </View>
      )}
      <Typography variant="body" numberOfLines={1} style={rowStyles.title}>
        {unit.title}
      </Typography>
      {trailing ? (
        <Typography variant="label" numberOfLines={1} style={rowStyles.trailing}>
          {trailing}
        </Typography>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.section, paddingHorizontal: spacing.lg },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1 },
  summaryRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  count: { color: colors.inkMuted },
  loadingLine: { marginTop: spacing.sm },
  rows: { marginTop: spacing.md, borderTopWidth: borderWidth.thin, borderTopColor: colors.border },
})

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  thumb: { width: 36, height: 36, backgroundColor: colors.surfaceMuted },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  thumbInitial: { color: colors.inkMuted },
  title: { flex: 1 },
  trailing: { color: colors.inkMuted },
})
