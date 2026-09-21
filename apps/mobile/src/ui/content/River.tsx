import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
import { spacing } from '../../theme'
import type { ContentUnit, StructureState } from './types'

type Props = {
  testID?: string
  title?: string | null
  items: ContentUnit[]
  state: StructureState
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

export function River({ testID, title, items, state, onPressItem, onRetry }: Props) {
  return (
    <View testID={testID} style={styles.section}>
      {title ? (
        <Typography variant="heading" style={styles.heading}>
          {title}
        </Typography>
      ) : null}

      {state === 'loading' ? (
        <RiverSkeleton />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <View>
          {items.map((unit) => (
            <ContentUnitCard key={unit.id} unit={unit} variant="river" onPress={() => onPressItem(unit)} />
          ))}
        </View>
      )}
    </View>
  )
}

function RiverSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rect" width="100%" height={64} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  heading: { marginBottom: spacing.md },
})
