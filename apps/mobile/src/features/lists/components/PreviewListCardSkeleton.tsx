import { StyleSheet, View } from 'react-native'
import { Skeleton } from '../../../ui/Skeleton'
import { colors, radius, spacing } from '../../../theme'

export function PreviewListCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Skeleton variant="text" width={100} height={16} style={{ marginBottom: spacing.sm }} />
        <Skeleton variant="text" width={80} height={14} />
      </View>
      <Skeleton style={styles.photo} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 0.8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.md,
  },
  photo: {
    flex: 1,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
})
