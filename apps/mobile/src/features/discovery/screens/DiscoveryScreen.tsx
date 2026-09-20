import { useState, useEffect } from 'react'
import { Alert, StyleSheet, View, Text, Dimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useDiscoveryFeed, useSwipe } from '@project/sdk'
import Animated, { 
  FadeIn, FadeOut, ZoomIn, ZoomOut, 
  useSharedValue, useAnimatedStyle, withSpring, 
  interpolate, Extrapolation, runOnJS
} from 'react-native-reanimated'
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { EmptyState } from '../../../ui/EmptyState'
import { MatchFeedCard } from '../components/MatchFeedCard'
import { MatchFeedCardSkeleton } from '../components/MatchFeedCardSkeleton'
import { Button } from '../../../ui/Button'
import { colors, radius, spacing } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import { hapticSuccess, hapticMedium, hapticHeavy } from '../../../lib/haptics'
import type { DiscoveryStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3

type Props = NativeStackScreenProps<DiscoveryStackParamList, 'Discovery'>

export function DiscoveryScreen({ navigation }: Props) {
  const feed = useDiscoveryFeed()
  const swipe = useSwipe()
  const isDesktop = useIsDesktop()
  const candidates = feed.data?.pages.flatMap((p) => p.data) ?? []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [matchData, setMatchData] = useState<{ displayName: string; conversationId: string } | null>(null)

  // Re-fetch when we get close to the end
  useEffect(() => {
    if (candidates.length > 0 && currentIndex >= candidates.length - 3) {
      if (feed.hasNextPage && !feed.isFetchingNextPage) {
        feed.fetchNextPage()
      }
    }
  }, [currentIndex, candidates.length, feed])

  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  function onCardAction(targetProfileId: string, displayName: string, action: 'LIKE' | 'PASS' | 'MORE_LIKE_THIS' | 'LESS_LIKE_THIS') {
    if (action === 'MORE_LIKE_THIS' || action === 'LESS_LIKE_THIS') {
      Alert.alert('Training received', 'The algorithm will adjust your future matches.')
      return
    }

    // Programmatic swipe out
    translateX.value = withSpring(action === 'LIKE' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, { velocity: 1000 })
    setTimeout(() => {
      handleFinalAction(targetProfileId, displayName, action)
    }, 200) // Wait for animation
  }

  async function handleFinalAction(targetProfileId: string, displayName: string, action: 'LIKE' | 'PASS') {
    setCurrentIndex(prev => prev + 1)
    translateX.value = 0
    translateY.value = 0
    try {
      const result = await swipe.mutateAsync({ targetProfileId, action })
      if (result.matched) {
        hapticSuccess()
        setMatchData({ displayName, conversationId: result.conversation!.id })
      }
    } catch {
      // swipe failures are non-fatal
    }
  }

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX
      translateY.value = event.translationY
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        // Liked
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: event.velocityX })
        runOnJS(hapticHeavy)()
        runOnJS(handleFinalAction)(candidates[currentIndex].profile.id, candidates[currentIndex].profile.displayName, 'LIKE')
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        // Passed
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: event.velocityX })
        runOnJS(hapticMedium)()
        runOnJS(handleFinalAction)(candidates[currentIndex].profile.id, candidates[currentIndex].profile.displayName, 'PASS')
      } else {
        // Snap back
        translateX.value = withSpring(0)
        translateY.value = withSpring(0)
      }
    })

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-10, 0, 10],
      Extrapolation.CLAMP
    )
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    }
  })

  // Render top 3 cards, reverse order so [0] is on top (rendered last)
  const visibleCards = candidates.slice(currentIndex, currentIndex + 3).reverse()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenContainer padded={false}>
        <View style={styles.headerWrapper}>
          <TopNavigation
            title="Discover"
            subtitle="Browse is unlimited, on every plan"
            alignment="left"
          />
        </View>

        <View style={[styles.deckContainer, isDesktop && styles.deckContainerDesktop]}>
          {feed.isLoading ? (
            <MatchFeedCardSkeleton />
          ) : visibleCards.length === 0 ? (
            <EmptyState title="No one new to show" subtitle="Check back soon, or once more members join." />
          ) : (
            visibleCards.map((item, mapIndex) => {
              const isTopCard = mapIndex === visibleCards.length - 1
              const itemStyle = isTopCard ? [StyleSheet.absoluteFill, topCardStyle] : [StyleSheet.absoluteFill, { zIndex: -1 }]

              return (
                <GestureDetector key={item.profile.id} gesture={isTopCard ? panGesture : Gesture.Pan()}>
                  <Animated.View style={itemStyle}>
                    <MatchFeedCard
                      profileId={item.profile.id}
                      displayName={item.profile.displayName}
                      avatarUrl={item.profile.avatarUrl}
                      photos={item.profile.photos?.map((url: string) => ({ url }))}
                      matchPercentage={item.matchPercentage}
                      insights={item.insights}
                      onPress={() =>
                        navigation.navigate('ProfileDetail', {
                          profileId: item.profile.id,
                          displayName: item.profile.displayName,
                          matchPercentage: item.matchPercentage,
                          insights: item.insights,
                        })
                      }
                      onAction={(action) => onCardAction(item.profile.id, item.profile.displayName, action)}
                    />
                  </Animated.View>
                </GestureDetector>
              )
            })
          )}
        </View>

        {matchData && (
          <Animated.View 
            entering={FadeIn} 
            exiting={FadeOut} 
            style={styles.modalOverlay}
          >
            <Animated.View entering={ZoomIn.springify().damping(14)} exiting={ZoomOut} style={styles.modalContent}>
              <Text style={styles.modalEmoji}>🎉</Text>
              <Typography variant="title" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
                It's a match!
              </Typography>
              <Typography variant="body" style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                You and {matchData.displayName} liked each other.
              </Typography>

              <Button 
                label="Say hi"
                onPress={() => {
                  const nav = navigation.getParent()?.navigate as any
                  setMatchData(null)
                  nav('Messages', {
                    screen: 'Conversation',
                    params: { conversationId: matchData.conversationId, displayName: matchData.displayName },
                  })
                }}
              />
              <View style={{ height: spacing.md }} />
              <Button 
                label="Keep swiping" 
                variant="secondary"
                onPress={() => setMatchData(null)} 
              />
            </Animated.View>
          </Animated.View>
        )}
      </ScreenContainer>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  headerWrapper: {
    zIndex: 10,
    backgroundColor: colors.overlay,
  },
  deckContainer: {
    flex: 1,
    position: 'relative',
    margin: spacing.md,
    marginBottom: spacing.xxl,
  },
  deckContainerDesktop: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 460,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    width: '100%',
    alignItems: 'stretch',
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
})
