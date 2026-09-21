import { Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminQueueMetrics } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>

const STAT_LABELS: Record<string, string> = {
  PENDING: 'Pending jobs',
  RUNNING: 'Running jobs',
  FAILED: 'Failed jobs',
}

export function AdminDashboardScreen({ navigation }: Props) {
  const queue = useAdminQueueMetrics()

  return (
    <ScreenContainer testID="screen.admin-dashboard" width="wide">
      <TopNavigation testID="admin-dashboard.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Admin" subtitle="Job queue health" />

      <Pressable testID="admin-dashboard.open-admin-moderation" style={styles.card} onPress={() => navigation.navigate('AdminModeration')}>
        <View style={styles.row}>
          <Typography variant="heading">Moderation</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      <Pressable testID="admin-dashboard.open-admin-users" style={styles.card} onPress={() => navigation.navigate('AdminUsers')}>
        <View style={styles.row}>
          <Typography variant="heading">Users</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      <Pressable testID="admin-dashboard.open-admin-memberships" style={styles.card} onPress={() => navigation.navigate('AdminMemberships')}>
        <View style={styles.row}>
          <Typography variant="heading">Memberships</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      <Pressable testID="admin-dashboard.open-admin-taxonomy" style={styles.card} onPress={() => navigation.navigate('AdminTaxonomy')}>
        <View style={styles.row}>
          <Typography variant="heading">Taxonomy</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      <Pressable testID="admin-dashboard.open-admin-lists" style={styles.card} onPress={() => navigation.navigate('AdminLists')}>
        <View style={styles.row}>
          <Typography variant="heading">Lists</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      <Pressable testID="admin-dashboard.open-admin-site-picks" style={styles.card} onPress={() => navigation.navigate('AdminSitePicks')}>
        <View style={styles.row}>
          <Typography variant="heading">Site Picks</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      <Pressable testID="admin-dashboard.open-admin-membership" style={styles.card} onPress={() => navigation.navigate('AdminMembership')}>
        <View style={styles.row}>
          <Typography variant="heading">Membership</Typography>
          <Icon name="ChevronRight" size={20} color={colors.inkMuted} />
        </View>
      </Pressable>

      {queue.isLoading ? (
        <View style={styles.statsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, styles.statCard]}>
              <Skeleton variant="text" width={80} height={14} />
              <Skeleton variant="text" width={40} height={28} style={{ marginTop: spacing.sm }} />
            </View>
          ))}
        </View>
      ) : queue.isError ? (
        <ErrorState testID="admin-dashboard.error" subtitle="Couldn't load queue metrics." onRetry={() => queue.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            {(['PENDING', 'RUNNING', 'FAILED'] as const).map((status) => (
              <View key={status} style={[styles.card, styles.statCard]}>
                <Typography variant="label" style={{ color: colors.inkMuted }}>{STAT_LABELS[status]}</Typography>
                <Typography variant="display" style={{ marginTop: spacing.sm }}>{queue.data!.metrics[status] ?? 0}</Typography>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Typography variant="heading" style={{ marginBottom: spacing.md }}>Oldest pending</Typography>
            {queue.data!.oldestPending.length === 0 ? (
              <Typography variant="bodyMuted">Nothing waiting.</Typography>
            ) : (
              queue.data!.oldestPending.map((job) => (
                <View testID={`admin-dashboard.job.${job.id}`} key={job.id} style={styles.jobRow}>
                  <Typography variant="body">{job.type}</Typography>
                  <Typography variant="bodyMuted">{new Date(job.availableAt).toLocaleString()}</Typography>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Typography variant="heading" style={{ marginBottom: spacing.md }}>Recent failures</Typography>
            {queue.data!.latestFailed.length === 0 ? (
              <Typography variant="bodyMuted">No failures.</Typography>
            ) : (
              queue.data!.latestFailed.map((job) => (
                <View testID={`admin-dashboard.job.${job.id}`} key={job.id} style={styles.jobRow}>
                  <Typography variant="body">{job.type}</Typography>
                  <Typography variant="bodyMuted" numberOfLines={1} style={{ color: colors.danger }}>
                    {job.lastError ?? 'Unknown error'}
                  </Typography>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: { flex: 1 },
  jobRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
})
