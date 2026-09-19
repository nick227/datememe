import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCurrentUser, useMyLists } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Button } from '../../../ui/Button'
import { EmptyState } from '../../../ui/EmptyState'
import { PreviewListCard } from '../../lists/components/PreviewListCard'
import { PreviewListCardSkeleton } from '../../lists/components/PreviewListCardSkeleton'
import { Skeleton } from '../../../ui/Skeleton'
import { Icon } from '../../../ui/Icon'
import { colors, radius, spacing, type } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>

export function ProfileScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const lists = useMyLists()

  const profile = me.data?.profile
  const numColumns = useIsDesktop() ? 3 : 2

  return (
    <ScreenContainer padded={false} width="wide">
      <TopNavigation
        leftAction="close"
        onLeftAction={() => navigation.goBack()}
        rightElement={
          <Pressable onPress={() => navigation.navigate('Account')} hitSlop={12} style={{ padding: spacing.xs }}>
            <Icon name="Settings" />
          </Pressable>
        }
      />
      <View style={styles.header}>
        {me.isLoading ? (
          <Skeleton variant="circular" width={88} height={88} style={styles.avatar} />
        ) : profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{(profile?.displayName || '?').charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {me.isLoading ? (
          <>
            <Skeleton variant="text" width={140} height={26} style={{ marginTop: spacing.xs, marginBottom: spacing.sm }} />
            <Skeleton variant="text" width={100} height={18} />
          </>
        ) : (
          <>
            <Typography variant="title">{profile?.displayName}</Typography>
            <Typography variant="bodyMuted">@{profile?.username}</Typography>
          </>
        )}

        <View style={{ marginTop: spacing.lg, alignSelf: 'stretch', paddingHorizontal: spacing.lg }}>
          <Button label="Edit profile" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
        </View>
      </View>

      <FlatList
        key={numColumns}
        data={(lists.isLoading ? [1, 2] : (lists.data ?? []).filter((l) => l.isComplete)) as any[]}
        keyExtractor={(item) => (typeof item === 'number' ? String(item) : item.id)}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Typography variant="label" style={styles.sectionLabel}>YOUR LISTS</Typography>}
        ListEmptyComponent={<EmptyState title="No completed lists yet" subtitle="Head to the Favorites tab to start." />}
        renderItem={({ item }) => (typeof item === 'number' ? <PreviewListCardSkeleton /> : <PreviewListCard list={item} />)}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  avatar: { width: 88, height: 88, borderRadius: radius.pill, marginBottom: spacing.sm },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { ...type.title, fontSize: 30, color: colors.primary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: { marginBottom: spacing.sm },
})
