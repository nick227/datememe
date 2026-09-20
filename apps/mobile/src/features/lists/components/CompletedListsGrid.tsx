import { Pressable, StyleSheet, View } from 'react-native'
import { PreviewListCard } from './PreviewListCard'
import { Typography } from '../../../ui/Typography'
import { spacing } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'

type Props = {
  lists: any[]
  onPressList: (list: any) => void
}

// The "dense favorites strip/grid" — reuses PreviewListCard (already renders a
// thumbnail + ranked items) rather than rebuilding it, just in a responsive grid.
export function CompletedListsGrid({ lists, onPressList }: Props) {
  const columns = useIsDesktop() ? 4 : 2
  const widthPercent = `${100 / columns}%` as const

  return (
    <View style={styles.section}>
      <Typography variant="heading" style={styles.heading}>
        Your lists
      </Typography>
      <View style={styles.grid}>
        {lists.map((list) => (
          <View key={list.id} style={[styles.cell, { width: widthPercent }]}>
            <Pressable onPress={() => onPressList(list)}>
              <PreviewListCard list={list} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  heading: { marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  cell: { paddingHorizontal: spacing.xs, marginBottom: spacing.sm },
})
