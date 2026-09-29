import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useConversations, useDiscoverFeed, useMyLists, useProfile, useProfileLists, useSwipe } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { ProfileImageGallery } from '../../../ui/content/ProfileImageGallery'
import { ProfileBasicInfo } from '../../../ui/content/ProfileBasicInfo'
import { formatAttributeKeys } from '../../profile/profileAttributes'
import { Icon } from '../../../ui/Icon'
import { EmptyState } from '../../../ui/EmptyState'
import { MatchDimensionsBreakdown } from '../components/MatchDimensionsBreakdown'
import { ProfileListResponseCard } from '../components/ProfileListResponseCard'
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
  const myLists = useMyLists()
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

  // The viewer's own list per category, so each of this profile's lists can
  // show "you took this / N% match". Only a list with items counts as taken.
  const myListByCategory = useMemo(() => {
    const map = new Map<string, any>()
    for (const l of myLists.data ?? []) if (l.items?.length) map.set(l.categoryId, l)
    return map
  }, [myLists.data])

  // Cross-tab, same pattern as DiscoverFeedScreen's category units.
  function openListBuilder(list: any) {
    ;(navigation.getParent()?.navigate as any)('Lists', {
      screen: 'ListBuilder',
      params: { categorySlug: list.category.slug, shortLabel: list.category.shortLabel },
    })
  }

  function openSiteRankings(list: any) {
    ;(navigation.getParent()?.navigate as any)('Rankings', {
      screen: 'CategoryRanking',
      params: { categorySlug: list.category.slug, shortLabel: list.category.shortLabel },
      initial: false,
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
    if (unit.kind !== 'person' || !unit.profile) return
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
            <ProfileImageGallery
              photos={photos}
              layout="profile"
              placeholderInitial={(displayName || '?').charAt(0)}
              locked={locked}
              lockedMessage="Go premium to see their photos"
              matchPercentage={matchPercentage}
            />
          </View>

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

          <ProfileBasicInfo
            displayName={displayName}
            age={age}
            genderIdentity={profile.data?.genderIdentity}
            locationLabel={profile.data?.locationLabel}
            seekingGenders={profile.data?.seekingGenders}
            isA={formatAttributeKeys(profile.data?.isA ?? [])}
            lookingFor={formatAttributeKeys(profile.data?.lookingFor ?? [])}
          />

          <View style={styles.body}>

            {profile.data?.bio ? (
              <View style={styles.bioSection}>
                <Typography variant="label" style={styles.sectionLabelTight}>About</Typography>
                <Typography variant="body" style={styles.bioText}>{profile.data.bio}</Typography>
              </View>
            ) : null}

            {/* The differentiator this whole product is built on — feature it
                bigger and earlier than a paragraph of bio text, full width so
                a list's ranked items are actually readable, not crammed into
                a 2-up grid cell. */}
            <View style={styles.section}>
              <View style={styles.listsHeaderRow}>
                <Typography variant="title" style={styles.listsTitle}>{displayName}’s lists</Typography>
                {lists.isSuccess ? <Typography variant="bodyMuted">{lists.data?.filter((l: any) => l.items?.length > 0).length ?? 0} lists</Typography> : null}
              </View>

              {lists.isLoading ? (
                <View style={styles.listsStack}>
                  <PreviewListCardSkeleton />
                  <PreviewListCardSkeleton />
                </View>
              ) : lists.data?.filter((l: any) => l.items?.length > 0).length ? (
                <View style={styles.listsStack}>
                  {lists.data.filter((l: any) => l.items?.length > 0).map((list: any) => (
                    <ProfileListResponseCard
                      key={list.id}
                      list={list}
                      ownerName={displayName}
                      // Hold off comparing until the viewer's lists load, so
                      // it doesn't flash "You haven't taken this".
                      viewerList={myLists.isSuccess ? myListByCategory.get(list.categoryId) ?? null : undefined}
                      onTakePoll={() => openListBuilder(list)}
                      onPressRankings={() => openSiteRankings(list)}
                    />
                  ))}
                </View>
              ) : (
                <EmptyState testID="profile-detail.empty" title="No public lists yet" />
              )}
            </View>

            {insights?.length ? <MatchDimensionsBreakdown insights={insights} /> : null}
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

        </View>
      </ScrollView>

      <ActionSheet testID="profile-detail.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.section },
  column: { width: '100%', maxWidth: CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  heroFrame: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surfaceMuted },
  body: { paddingTop: spacing.sm },
  bioSection: { marginBottom: spacing.xl },
  bioText: { fontSize: 17, lineHeight: 26, color: colors.ink },
  quickActionsRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    borderRadius: 24,
  },
  passBtn: { backgroundColor: colors.surface },
  likeBtn: { backgroundColor: colors.ink },
  messageBtn: { backgroundColor: colors.surface },
  actionBtnFaded: { opacity: 0.4 },
  actionLabelPass: { color: colors.inkMuted },
  actionLabelLike: { color: colors.white },
  section: { marginBottom: spacing.xl, marginTop: spacing.md, paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  sectionLabel: { marginBottom: spacing.sm },
  sectionLabelTight: { marginBottom: spacing.xs },
  listsHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  listsStack: { gap: spacing.xl },
  listsTitle: { flex: 1, fontSize: 24 },
  listsIntro: { marginBottom: spacing.xl },
})
