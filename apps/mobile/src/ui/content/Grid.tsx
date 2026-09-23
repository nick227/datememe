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
  testID?: string
  title?: string | null
  items: ContentUnit[]
  state: StructureState
  gridShape?: GridShape
  columns?: number
  zone?: string
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

// Column count is driven by the caller (FeedModuleRenderer passes columns={4}
// for Results, columns from server hints for Explore). Grid just applies the
// number responsively — desktop uses the prop, mobile caps at 2.
export function Grid({ testID, title, items, state, gridShape = 'square', columns = 3, zone, onPressItem, onRetry }: Props) {
  const isDesktop = useIsDesktop()
  const resolvedColumns = isDesktop ? columns : Math.min(columns, 2)
  const widthPercent = `${100 / resolvedColumns}%` as const
  const variant = gridShape === 'dense' ? 'grid-dense' : 'grid-square'

  return (
    <View testID={testID} style={styles.section}>
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
              <ContentUnitCard unit={unit} variant={variant} zone={zone} onPress={() => onPressItem(unit)} />
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
          <Skeleton variant="rect" width="100%" height={260} />
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
