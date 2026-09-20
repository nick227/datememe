import { Image, StyleSheet, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, radius, spacing } from '../../../theme'

type Props = {
  list: any
}

export function PreviewListCard({ list }: Props) {
  // Sort items 1 to 5
  const sortedItems = list.items.slice().sort((a: any, b: any) => a.rank - b.rank)
  const categoryTitle = list.category?.shortLabel ?? 'Favorites'
  
  // Try to find a thumbnail from the first item
  const thumbnail = sortedItems[0]?.entity?.imageUrl

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback]} />
        )}
        <Typography variant="label" numberOfLines={2} style={styles.title}>
          {categoryTitle}
        </Typography>
      </View>

      <View style={styles.itemsList}>
        {sortedItems.slice(0, 5).map((item: any, index: number) => (
          <View key={item.id} style={styles.itemRow}>
            <Typography variant="label" style={styles.itemNumber}>
              {index + 1}
            </Typography>
            <Typography variant="body" numberOfLines={1} style={styles.itemName}>
              {item.entity.canonicalName}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flex: 1, // fill column
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  thumbnailFallback: {
    backgroundColor: colors.primarySoft,
  },
  title: {
    flex: 1,
    color: colors.ink,
  },
  itemsList: {
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemNumber: {
    width: 12, // Fixed width for alignment
    color: colors.inkMuted,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
  },
})
