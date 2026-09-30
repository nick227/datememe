import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, Image } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import {
  ApiError,
  useCurrentUser,
  useMessages,
  useSendMessage,
  useConversations,
  useMarkAsRead,
  useUploadMedia,
  useUnmatchConversation,
  useSubmitReport,
} from '@project/sdk'
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Icon } from '../../../ui/Icon'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import { openPoll } from '../../../navigation/openPoll'
import type { MessagesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'
import { hapticLight, hapticSuccess } from '../../../lib/haptics'

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversation'>

type ActivityCta = {
  label: string
  route: string
  params?: {
    profileId?: string
    displayName?: string
    conversationId?: string
    categorySlug?: string
    shortLabel?: string
  }
}

function systemEventTitle(eventType: string | undefined) {
  switch (eventType) {
    case 'PROFILE_LIKED': return 'Like sent'
    case 'PROFILE_LIKED_YOU': return 'New like'
    case 'MATCH': return 'Match'
    case 'LIST_COMPLETED': return 'List completed'
    default: return 'Datememe insight'
  }
}

function supportsSystemCta(cta: ActivityCta | null | undefined): cta is ActivityCta {
  return cta?.route === 'ProfileDetail' || cta?.route === 'Conversation' || cta?.route === 'ListBuilder'
}

function conversationHeaderFacts(person: { locationLabel?: string | null; age?: number | null; bio?: string | null }) {
  const place = person.locationLabel?.trim() || ''
  const age = person.age != null ? String(person.age) : ''
  const basics = place && age ? `${place} · ${age}` : place || age
  return { basics, factoid: person.bio?.trim() ?? '' }
}

type BubbleAttachment = { type?: string; url?: string }

const MessageBubble = memo(function MessageBubble({
  item,
  isOwn,
  isLastInGroup,
  showSeen,
  avatarUrl,
  avatarInitial,
  onReport,
}: {
  item: { id: string; body?: string | null; createdAt: string; attachments?: BubbleAttachment[] | null }
  isOwn: boolean
  isLastInGroup: boolean
  showSeen: boolean
  avatarUrl?: string | null
  avatarInitial: string
  onReport: (messageId: string) => void
}) {
  const time = isLastInGroup
    ? new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : ''
  return (
    <View style={[styles.bubbleRow, !isLastInGroup && styles.bubbleRowGrouped]}>
      <View style={styles.bubbleStack}>
        <View style={styles.bubbleCluster}>
          <Pressable
            testID={`conversation.message.${item.id}`}
            style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
            onLongPress={() => !isOwn && onReport(item.id)}
          >
            {item.attachments?.map((att, i) =>
              att.type === 'image' && att.url ? (
                <View key={i} style={styles.bubbleAttachmentContainer}>
                  <Image source={{ uri: att.url }} style={styles.bubbleImage} resizeMode="cover" />
                </View>
              ) : null,
            )}
            {item.body ? <Text style={isOwn ? styles.bodyOwn : styles.bodyOther}>{item.body}</Text> : null}
            {time ? <Text style={isOwn ? styles.timeOwn : styles.timeOther}>{time}</Text> : null}
          </Pressable>
          <MessageAvatar uri={avatarUrl} initial={avatarInitial} />
        </View>
        {showSeen ? <Text style={styles.seenText}>Seen</Text> : null}
      </View>
    </View>
  )
})

function MessageAvatar({ uri, initial }: { uri?: string | null; initial: string }) {
  if (uri) return <Image source={{ uri }} style={styles.messageAvatar} />
  return (
    <View style={[styles.messageAvatar, styles.messageAvatarFallback]}>
      <Text style={styles.messageAvatarInitial}>{initial.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

function findById<T extends { id: string }>(pages: { data: T[] }[] | undefined, id: string) {
  if (!pages) return undefined
  for (const page of pages) {
    for (let i = 0; i < page.data.length; i++) {
      if (page.data[i].id === id) return page.data[i]
    }
  }
  return undefined
}

export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, displayName } = route.params
  const isFocused = useIsFocused()
  const me = useCurrentUser()
  const myProfileId = me.data?.profile?.id
  const messages = useMessages(conversationId, { poll: isFocused })
  const sendMessage = useSendMessage(conversationId)
  const uploadMedia = useUploadMedia()
  const markAsRead = useMarkAsRead(conversationId)
  const { mutate: markAsReadMutate } = markAsRead
  const conversations = useConversations()
  const unmatchConversation = useUnmatchConversation()
  const submitReport = useSubmitReport()
  const sheet = useActionSheet()
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const contentRef = useRef<View>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    markAsReadMutate()
  }, [markAsReadMutate])

  const conversation = useMemo(
    () => findById(conversations.data?.pages, conversationId),
    [conversations.data, conversationId],
  )
  const otherParticipant = conversation?.participants.find((p) => p.id !== myProfileId) ?? conversation?.participants[0]

  const rows = useMemo(
    () => messages.data?.pages.flatMap((p) => p.data) ?? [],
    [messages.data],
  )

  // Newest message is index 0 (the list is inverted). One walk finds my latest
  // message and, until the conversation row loads, whether this is a system thread.
  const thread = useMemo(() => {
    const knownType = conversation != null
    let system = conversation?.type === 'SYSTEM'
    let myLastId: string | undefined
    let myLastAt: string | undefined
    for (let i = 0; i < rows.length; i++) {
      const message = rows[i]
      if (myLastId == null && message.senderId === myProfileId) {
        myLastId = message.id
        myLastAt = message.createdAt
      }
      if (!knownType && message.systemMessageType != null) system = true
      if (myLastId != null && (knownType || system)) break
    }
    return { system, myLastId, myLastAt }
  }, [rows, myProfileId, conversation])

  // "Seen" derives from the existing per-participant lastReadAt (no per-message
  // read model): the other participant has seen my latest message once their
  // lastReadAt catches up to it. Only ever shown under that one message.
  const otherReadAt = conversation?.participantReadState?.find((p) => p.profileId === otherParticipant?.id)?.lastReadAt
  const isSeen = useMemo(() => {
    if (!thread.myLastAt || !otherReadAt) return false
    return new Date(otherReadAt).getTime() >= new Date(thread.myLastAt).getTime()
  }, [thread.myLastAt, otherReadAt])

  const isSystemThread = thread.system
  const headerFacts = isSystemThread || !otherParticipant ? null : conversationHeaderFacts(otherParticipant)

  async function handleSend() {
    const body = draft.trim()
    if (!body && !attachment) return

    setDraft('')
    const currentAttachment = attachment
    setAttachment(null)
    hapticLight()

    try {
      let attachmentsPayload: any[] | undefined = undefined

      if (currentAttachment) {
        const upload = await uploadMedia.mutateAsync({
          uri: currentAttachment.uri,
          name: currentAttachment.fileName || 'upload.jpg',
          type: currentAttachment.mimeType || 'image/jpeg',
        })
        attachmentsPayload = [{
          type: 'image',
          url: upload.url,
          mimeType: upload.mimeType,
          width: currentAttachment.width,
          height: currentAttachment.height
        }]
      }

      await sendMessage.mutateAsync({ body, attachments: attachmentsPayload })
      hapticSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        sheet.show({
          title: 'Daily limit reached',
          message: err?.message ?? 'Your daily message allowance has been reached.',
          buttons: [
            { testID: 'conversation.dialog.not-now', text: 'Not now', style: 'cancel' },
            { testID: 'conversation.dialog.go-premium', text: 'Go Premium', onPress: () => navigation.navigate('Paywall') },
          ],
        })
      } else {
        sheet.show({ title: 'Could not send', message: 'Try again in a moment.', buttons: [{ testID: 'conversation.dialog.ok', text: 'OK' }] })
      }
      setDraft(body)
      setAttachment(currentAttachment)
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      setAttachment(result.assets[0])
    }
  }

  const fileReport = useCallback((reason: string, targetMessageId?: string) => {
    if (!otherParticipant) return
    submitReport.mutate(
      targetMessageId
        ? { targetType: 'MESSAGE', targetMessageId, reason }
        : { targetType: 'PROFILE', targetProfileId: otherParticipant.id, reason },
      {
        onSuccess: () => sheet.show({ title: 'Reported', message: "Thanks — we'll review this.", buttons: [{ testID: 'conversation.dialog.ok', text: 'OK' }] }),
        onError: () => sheet.show({ title: 'Could not send report', message: 'Try again in a moment.', buttons: [{ testID: 'conversation.dialog.ok', text: 'OK' }] }),
      },
    )
  }, [otherParticipant, submitReport, sheet])

  function handleReport() {
    sheet.show({
      title: `Report ${displayName}`,
      message: "What's the issue?",
      buttons: [
        { testID: 'conversation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'conversation.dialog.inappropriate-content', text: 'Inappropriate content', onPress: () => fileReport('Inappropriate content') },
        { testID: 'conversation.dialog.harassment', text: 'Harassment', onPress: () => fileReport('Harassment') },
        { testID: 'conversation.dialog.fake-profile', text: 'Fake profile', onPress: () => fileReport('Fake profile') },
        { testID: 'conversation.dialog.spam', text: 'Spam', onPress: () => fileReport('Spam') },
      ],
    })
  }

  const reportMessage = useCallback((messageId: string) => {
    sheet.show({
      title: 'Report this message',
      message: "What's the issue?",
      buttons: [
        { testID: 'conversation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'conversation.dialog.inappropriate-content', text: 'Inappropriate content', onPress: () => fileReport('Inappropriate content', messageId) },
        { testID: 'conversation.dialog.harassment', text: 'Harassment', onPress: () => fileReport('Harassment', messageId) },
        { testID: 'conversation.dialog.spam', text: 'Spam', onPress: () => fileReport('Spam', messageId) },
      ],
    })
  }, [sheet, fileReport])

  function handleUnmatch() {
    sheet.show({
      title: 'Unmatch',
      message: `Unmatch with ${displayName}? This can't be undone — you'll stop seeing each other's messages, and either of you could be shown to the other again in Discover.`,
      buttons: [
        { testID: 'conversation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        {
          testID: 'conversation.dialog.unmatch', text: 'Unmatch',
          style: 'destructive',
          onPress: () =>
            unmatchConversation.mutate(conversationId, {
              onSuccess: () => navigation.goBack(),
              onError: () => sheet.show({ title: 'Could not unmatch', message: 'Try again in a moment.', buttons: [{ testID: 'conversation.dialog.ok', text: 'OK' }] }),
            }),
        },
      ],
    })
  }

  function handleOptions() {
    sheet.show({
      title: 'Options',
      message: 'What would you like to do?',
      buttons: [
        { testID: 'conversation.dialog.cancel', text: 'Cancel', style: 'cancel' },
        { testID: 'conversation.dialog.report', text: 'Report', style: 'destructive', onPress: handleReport },
        { testID: 'conversation.dialog.unmatch', text: 'Unmatch', style: 'destructive', onPress: handleUnmatch },
      ],
    })
  }

  function handleSystemCta(cta: ActivityCta) {
    if (!supportsSystemCta(cta)) return

    if (cta.route === 'ProfileDetail' && cta.params?.profileId) {
      ;(navigation.getParent()?.navigate as any)('Discover', {
        screen: 'ProfileDetail',
        params: {
          profileId: cta.params.profileId,
          displayName: cta.params.displayName ?? 'Profile',
        },
      })
      return
    }

    if (cta.route === 'Conversation' && cta.params?.conversationId) {
      navigation.push('Conversation', {
        conversationId: cta.params.conversationId,
        displayName: cta.params.displayName ?? 'Match',
      })
      return
    }

    if (cta.route === 'ListBuilder' && cta.params?.categorySlug) {
      openPoll(navigation, 'edit', {
        categorySlug: cta.params.categorySlug,
        shortLabel: cta.params.shortLabel ?? 'List',
      })
    }
  }

  return (
    <ScreenContainer testID="screen.conversation" padded={false} width="wide">
      {/* Interactive Header */}
      <View style={styles.header}>
        <Pressable testID="conversation.back" onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="ArrowLeft" size={24} color={colors.ink} />
        </Pressable>

        <Pressable
          testID="conversation.profile"
          style={styles.headerProfile}
          disabled={isSystemThread}
          onPress={() =>
            otherParticipant &&
            (navigation.getParent()?.navigate as any)('Discover', {
              screen: 'ProfileDetail',
              params: { profileId: otherParticipant.id, displayName: otherParticipant.displayName },
            })
          }
        >
          {isSystemThread ? (
            <View style={[styles.headerAvatar, styles.headerAvatarSystem]}>
              <Icon name="Bell" size={18} color={colors.inkMuted} />
            </View>
          ) : otherParticipant?.avatarUrl ? (
            <Image source={{ uri: otherParticipant.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Typography variant="heading" numberOfLines={1}>{isSystemThread ? 'Activity' : displayName}</Typography>
            {headerFacts?.basics ? (
              <Typography variant="bodyMuted" numberOfLines={1} style={styles.headerMeta}>{headerFacts.basics}</Typography>
            ) : null}
            {headerFacts?.factoid ? (
              <Typography variant="bodyMuted" numberOfLines={1} style={styles.headerMeta}>{headerFacts.factoid}</Typography>
            ) : null}
          </View>
        </Pressable>

        {isSystemThread ? (
          <View style={styles.headerBtn}><View style={styles.headerIconPlaceholder} /></View>
        ) : (
          <Pressable testID="conversation.options" onPress={handleOptions} style={styles.headerBtn}>
            <Icon name="MoreVertical" size={24} color={colors.ink} />
          </Pressable>
        )}
      </View>
      <View style={styles.headerDivider} />

      <View
        ref={contentRef}
        style={styles.content}
        onLayout={() => contentRef.current?.measureInWindow((_x, y) => setKeyboardOffset(y))}
      >
        {/* Both headers are custom, so measure the content's screen offset. */}
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
        >
          {messages.isLoading ? (
            <View testID="conversation.loading" style={[styles.messages, { flex: 1 }]}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.bubbleRow}>
                  <Skeleton width={140 + (i % 3) * 30} height={40} style={{ borderRadius: radius.lg }} />
                </View>
              ))}
            </View>
          ) : messages.isError ? (
            <View style={{ flex: 1 }}>
              <ErrorState testID="conversation.error" subtitle="Couldn't load this conversation." onRetry={() => messages.refetch()} />
            </View>
          ) : (
            <FlatList
              style={styles.content}
              data={rows}
              keyExtractor={(item) => item.id}
              inverted
              contentContainerStyle={styles.messages}
              onEndReached={() => messages.hasNextPage && messages.fetchNextPage()}
              renderItem={({ item, index }) => {
                if (isSystemThread) {
                  const cta = item.systemData?.cta
                  const actionable = supportsSystemCta(cta)
                  return (
                    <View style={styles.systemCardContainer}>
                      <Pressable
                        testID={`conversation.system.${item.id}`}
                        style={styles.systemCard}
                        disabled={!actionable}
                        onPress={() => actionable && handleSystemCta(cta)}
                      >
                        <Text style={styles.systemCardTitle}>{systemEventTitle(item.systemData?.event?.type)}</Text>
                        <Text style={styles.systemCardBody}>{item.body}</Text>
                        {actionable && (
                          <View testID={`conversation.system.${item.id}.cta`} style={styles.systemCardCta}>
                            <Text style={styles.systemCardCtaText}>{cta.label}</Text>
                          </View>
                        )}
                        <Text style={styles.systemCardTime}>
                          {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                      </Pressable>
                    </View>
                  )
                }

                const isOwn = item.senderId === myProfileId
                const prevItem = rows[index - 1]
                const isLastInGroup = !prevItem || prevItem.senderId !== item.senderId
                if (!item.body && !item.attachments?.length) return null

                return (
                  <MessageBubble
                    item={item}
                    isOwn={isOwn}
                    isLastInGroup={isLastInGroup}
                    showSeen={isOwn && isSeen && item.id === thread.myLastId}
                    avatarUrl={isOwn ? me.data?.profile?.avatarUrl : otherParticipant?.avatarUrl}
                    avatarInitial={isOwn ? (me.data?.profile?.displayName ?? 'You') : (otherParticipant?.displayName ?? displayName)}
                    onReport={reportMessage}
                  />
                )
              }}
            />
          )}

          {!isSystemThread && (
            <View style={styles.composerWrapper}>
              {attachment && (
                <View style={styles.attachmentPreviewContainer}>
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentPreview} />
                  <Pressable testID="conversation.attachment.remove" style={styles.attachmentRemoveBtn} onPress={() => setAttachment(null)}>
                    <Icon name="X" size={12} color={colors.white} />
                  </Pressable>
                </View>
              )}
              <View style={styles.composer}>
                <Pressable testID="conversation.attach" style={styles.attachButton} onPress={pickImage}>
                  <Icon name="Plus" size={24} color={colors.inkMuted} />
                </Pressable>
                <TextField testID="conversation.compose"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Message…"
                  multiline
                  containerStyle={styles.inputContainer}
                  style={styles.inputField}
                />
                {(draft.trim().length > 0 || attachment) && (
                  <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(200)}>
                    <Pressable
                      testID="conversation.send"
                      style={styles.sendButton}
                      onPress={handleSend}
                      disabled={sendMessage.isPending || uploadMedia.isPending}
                    >
                      <Icon name="Send" size={20} color={colors.white} />
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
      <ActionSheet testID="conversation.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  headerBtn: {
    padding: spacing.xs,
  },
  headerIconPlaceholder: {
    width: 24,
    height: 24,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: spacing.sm,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  headerMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
  },
  headerAvatarSystem: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 20,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  messages: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.md },
  bubbleRowGrouped: { marginBottom: 2 },
  bubbleStack: { alignItems: 'flex-end', maxWidth: '85%' },
  bubbleCluster: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  seenText: { color: colors.inkMuted, fontSize: 11, marginTop: 2, marginRight: 26 },
  bubble: {
    minWidth: 128,
    maxWidth: '100%',
    flexShrink: 1,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleOwn: { backgroundColor: colors.ink },
  bubbleOther: { backgroundColor: '#EEF1FF' },
  messageAvatar: { width: 22, height: 22, borderRadius: radius.pill },
  messageAvatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  messageAvatarInitial: { color: colors.ink, fontSize: 10, fontWeight: '700' },

  bodyOwn: { color: colors.white, fontSize: 15, lineHeight: 20 },
  bodyOther: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  timeOwn: { color: 'rgba(255,255,255,0.7)', fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  timeOther: { color: colors.inkMuted, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },

  systemCardContainer: {
    alignItems: 'center',
    marginVertical: spacing.md,
    width: '100%',
  },
  systemCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '90%',
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  systemCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  systemCardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  systemCardCta: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  systemCardCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  systemCardTime: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },

  composerWrapper: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    paddingRight: spacing.xs,
    paddingVertical: 2, // inner padding
  },
  inputContainer: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  inputField: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: 44,
    maxHeight: 120,
    paddingTop: 12, // override textfield padding if needed to center
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  attachButton: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentPreviewContainer: {
    marginBottom: spacing.sm,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  attachmentPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
  },
  attachmentRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleAttachmentContainer: {
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  bubbleImage: {
    width: 220,
    height: 220,
    borderRadius: radius.md,
  },
})
