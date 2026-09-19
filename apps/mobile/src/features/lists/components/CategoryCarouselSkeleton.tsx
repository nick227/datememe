import { ScrollView, StyleSheet, View } from 'react-native'
import { Skeleton } from '../../../ui/Skeleton'
import { spacing } from '../../../theme'

export function CategoryCarouselSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton variant="text" width={140} height={18} style={styles.title} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rect" width={140} height={140} style={styles.card} />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    marginRight: spacing.sm,
  },
})
