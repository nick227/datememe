import { FlatList, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useAdminMembershipGrants, useAdminRevokeMembershipGrant } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Typography } from '../../../ui/Typography'
import { Button } from '../../../ui/Button'
import { colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminGrants'>

export function AdminGrantsScreen({ navigation }: Props) {
  const grants = useAdminMembershipGrants()
  const revokeGrant = useAdminRevokeMembershipGrant()
  const sheet = useActionSheet()
  const rows = grants.data?.pages.flatMap((p) => p.grants) ?? []

  function handleRevoke(id: string) {
    sheet.show({
      title: 'Revoke this grant?',
      buttons: [
        { testID: 'admin-grants.dialog.cancel', text: 'Cancel', style: 'cancel' },
        {
          testID: 'admin-grants.dialog.revoke', text: 'Revoke',
          style: 'destructive',
          onPress: () =>
            revokeGrant.mutate(
              { id },
              { onError: (err) => sheet.show({ title: 'Could not revoke', message: err instanceof ApiError ? err.message : 'Try again.', buttons: [{ testID: 'admin-grants.dialog.ok', text: 'OK' }] }) },
            ),
        },
      ],
    })
  }

  return (
    <ScreenContainer testID="screen.admin-grants" width="wide">
      <TopNavigation testID="admin-grants.header" alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Grants" subtitle="Every membership grant issued" />

      {grants.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}
        </View>
      ) : grants.isError ? (
        <ErrorState testID="admin-grants.error" subtitle="Couldn't load grants." onRetry={() => grants.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          onEndReached={() => grants.hasNextPage && grants.fetchNextPage()}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          ListEmptyComponent={<EmptyState testID="admin-grants.empty" title="No grants yet" />}
          renderItem={({ item }) => {
            const active = !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt).getTime() > new Date().getTime())
            return (
              <View testID={`admin-grants.row.${item.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body">{item.user.profile?.displayName ?? item.user.email}</Typography>
                  <Typography variant="bodyMuted">
                    {item.source.replace(/_/g, ' ')} · {item.expiresAt ? `until ${new Date(item.expiresAt).toLocaleDateString()}` : 'lifetime'}
                  </Typography>
                  {item.reason ? <Typography variant="label" style={{ color: colors.inkMuted, marginTop: 2 }} numberOfLines={1}>{item.reason}</Typography> : null}
                </View>
                {active ? (
                  <Button testID={`admin-grants.revoke.${item.id}`} label="Revoke" variant="danger" onPress={() => handleRevoke(item.id)} />
                ) : (
                  <Typography variant="label" style={{ color: item.revokedAt ? colors.danger : colors.inkMuted }}>
                    {item.revokedAt ? 'Revoked' : 'Expired'}
                  </Typography>
                )}
              </View>
            )
          }}
        />
      )}
      <ActionSheet testID="admin-grants.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}
