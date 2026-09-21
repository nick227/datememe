import { useState, useRef, useEffect } from 'react'
import { Text, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, Image } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useHeaderHeight } from '@react-navigation/elements'
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
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated'
import * as ImagePicker from 'expo-image-picker'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Icon } from '../../../ui/Icon'
import { Skeleton } from '../../../ui/Skeleton'
import { ErrorState } from '../../../ui/ErrorState'
import { borderWidth, colors, radius, spacing } from '../../../theme'
import type { MessagesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'
import { hapticLight, hapticSuccess } from '../../../lib/haptics'

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversation'>

export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, displayName } = route.params
  const isFocused = useIsFocused()
  const me = useCurrentUser()
  const myProfileId = me.data?.profile?.id
  const messages = useMessages(conversationId, { poll: isFocused })
  const sendMessage = useSendMessage(conversationId)
  const uploadMedia = useUploadMedia()
  const markAsRead = useMarkAsRead(conversationId)
  const conversations = useConversations()
  const unmatchConversation = useUnmatchConversation()
  const submitReport = useSubmitReport()
  const sheet = useActionSheet()
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<ImagePicker.ImagePickerAsset | null>(null)

  useEffect(() => {
    markAsRead.mutate()
  }, [])
  const headerHeight = useHeaderHeight()

  // Get the conversation to access the avatar
  const conversation = conversations.data?.pages.flatMap(p => p.data).find(c => c.id === conversationId)
  const otherParticipant = conversation?.participants.find((p: any) => p.id !== myProfileId) ?? conversation?.participants[0]

  const rows = messages.data?.pages.flatMap((p) => p.data) ?? []

  // "Seen" derives from the existing per-participant lastReadAt (no per-message
  // read model): the other participant has seen my latest message once their
  // lastReadAt catches up to it. Only ever shown under that one message.
  const otherReadAt = conversation?.participantReadState?.find((p: any) => p.profileId === otherParticipant?.id)?.lastReadAt
  const myLastMessage = rows.find((m) => m.senderId === myProfileId)
  const isSeen = !!(myLastMessage && otherReadAt && new Date(otherReadAt) >= new Date(myLastMessage.createdAt))

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
            { text: 'Not now', style: 'cancel' },
            { text: 'Go Premium', onPress: () => (navigation.getParent()?.navigate as any)('Profile', { screen: 'Paywall' }) },
          ],
        })
      } else {
        sheet.show({ title: 'Could not send', message: 'Try again in a moment.', buttons: [{ text: 'OK' }] })
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

  function fileReport(reason: string, targetMessageId?: string) {
    if (!otherParticipant) return
    submitReport.mutate(
      targetMessageId
        ? { targetType: 'MESSAGE', targetMessageId, reason }
        : { targetType: 'PROFILE', targetProfileId: otherParticipant.id, reason },
      {
        onSuccess: () => sheet.show({ title: 'Reported', message: "Thanks — we'll review this.", buttons: [{ text: 'OK' }] }),
        onError: () => sheet.show({ title: 'Could not send report', message: 'Try again in a moment.', buttons: [{ text: 'OK' }] }),
      },
    )
  }

  function handleReport() {
    sheet.show({
      title: `Report ${displayName}`,
      message: "What's the issue?",
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Inappropriate content', onPress: () => fileReport('Inappropriate content') },
        { text: 'Harassment', onPress: () => fileReport('Harassment') },
        { text: 'Fake profile', onPress: () => fileReport('Fake profile') },
        { text: 'Spam', onPress: () => fileReport('Spam') },
      ],
    })
  }

  function handleReportMessage(messageId: string) {
    sheet.show({
      title: 'Report this message',
      message: "What's the issue?",
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Inappropriate content', onPress: () => fileReport('Inappropriate content', messageId) },
        { text: 'Harassment', onPress: () => fileReport('Harassment', messageId) },
        { text: 'Spam', onPress: () => fileReport('Spam', messageId) },
      ],
    })
  }

  function handleUnmatch() {
    sheet.show({
      title: 'Unmatch',
      message: `Unmatch with ${displayName}? This can't be undone — you'll stop seeing each other's messages, and either of you could be shown to the other again in Discover.`,
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: () =>
            unmatchConversation.mutate(conversationId, {
              onSuccess: () => navigation.goBack(),
              onError: () => sheet.show({ title: 'Could not unmatch', message: 'Try again in a moment.', buttons: [{ text: 'OK' }] }),
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
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report', style: 'destructive', onPress: handleReport },
        { text: 'Unmatch', style: 'destructive', onPress: handleUnmatch },
      ],
    })
  }

  return (
    <ScreenContainer padded={false} width="wide">
      {/* Interactive Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="ArrowLeft" size={24} color={colors.ink} />
        </Pressable>
        
        <Pressable 
          style={styles.headerProfile}
          onPress={() =>
            otherParticipant &&
            (navigation.getParent()?.navigate as any)('Discover', {
              screen: 'ProfileDetail',
              params: { profileId: otherParticipant.id, displayName: otherParticipant.displayName },
            })
          }
        >
          {otherParticipant?.avatarUrl ? (
            <Image source={{ uri: otherParticipant.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Typography variant="heading">{displayName}</Typography>
        </Pressable>

        <Pressable onPress={handleOptions} style={styles.headerBtn}>
          <Icon name="MoreVertical" size={24} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.headerDivider} />

      {messages.isLoading ? (
        <View style={[styles.messages, { flex: 1 }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.bubbleRow, i % 2 === 0 && styles.bubbleRowOwn]}>
              <Skeleton width={140 + (i % 3) * 30} height={40} style={{ borderRadius: radius.lg }} />
            </View>
          ))}
        </View>
      ) : messages.isError ? (
        <View style={{ flex: 1 }}>
          <ErrorState subtitle="Couldn't load this conversation." onRetry={() => messages.refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.messages}
          onEndReached={() => messages.hasNextPage && messages.fetchNextPage()}
          renderItem={({ item, index }) => {
            const isOwn = item.senderId === myProfileId
            const prevItem = rows[index - 1] // Newer message (rendered below this one)

            const isLastInGroup = !prevItem || prevItem.senderId !== item.senderId

            return (
              <View style={[
                styles.bubbleRow,
                isOwn && styles.bubbleRowOwn,
                !isLastInGroup && { marginBottom: 2 }
              ]}>
              <View style={isOwn ? styles.bubbleColumnOwn : styles.bubbleColumn}>
                {item.locked ? (
                  <Pressable
                    style={styles.lockedContainer}
                    onPress={() => (navigation.getParent()?.navigate as any)('Profile', { screen: 'Paywall' })}
                  >
                    <View style={[styles.bubble, styles.bubbleLocked]}>
                      <Icon name="Lock" size={16} color={colors.primary} />
                      <Text style={styles.lockedText}>Premium message</Text>
                    </View>
                    <View style={styles.unlockBtn}>
                      <Text style={styles.unlockBtnText}>Unlock</Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
                    onLongPress={() => !isOwn && handleReportMessage(item.id)}
                  >
                    {item.attachments?.map((att: any, i: number) => (
                      <View key={i} style={styles.bubbleAttachmentContainer}>
                        {att.type === 'image' ? (
                          <Image
                            source={{ uri: att.url }}
                            style={styles.bubbleImage}
                            resizeMode="cover"
                          />
                        ) : null}
                      </View>
                    ))}

                    {item.body ? (
                      <Text style={isOwn ? styles.bodyOwn : styles.bodyOther}>{item.body}</Text>
                    ) : null}

                    {isLastInGroup && (
                      <Text style={isOwn ? styles.timeOwn : styles.timeOther}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    )}
                  </Pressable>
                )}
                {isOwn && isSeen && item.id === myLastMessage?.id && (
                  <Text style={styles.seenText}>Seen</Text>
                )}
              </View>
              </View>
            )
          }}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
        <View style={styles.composerWrapper}>
          {attachment && (
            <View style={styles.attachmentPreviewContainer}>
              <Image source={{ uri: attachment.uri }} style={styles.attachmentPreview} />
              <Pressable style={styles.attachmentRemoveBtn} onPress={() => setAttachment(null)}>
                <Icon name="X" size={12} color={colors.white} />
              </Pressable>
            </View>
          )}
          <View style={styles.composer}>
            <Pressable style={styles.attachButton} onPress={pickImage}>
              <Icon name="Plus" size={24} color={colors.inkMuted} />
            </Pressable>
            <TextField 
              value={draft} 
              onChangeText={setDraft} 
              placeholder="Message…" 
              multiline
              style={styles.inputField} 
            />
            {(draft.trim().length > 0 || attachment) && (
              <Animated.View entering={ZoomIn.duration(200)} exiting={ZoomOut.duration(200)}>
                <Pressable 
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
      </KeyboardAvoidingView>
      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
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
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  messages: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.md },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleColumn: { alignItems: 'flex-start' },
  bubbleColumnOwn: { alignItems: 'flex-end' },
  seenText: { color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
  },
  bubbleOwn: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.surfaceMuted },
  
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bubbleLocked: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
  },
  lockedText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  unlockBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  unlockBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },

  bodyOwn: { color: colors.white, fontSize: 15, lineHeight: 20 },
  bodyOther: { color: colors.ink, fontSize: 15, lineHeight: 20 },
  timeOwn: { color: 'rgba(255,255,255,0.7)', fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
  timeOther: { color: colors.inkMuted, fontSize: 11, alignSelf: 'flex-start', marginTop: 4 },
  
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
  inputField: {
    flex: 1,
    marginBottom: 0,
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
