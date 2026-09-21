import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminSitePickGroups } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminSitePicks'>

export function AdminSitePicksScreen({ navigation }: Props) {
  const groups = useAdminSitePickGroups()

  return (
    <ScreenContainer testID="screen.admin-site-picks" width="wide">
      <TopNavigation testID="admin-site-picks.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title="Site Picks"
        subtitle="Curated opening grids on the Lists feed"
        rightElement={
          <Pressable testID="admin-site-picks.open-admin-site-pick-group-detail" hitSlop={12} onPress={() => navigation.navigate('AdminSitePickGroupDetail', undefined)}>
            <Typography variant="button" style={styles.newLink}>+ New</Typography>
          </Pressable>
        }
      />

      {groups.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}
        </View>
      ) : groups.isError ? (
        <ErrorState testID="admin-site-picks.error" subtitle="Couldn't load Site Picks groups." onRetry={() => groups.refetch()} />
      ) : (groups.data ?? []).length === 0 ? (
        <EmptyState testID="admin-site-picks.empty" title="No Site Picks groups yet" subtitle="Create one — 4 List Definitions each show as a grid on the Lists feed." />
      ) : (
        <FlatList
          data={groups.data}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <Pressable testID={`admin-site-picks.open-admin-site-pick-group-detail.${item.id}`} style={styles.row} onPress={() => navigation.navigate('AdminSitePickGroupDetail', { groupId: item.id })}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTitle}>
                  <Typography variant="body" style={!item.isActive && styles.archivedText}>{item.label}</Typography>
                  {!item.isActive ? (
                    <View style={styles.pill}>
                      <Typography variant="label" style={{ color: colors.inkMuted }}>Archived</Typography>
                    </View>
                  ) : item.items.length !== 4 ? (
                    <View style={styles.pill}>
                      <Typography variant="label" style={{ color: colors.inkMuted }}>{item.items.length} of 4</Typography>
                    </View>
                  ) : null}
                </View>
                <Typography variant="bodyMuted" style={{ marginTop: 2 }}>
                  {item.items.map((i) => i.category.shortLabel).join(', ') || 'No lists curated yet'}
                </Typography>
              </View>
              <Icon name="ChevronRight" size={18} color={colors.inkMuted} />
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  newLink: { color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  archivedText: {
    textDecorationLine: 'line-through',
    color: colors.inkMuted,
  },
  pill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  separator: { height: 1, backgroundColor: colors.border },
})
