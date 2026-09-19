import { StyleSheet, View } from 'react-native'
import { Skeleton } from '../../../ui/Skeleton'
import { colors, radius, spacing } from '../../../theme'

export function MatchFeedCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={styles.photo} />
      <View style={styles.content}>
        <View style={styles.infoRow}>
          <Skeleton variant="text" width={160} height={24} />
          <Skeleton variant="circular" width={48} height={48} style={{ marginLeft: 'auto' }} />
        </View>
        <Skeleton variant="rect" height={60} style={{ borderRadius: radius.md, marginTop: spacing.sm }} />
      </View>
      <View style={styles.actions}>
        <View style={styles.tuningActions}>
          <Skeleton variant="text" width={80} />
          <Skeleton variant="text" width={80} />
        </View>
        <View style={styles.decisionActions}>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="circular" width={48} height={48} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  content: {
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  tuningActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  decisionActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
})
