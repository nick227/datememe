import { FlatList, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminEffectiveMembers } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminEffectiveMembers'>

export function AdminEffectiveMembersScreen({ navigation }: Props) {
  const members = useAdminEffectiveMembers()
  const rows = members.data?.pages.flatMap((p) => p.members) ?? []

  return (
    <ScreenContainer testID="screen.admin-effective-members" width="wide">
      <TopNavigation testID="admin-effective-members.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Effective Members" subtitle="Currently MEMBER, and why" />

      {members.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={64} />)}
        </View>
      ) : members.isError ? (
        <ErrorState testID="admin-effective-members.error" subtitle="Couldn't load members." onRetry={() => members.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => item.user?.id ?? String(i)}
          onEndReached={() => members.hasNextPage && members.fetchNextPage()}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          ListEmptyComponent={<EmptyState testID="admin-effective-members.empty" title="No effective members" />}
          renderItem={({ item }) => (
            <View testID={item.user?.id ? `admin-effective-members.row.${item.user?.id}` : undefined} style={{ paddingVertical: spacing.md }}>
              <Typography variant="body">{item.user?.profile?.displayName ?? item.user?.email}</Typography>
              <Typography variant="bodyMuted">@{item.user?.profile?.username ?? item.user?.email}</Typography>
              <Typography variant="label" style={{ color: colors.inkMuted, marginTop: 2 }}>
                {item.sources.map((s) => `${s.kind.replace(/_/g, ' ')}${s.expiresAt ? ` (until ${new Date(s.expiresAt).toLocaleDateString()})` : ' (lifetime)'}`).join(', ')}
              </Typography>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  )
}
