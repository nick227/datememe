import { useState } from 'react'
import { Text, ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useProfile, useProfileLists, useSwipe } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { EmptyState } from '../../../ui/EmptyState'
import { MatchPercentageBadge } from '../components/MatchPercentageBadge'
import { MatchDimensionsBreakdown } from '../components/MatchDimensionsBreakdown'
import { SwipeActions } from '../components/SwipeActions'
import { PreviewListCard } from '../../lists/components/PreviewListCard'
import { PreviewListCardSkeleton } from '../../lists/components/PreviewListCardSkeleton'
import { colors, radius, spacing, type } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import type { DiscoveryStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<DiscoveryStackParamList, 'ProfileDetail'>

export function ProfileDetailScreen({ route, navigation }: Props) {
  const { profileId, displayName, matchPercentage, insights } = route.params
  const profile = useProfile(profileId)
  const lists = useProfileLists(profileId)
  const swipe = useSwipe()
  const [decided, setDecided] = useState(false)
  const numColumns = useIsDesktop() ? 3 : 2

  const avatarUrl = profile.data?.avatarUrl

  async function handleSwipe(action: 'LIKE' | 'PASS') {
    setDecided(true)
    try {
      const result = await swipe.mutateAsync({ targetProfileId: profileId, action })
      if (result.matched) {
        Alert.alert('It’s a match! 🎉', `You and ${displayName} liked each other.`, [
          { text: 'Keep browsing', style: 'cancel', onPress: () => navigation.goBack() },
          {
            text: 'Say hi',
            onPress: () =>
              (navigation.getParent()?.navigate as any)('Messages', {
                screen: 'Conversation',
                params: { conversationId: result.conversation!.id, displayName },
              }),
          },
        ])
      } else {
        navigation.goBack()
      }
    } catch {
      navigation.goBack()
    }
  }

  return (
    <ScreenContainer padded={false} width="wide">
      <TopNavigation
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
      />

      <FlatList
        key={numColumns}
        data={(lists.isLoading ? [1, 2, 3, 4] : (lists.data ?? [])) as any[]}
        keyExtractor={(item) => (typeof item === 'number' ? String(item) : item.id)}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoLocked]}>
                <Text style={styles.photoLockedText}>{(displayName || '?').charAt(0).toUpperCase()}</Text>
                <Typography variant="bodyMuted">Go premium to see their photos</Typography>
              </View>
            )}

            <View style={styles.infoRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="title">{displayName}</Typography>
              </View>
              {matchPercentage != null ? <MatchPercentageBadge percentage={matchPercentage} /> : null}
            </View>

            {insights?.length ? (
              <MatchDimensionsBreakdown insights={insights} />
            ) : null}

            <Typography variant="label" style={styles.sectionLabel}>FAVORITE LISTS</Typography>
          </View>
        }
        ListEmptyComponent={<EmptyState title="No public lists yet" />}
        renderItem={({ item }) => (typeof item === 'number' ? <PreviewListCardSkeleton /> : <PreviewListCard list={item} />)}
      />

      <SwipeActions onPass={() => handleSwipe('PASS')} onLike={() => handleSwipe('LIKE')} disabled={decided} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  photoScroll: { width: '100%' },
  photo: { width: '100%', aspectRatio: 1.3, borderRadius: radius.lg },
  photoLocked: {
    width: '100%',
    aspectRatio: 1.3,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoLockedText: { ...type.title, fontSize: 40, color: colors.primary },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  sectionLabel: { marginBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
})
