import { useState, useRef, useEffect } from 'react'
import { Text, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, Image } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useHeaderHeight } from '@react-navigation/elements'
import { ApiError, useCurrentUser, useMessages, useSendMessage, useConversations, useMarkAsRead, useUploadMedia } from '@project/sdk'
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Icon } from '../../../ui/Icon'
import { colors, radius, spacing } from '../../../theme'
import type { MessagesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'
import { hapticLight, hapticSuccess } from '../../../lib/haptics'

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversation'>

export function ConversationScreen({ route, navigation }: Props) {
  const { conversationId, displayName } = route.params
  const me = useCurrentUser()
  const myProfileId = me.data?.profile?.id
  const messages = useMessages(conversationId)
  const sendMessage = useSendMessage(conversationId)
  const uploadMedia = useUploadMedia()
  const markAsRead = useMarkAsRead(conversationId)
  const conversations = useConversations()
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
          type: currentAttachment.type === 'video' ? 'video' : 'image',
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
        Alert.alert(
          'Daily limit reached',
          'Free members can send up to 3 messages a day. Go premium for unlimited messaging.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Go Premium', onPress: () => (navigation.getParent()?.navigate as any)('Profile', { screen: 'Paywall' }) },
          ],
        )
      } else {
        Alert.alert('Could not send', 'Try again in a moment.')
      }
      setDraft(body)
      setAttachment(currentAttachment)
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      setAttachment(result.assets[0])
    }
  }

  function handleOptions() {
    Alert.alert('Options', 'What would you like to do?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => console.log('Report') },
      { text: 'Unmatch', style: 'destructive', onPress: () => console.log('Unmatch') }
    ])
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
          onPress={() => otherParticipant && navigation.navigate('ProfileDetail', { profileId: otherParticipant.id, displayName: otherParticipant.displayName })}
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

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={styles.messages}
        onEndReached={() => messages.hasNextPage && messages.fetchNextPage()}
        renderItem={({ item, index }) => {
          const isOwn = item.senderId === myProfileId
          const nextItem = rows[index + 1] // Older message (rendered above this one)
          const prevItem = rows[index - 1] // Newer message (rendered below this one)
          
          const isFirstInGroup = !nextItem || nextItem.senderId !== item.senderId
          const isLastInGroup = !prevItem || prevItem.senderId !== item.senderId

          return (
            <View style={[
              styles.bubbleRow, 
              isOwn && styles.bubbleRowOwn,
              !isLastInGroup && { marginBottom: 2 }
            ]}>
              {item.locked ? (
                <Pressable 
                  style={styles.lockedContainer}
                  onPress={() => (navigation.getParent()?.navigate as any)('Profile', { screen: 'Paywall' })}
                >
                  <LinearGradient
                    colors={[colors.primarySoft, colors.lavenderSoft]}
                    style={[styles.bubble, styles.bubbleLocked]}
                  >
                    <Icon name="Lock" size={16} color={colors.primary} />
                    <Text style={styles.lockedText}>Premium message</Text>
                  </LinearGradient>
                  <View style={styles.unlockBtn}>
                    <Text style={styles.unlockBtnText}>Unlock</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={[
                  styles.bubble, 
                  isOwn ? styles.bubbleOwn : styles.bubbleOther,
                  isOwn && isLastInGroup && { borderBottomRightRadius: 4 },
                  isOwn && isFirstInGroup && { borderTopRightRadius: radius.lg },
                  !isOwn && isLastInGroup && { borderBottomLeftRadius: 4 },
                  !isOwn && isFirstInGroup && { borderTopLeftRadius: radius.lg },
                ]}>
                  {item.attachments?.map((att: any, i: number) => (
                    <View key={i} style={styles.bubbleAttachmentContainer}>
                      {att.type === 'image' || att.type === 'video' ? (
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

                  {/* YouTube Link Detection */}
                  {item.body && (() => {
                    const ytMatch = item.body.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i)
                    if (ytMatch && ytMatch[1]) {
                      const ytId = ytMatch[1]
                      return (
                        <Pressable style={styles.ytContainer} onPress={() => Alert.alert('YouTube', 'Opens YouTube video: ' + ytId)}>
                          <Image 
                            source={{ uri: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` }} 
                            style={styles.ytThumbnail} 
                          />
                          <View style={styles.ytPlayButton}>
                            <Icon name="Play" size={24} color={colors.white} />
                          </View>
                        </Pressable>
                      )
                    }
                    return null
                  })()}

                  {isLastInGroup && (
                    <Text style={isOwn ? styles.timeOwn : styles.timeOther}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )
        }}
      />

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
    borderRadius: 16,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  messages: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.md },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubble: { 
    maxWidth: '80%', 
    borderRadius: radius.lg, 
    paddingVertical: 10, 
    paddingHorizontal: 14,
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
    borderWidth: 1,
    borderColor: 'rgba(140, 124, 240, 0.3)', // lavender @ 30% — matches colors.lavender
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
    borderRadius: 18,
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
    borderRadius: 12,
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
  ytContainer: {
    marginTop: spacing.xs,
    width: 220,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ink,
  },
  ytThumbnail: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  ytPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  }
})
