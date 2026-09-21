import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
import { spacing } from '../../theme'
import { useIsDesktop } from '../../lib/useResponsive'
import type { ContentUnit, GridShape, StructureState } from './types'

type Props = {
  title?: string | null
  items: ContentUnit[]
  state: StructureState
  gridShape?: GridShape
  columns?: number
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

// Default is deliberately the same on both Lists and Discover — "large,
// few-per-row" cards with room for real content, not a dense inventory.
// `columns` (from ContentCollection.options, a backend hint) overrides it;
// `gridShape='dense'` is the one explicit opt-in for a tighter grid.
export function Grid({ title, items, state, gridShape = 'square', columns, onPressItem, onRetry }: Props) {
  const isDesktop = useIsDesktop()
  const desktopColumns = columns ?? (gridShape === 'dense' ? 4 : 2)
  const mobileColumns = gridShape === 'dense' ? 2 : 1
  const resolvedColumns = isDesktop ? desktopColumns : mobileColumns
  const widthPercent = `${100 / resolvedColumns}%` as const
  const variant = gridShape === 'dense' ? 'grid-dense' : 'grid-square'

  return (
    <View style={styles.section}>
      {title ? (
        <Typography variant="heading" style={styles.heading}>
          {title}
        </Typography>
      ) : null}

      {state === 'loading' ? (
        <GridSkeleton columns={resolvedColumns} widthPercent={widthPercent} />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <View style={styles.grid}>
          {items.map((unit) => (
            <View key={unit.id} style={[styles.cell, { width: widthPercent }]}>
              <ContentUnitCard unit={unit} variant={variant} onPress={() => onPressItem(unit)} />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function GridSkeleton({ columns, widthPercent }: { columns: number; widthPercent: `${number}%` }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: columns * 2 }).map((_, i) => (
        <View key={i} style={[styles.cell, { width: widthPercent }]}>
          <Skeleton variant="rect" width="100%" height={120} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  heading: { marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
})
