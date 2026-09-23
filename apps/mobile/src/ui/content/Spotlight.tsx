import { StyleSheet, View } from 'react-native'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
import { spacing } from '../../theme'
import type { ContentUnit, StructureState } from './types'

type Props = {
  testID?: string
  title?: string | null
  items: ContentUnit[]
  state: StructureState
  zone?: string
  onPressItem: (unit: ContentUnit) => void
  onRetry?: () => void
}

// A heavy, conditional interruption — per the "optional and sparse" invariant
// (proposal §1/§7), an empty Spotlight is *omitted*, not shown as an empty
// box. It must also be dramatically larger than surrounding Grid/Rail cards,
// not "a Grid with one item" — the enforced minHeight is what makes that true
// regardless of how little/much content the one featured unit carries.
export function Spotlight({ testID, title, items, state, zone, onPressItem, onRetry }: Props) {
  if (state === 'ready' && items.length === 0) return null

  return (
    <View testID={testID} style={styles.section}>
      {title ? (
        <Typography variant="heading" style={styles.heading}>
          {title}
        </Typography>
      ) : null}

      {state === 'loading' ? (
        <Skeleton variant="rect" width="100%" height={460} />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : (
        <View style={styles.frame}>
          <ContentUnitCard unit={items[0]!} variant="spotlight" zone={zone} onPress={() => onPressItem(items[0]!)} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginVertical: spacing.section },
  heading: { marginBottom: spacing.md },
  frame: { minHeight: 460 },
})
