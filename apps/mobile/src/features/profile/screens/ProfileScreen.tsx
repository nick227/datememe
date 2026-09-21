import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCurrentUser, useMyLists } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { ProfileGalleryHero } from '../../../ui/ProfileGalleryHero'
import { Button } from '../../../ui/Button'
import { EmptyState } from '../../../ui/EmptyState'
import { PreviewListCard } from '../../lists/components/PreviewListCard'
import { PreviewListCardSkeleton } from '../../lists/components/PreviewListCardSkeleton'
import { Skeleton } from '../../../ui/Skeleton'
import { Icon } from '../../../ui/Icon'
import { borderWidth, colors, spacing } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>

export function ProfileScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const lists = useMyLists()

  const profile = me.data?.profile
  const isPremium = !!me.data?.membership && me.data.membership.state !== 'FREE'
  const numColumns = useIsDesktop() ? 3 : 2
  const photos = profile ? Array.from(new Set([profile.avatarUrl, ...(profile.photos ?? [])].filter((u): u is string => !!u))) : []

  return (
    <ScreenContainer testID="screen.profile" padded={false} width="wide">
      <TopNavigation testID="profile.header"
        leftAction="close"
        onLeftAction={() => navigation.goBack()}
        rightElement={
          <Pressable testID="profile.open-account" onPress={() => navigation.navigate('Account')} hitSlop={12} style={{ padding: spacing.xs }}>
            <Icon name="Settings" />
          </Pressable>
        }
      />

      <FlatList
        key={numColumns}
        data={(lists.isLoading ? [1, 2] : (lists.data ?? []).filter((l) => l.isComplete)) as any[]}
        keyExtractor={(item) => (typeof item === 'number' ? String(item) : item.id)}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {me.isLoading ? (
              <Skeleton variant="rect" width="100%" height={320} />
            ) : (
              <ProfileGalleryHero
                testID="profile.gallery"
                photos={photos}
                placeholderInitial={(profile?.displayName || '?').charAt(0)}
              >
                <View style={styles.heroNameRow}>
                  <Typography variant="title" style={styles.heroName}>{profile?.displayName}</Typography>
                  {isPremium ? (
                    <View style={styles.premiumBadge}>
                      <Typography variant="label" style={styles.premiumBadgeText}>Premium</Typography>
                    </View>
                  ) : null}
                </View>
                <Typography variant="bodyMuted" style={styles.heroUsername}>@{profile?.username}</Typography>
              </ProfileGalleryHero>
            )}

            <View style={styles.body}>
              {profile?.bio ? <Typography variant="body" style={styles.bio}>{profile.bio}</Typography> : null}
              <Button testID="profile.edit-profile" label="Edit profile" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
              <Typography variant="label" style={styles.sectionLabel}>Your lists</Typography>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState testID="profile.empty" title="No completed lists yet" subtitle="Head to the Favorites tab to start." />}
        renderItem={({ item }) => (typeof item === 'number' ? <PreviewListCardSkeleton /> : <PreviewListCard list={item} />)}
      />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroName: { color: colors.white },
  heroUsername: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  premiumBadge: { backgroundColor: colors.accent, borderWidth: borderWidth.thin, borderColor: colors.white, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  premiumBadgeText: { color: colors.white },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  bio: { marginBottom: spacing.xs },
  sectionLabel: { marginTop: spacing.sm, marginBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
})
