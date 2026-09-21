import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useConversations, useDiscoverFeed, useProfile, useProfileLists, useSwipe } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { ProfileGalleryHero } from '../../../ui/ProfileGalleryHero'
import { Icon } from '../../../ui/Icon'
import { EmptyState } from '../../../ui/EmptyState'
import { MatchPercentageBadge } from '../components/MatchPercentageBadge'
import { MatchDimensionsBreakdown } from '../components/MatchDimensionsBreakdown'
import { PreviewListCard } from '../../lists/components/PreviewListCard'
import { PreviewListCardSkeleton } from '../../lists/components/PreviewListCardSkeleton'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { Rail } from '../../../ui/content/Rail'
import type { ContentUnit } from '../../../ui/content/types'
import { borderWidth, colors, spacing } from '../../../theme'
import { hapticHeavy, hapticMedium } from '../../../lib/haptics'
import type { DiscoveryStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<DiscoveryStackParamList, 'ProfileDetail'>

// A real page you land on, not a card popped over the previous screen —
// capped reading column (not the app-wide 'wide' 960 tier, which at full
// bleed made the hero photo enormous and the whole thing read as a floating
// modal), no back-button chrome (native stack back-swipe/hardware-back still
// works), and a full-width "More to discover" rail at the bottom so browsing
// never dead-ends on one profile.
const CONTENT_WIDTH = 640

export function ProfileDetailScreen({ route, navigation }: Props) {
  const { profileId, displayName, age, matchPercentage, insights } = route.params
  const profile = useProfile(profileId)
  const lists = useProfileLists(profileId)
  const relatedFeed = useDiscoverFeed()
  const swipe = useSwipe()
  const conversations = useConversations()
  const [myAction, setMyAction] = useState<'LIKE' | 'PASS' | null>(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const sheet = useActionSheet()

  // Server-declared, not inferred: a free-tier viewer and a profile that
  // simply has no photos both come back with `avatarUrl: null, photos: []`
  // — `photosLocked` is the one field that tells those two apart (a bug
  // fix; this used to guess "locked" from a null avatarUrl alone, which
  // wrongly showed "Go premium" to a premium viewer on a photo-less profile).
  const locked = !!profile.data?.photosLocked
  const photos = profile.data ? Array.from(new Set([profile.data.avatarUrl, ...(profile.data.photos ?? [])].filter((u): u is string => !!u))) : []
  const nameLine = [displayName, age].filter(Boolean).join(', ')

  // Reuses Discover's own feed query/cache (same 'discoverFeed' key) — pull
  // the person units out of whatever modules already came back, skip this
  // profile itself, and let Rail render them exactly as Discover does.
  const relatedProfiles = useMemo(() => {
    const seen = new Set<string>([profileId])
    const units: ContentUnit[] = []
    for (const page of relatedFeed.data?.pages ?? []) {
      for (const module of page.data ?? []) {
        for (const unit of module.items ?? []) {
          if (unit.kind !== 'person' || seen.has(unit.id)) continue
          seen.add(unit.id)
          units.push(unit)
        }
      }
    }
    return units.slice(0, 10)
  }, [relatedFeed.data, profileId])

  // Messaging stays match-gated (v3 pivot — there's no "message anyone"
  // endpoint, only a Conversation created by a mutual swipe), so a real
  // Message button here can only mean "open the conversation that already
  // exists." There's no dedicated by-profile lookup, so this checks whatever
  // conversation pages are already loaded/cached — same data ConversationsScreen
  // shows, just searched client-side instead of a server query.
  const existingConversation = useMemo(() => {
    const rows = conversations.data?.pages.flatMap((p) => p.data) ?? []
    return rows.find((c) => c.participants.some((p: any) => p.id === profileId))
  }, [conversations.data, profileId])

  function onPressMessage() {
    if (existingConversation) {
      ;(navigation.getParent()?.navigate as any)('Messages', {
        screen: 'Conversation',
        params: { conversationId: existingConversation.id, displayName },
      })
      return
    }
    sheet.show({
      title: 'Not matched yet',
      message: `Messaging unlocks once you and ${displayName} both like each other — try Like above.`,
      buttons: [{ testID: 'profile-detail.dialog.ok', text: 'Got it' }],
    })
  }

  // Like/Pass are quick, in-page actions now — not a full-screen swipe deck's
  // primary action, so a decision here doesn't yank the viewer back to
  // wherever they came from. They keep reading this profile; "It's a match"
  // still interrupts with a real choice (say hi vs. keep browsing in place).
  async function handleSwipe(action: 'LIKE' | 'PASS') {
    setIsSwiping(true)
    try {
      const result = await swipe.mutateAsync({ targetProfileId: profileId, action })
      setMyAction(action)
      if (action === 'LIKE') hapticHeavy()
      else hapticMedium()
      if (result.matched) {
        sheet.show({
          title: 'It’s a match! 🎉',
          message: `You and ${displayName} liked each other.`,
          buttons: [
            { testID: 'profile-detail.dialog.keep-browsing', text: 'Keep browsing', style: 'cancel' },
            {
              testID: 'profile-detail.dialog.say-hi', text: 'Say hi',
              onPress: () =>
                (navigation.getParent()?.navigate as any)('Messages', {
                  screen: 'Conversation',
                  params: { conversationId: result.conversation!.id, displayName },
                }),
            },
          ],
        })
      }
    } catch {
      setMyAction(null)
    } finally {
      setIsSwiping(false)
    }
  }

  // Pushed, not navigated — profile A -> B -> C stacks up so the back
  // gesture/button retraces every profile actually visited, which is what
  // makes the rail worth clicking through instead of a dead end.
  function onPressRelated(unit: ContentUnit) {
    if (!unit.profile) return
    const overlap = unit.metrics?.find((m) => m.type === 'overlap')
    const matchPct = overlap ? parseInt(String(overlap.value), 10) : undefined
    navigation.push('ProfileDetail', {
      profileId: unit.profile.id,
      displayName: unit.profile.displayName,
      age: unit.age ?? undefined,
      matchPercentage: Number.isNaN(matchPct as number) ? undefined : matchPct,
      insights: unit.insights,
    })
  }

  return (
    <ScreenContainer testID="screen.profile-detail" padded={false} width="full">
      <ScrollView testID="profile-detail.scroll" contentContainerStyle={styles.scrollContent}>
        <View style={styles.column}>
          <View style={styles.heroFrame}>
            <ProfileGalleryHero
              testID="profile-detail.gallery"
              photos={photos}
              placeholderInitial={(displayName || '?').charAt(0)}
              locked={locked}
              lockedMessage="Go premium to see their photos"
              topRight={matchPercentage != null ? <MatchPercentageBadge percentage={matchPercentage} /> : undefined}
            >
              <Typography variant="title" style={styles.heroName}>{nameLine}</Typography>
              {profile.data?.locationLabel ? (
                <View style={styles.locationRow}>
                  <Icon name="MapPin" color="rgba(255,255,255,0.75)" size={14} />
                  <Typography variant="bodyMuted" style={styles.heroLocation}>{profile.data.locationLabel}</Typography>
                </View>
              ) : null}
            </ProfileGalleryHero>
          </View>

          <View style={styles.body}>
            <View style={styles.quickActionsRow}>
              <Pressable
                testID="profile-detail.action.pass"
                style={[styles.actionBtn, styles.passBtn, myAction === 'LIKE' && styles.actionBtnFaded]}
                onPress={() => handleSwipe('PASS')}
                disabled={isSwiping || !!myAction}
              >
                <Icon name="X" size={16} color={colors.inkMuted} />
                <Typography variant="label" style={styles.actionLabelPass}>{myAction === 'PASS' ? 'Passed' : 'Pass'}</Typography>
              </Pressable>
              <Pressable
                testID="profile-detail.action.like"
                style={[styles.actionBtn, styles.likeBtn, myAction === 'PASS' && styles.actionBtnFaded]}
                onPress={() => handleSwipe('LIKE')}
                disabled={isSwiping || !!myAction}
              >
                {isSwiping && !myAction ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Icon name="Heart" size={16} color={colors.white} />
                )}
                <Typography variant="label" style={styles.actionLabelLike}>{myAction === 'LIKE' ? 'Liked' : 'Like'}</Typography>
              </Pressable>
              <Pressable
                testID="profile-detail.action.message"
                style={[styles.actionBtn, styles.messageBtn, !existingConversation && styles.actionBtnFaded]}
                onPress={onPressMessage}
              >
                <Icon name={existingConversation ? 'MessageCircle' : 'Lock'} size={16} color={colors.ink} />
                <Typography variant="label" style={styles.actionLabelPass}>Message</Typography>
              </Pressable>
            </View>

            {profile.data?.bio ? (
              <View style={styles.section}>
                <Typography variant="label" style={styles.sectionLabel}>About</Typography>
                <Typography variant="body">{profile.data.bio}</Typography>
              </View>
            ) : null}

            {/* The differentiator this whole product is built on — feature it
                bigger and earlier than a paragraph of bio text, full width so
                a list's ranked items are actually readable, not crammed into
                a 2-up grid cell. */}
            <View style={styles.section}>
              <View style={styles.listsHeaderRow}>
                <Typography variant="label" style={styles.sectionLabelTight}>Favorite lists</Typography>
                {lists.data?.length ? (
                  <Typography variant="bodyMuted">{lists.data.length} ranked</Typography>
                ) : null}
              </View>

              {lists.isLoading ? (
                <View style={styles.listsStack}>
                  <PreviewListCardSkeleton />
                  <PreviewListCardSkeleton />
                </View>
              ) : lists.data?.length ? (
                <View style={styles.listsStack}>
                  {lists.data.map((list: any) => (
                    <PreviewListCard key={list.id} list={list} style={styles.listCard} />
                  ))}
                </View>
              ) : (
                <EmptyState testID="profile-detail.empty" title="No public lists yet" />
              )}
            </View>

            {insights?.length ? <MatchDimensionsBreakdown insights={insights} /> : null}
          </View>
        </View>

        {relatedProfiles.length > 0 ? (
          <Rail
            testID="profile-detail.related"
            title="More to discover"
            items={relatedProfiles}
            state={relatedFeed.isLoading ? 'loading' : 'ready'}
            cardWidth={220}
            onPressItem={onPressRelated}
          />
        ) : null}
      </ScrollView>

      <ActionSheet testID="profile-detail.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.section },
  column: { width: '100%', maxWidth: CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  heroFrame: { borderWidth: borderWidth.thick, borderColor: colors.ink, overflow: 'hidden' },
  heroName: { color: colors.white },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  heroLocation: { color: 'rgba(255,255,255,0.75)' },
  body: { paddingTop: spacing.lg },
  quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
  },
  passBtn: { backgroundColor: colors.surface },
  likeBtn: { backgroundColor: colors.ink },
  messageBtn: { backgroundColor: colors.surface },
  actionBtnFaded: { opacity: 0.4 },
  actionLabelPass: { color: colors.inkMuted },
  actionLabelLike: { color: colors.white },
  section: { marginBottom: spacing.xl },
  sectionLabel: { marginBottom: spacing.sm },
  sectionLabelTight: { marginBottom: spacing.xs },
  listsHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  listsStack: { gap: spacing.sm },
  listCard: { backgroundColor: colors.surface },
})
