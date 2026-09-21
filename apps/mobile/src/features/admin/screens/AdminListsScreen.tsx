import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminListDefinitions } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { colors, radius, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminLists'>

export function AdminListsScreen({ navigation }: Props) {
  const lists = useAdminListDefinitions()

  return (
    <ScreenContainer width="wide">
      <TopNavigation
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title="Lists"
        subtitle="List definitions"
        rightElement={
          <Pressable hitSlop={12} onPress={() => navigation.navigate('AdminListDetail', undefined)}>
            <Typography variant="button" style={styles.newLink}>+ New</Typography>
          </Pressable>
        }
      />

      {lists.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}
        </View>
      ) : lists.isError ? (
        <ErrorState subtitle="Couldn't load lists." onRetry={() => lists.refetch()} />
      ) : (lists.data ?? []).length === 0 ? (
        <EmptyState title="No lists defined" subtitle="Create one to get started." />
      ) : (
        <FlatList
          data={lists.data}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('AdminListDetail', { listId: item.id })}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTitle}>
                  <Typography variant="body" style={!item.isActive && styles.archivedText}>{item.shortLabel}</Typography>
                  {!item.isActive ? (
                    <View style={styles.pill}>
                      <Typography variant="label" style={{ color: colors.inkMuted }}>Archived</Typography>
                    </View>
                  ) : null}
                </View>
                <Typography variant="bodyMuted" style={{ marginTop: 2 }}>
                  Scope: {item.entityType.label}{item.parentEntity ? ` (${item.parentEntity.canonicalName})` : ''}
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
