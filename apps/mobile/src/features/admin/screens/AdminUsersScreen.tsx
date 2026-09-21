import { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminUsers } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminUsers'>

export function AdminUsersScreen({ navigation }: Props) {
  const [search, setSearch] = useState('')
  const users = useAdminUsers({ search: search.trim() || undefined })
  const rows = users.data?.pages.flatMap((p) => p.users) ?? []

  return (
    <ScreenContainer width="wide">
      <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Users" />

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search by email, username, or ID"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {users.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} />)}
        </View>
      ) : users.isError ? (
        <ErrorState subtitle="Couldn't load users." onRetry={() => users.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onEndReached={() => users.hasNextPage && users.fetchNextPage()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState title="No users found" />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate('AdminUserDetail', { userId: item.id })}>
              <View style={{ flex: 1 }}>
                <Typography variant="body">{item.profile?.displayName ?? item.email}</Typography>
                <Typography variant="bodyMuted" style={{ marginTop: 2 }}>
                  {item.profile ? `@${item.profile.username} · ` : ''}{item.email}
                </Typography>
              </View>
              <Typography variant="label" style={{ color: colors.inkMuted }}>{item.role}</Typography>
              {item.suspendedAt ? (
                <View style={styles.pill}><Typography variant="label" style={{ color: colors.danger }}>Suspended</Typography></View>
              ) : null}
              <Icon name="ChevronRight" size={18} color={colors.inkMuted} />
            </Pressable>
          )}
        />
      )}
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  separator: { height: 1, backgroundColor: colors.border },
  pill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
})
