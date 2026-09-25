import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Box, spacing } from '../../theme'
import { Typography } from '../Typography'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ContentUnitCard } from './ContentUnitCard'
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

export function River({ testID, title, items, state, zone, onPressItem, onRetry }: Props) {
  return (
    <Box testID={testID} paddingHorizontal="lg" marginBottom="xl">
      {title ? (
        <Box marginBottom="md">
          <Typography variant="heading">{title}</Typography>
        </Box>
      ) : null}

      {state === 'loading' ? (
        <RiverSkeleton />
      ) : state === 'error' ? (
        <ErrorState subtitle="Couldn't load this." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <View>
          {items.map((unit, index) => (
            <Animated.View key={unit.id} entering={FadeInDown.duration(400).delay(index * 50)}>
              <ContentUnitCard unit={unit} variant="river" zone={zone} onPress={() => onPressItem(unit)} />
            </Animated.View>
          ))}
        </View>
      )}
    </Box>
  )
}

function RiverSkeleton() {
  return (
    <Box gap="md">
      {[1, 2, 3].map((i) => (
        <Box key={i} flexDirection="row" alignItems="center" gap="md" paddingVertical="md" borderTopWidth={1} borderColor="border">
          <Skeleton variant="circular" width={56} height={56} />
          <Box flex={1}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" style={{ marginTop: 4 }} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

const styles = StyleSheet.create({})
