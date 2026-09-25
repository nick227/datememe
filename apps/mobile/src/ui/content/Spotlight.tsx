import { StyleSheet, View } from 'react-native'
import { Box, spacing } from '../../theme'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
import { CardSkeleton } from './CardSkeleton'
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

export function Spotlight({ testID, title, items, state, zone, onPressItem, onRetry }: Props) {
  if (state === 'ready' && items.length === 0) return null

  return (
    <Box testID={testID} paddingHorizontal="lg" marginVertical="section">
      {title ? (
        <Box marginBottom="md">
          <Typography variant="heading">{title}</Typography>
        </Box>
      ) : null}

      {state === 'loading' ? (
        <CardSkeleton />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : (
        <ContentUnitCard unit={items[0]!} variant="spotlight" zone={zone} onPress={() => onPressItem(items[0]!)} />
      )}
    </Box>
  )
}
