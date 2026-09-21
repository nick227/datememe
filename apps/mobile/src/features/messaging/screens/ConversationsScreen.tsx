import { useState } from 'react'
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useConversations, useCurrentUser, useUnmatchConversation } from '@project/sdk'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { TextField } from '../../../ui/TextField'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { colors, radius, spacing, type } from '../../../theme'
import type { MessagesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { hapticMedium } from '../../../lib/haptics'

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>

function formatTimeRelative(dateString: string) {
  const d = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  if (diffHours < 48) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ConversationsScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const myProfileId = me.data?.profile?.id
  const conversations = useConversations()
  const unmatchConversation = useUnmatchConversation()
  const sheet = useActionSheet()
  const [search, setSearch] = useState('')
  const allRows = conversations.data?.pages.flatMap((p) => p.data) ?? []
  const query = search.trim().toLowerCase()
  const rows = query
    ? allRows.filter((item) => {
        const other = item.participants.find((p: any) => p.id !== myProfileId) ?? item.participants[0]
        return (
          other?.displayName?.toLowerCase().includes(query) ||
          item.lastMessageBody?.toLowerCase().includes(query)
        )
      })
    : allRows

  function confirmUnmatch(conversationId: string, otherDisplayName: string) {
    hapticMedium()
    sheet.show({
      title: 'Unmatch',
      message: `Unmatch with ${otherDisplayName}? This can't be undone — you'll stop seeing each other's messages, and either of you could be shown to the other again in Discover.`,
      buttons: [
        { testID: 'conversations.dialog.cancel', text: 'Cancel', style: 'cancel' },
        {
          testID: 'conversations.dialog.unmatch', text: 'Unmatch',
          style: 'destructive',
          onPress: () =>
            unmatchConversation.mutate(conversationId, {
              onError: () => sheet.show({ title: 'Could not unmatch', message: 'Try again in a moment.', buttons: [{ testID: 'conversations.dialog.ok', text: 'OK' }] }),
            }),
        },
      ],
    })
  }

  function renderRightActions(conversationId: string, otherDisplayName: string) {
    return (
      <Pressable testID={`conversations.unmatch.${conversationId}`} style={styles.unmatchAction} onPress={() => confirmUnmatch(conversationId, otherDisplayName)}>
        <Icon name="X" size={24} color={colors.white} />
        <Text style={styles.unmatchText}>Unmatch</Text>
      </Pressable>
    )
  }

  if (conversations.isError) {
    return (
      <ScreenContainer testID="screen.conversations" width="full">
        <ErrorState testID="conversations.error" subtitle="Couldn't load your messages." onRetry={() => conversations.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.conversations" padded={false} width="full">
      <TopNavigation testID="conversations.header" title="Messages" alignment="left" />
      {!conversations.isLoading && allRows.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, width: '100%', maxWidth: 960, alignSelf: 'center' }}>
          <TextField testID="conversations.search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}
      <FlatList
        data={(conversations.isLoading ? [1, 2, 3, 4, 5] : rows) as any[]}
        keyExtractor={(item) => (typeof item === 'number' ? String(item) : item.id)}
        // Full-bleed scroll box (native scrollbar at the true browser edge);
        // width/centering applied to content instead — see CategoriesScreen.
        contentContainerStyle={[styles.listContent, { width: '100%', maxWidth: 960, alignSelf: 'center' }]}
        onEndReached={() => conversations.hasNextPage && conversations.fetchNextPage()}
        ListEmptyComponent={
          query ? (
            <EmptyState testID="conversations.empty" title="No matches" subtitle={`No conversations match "${search.trim()}".`} />
          ) : (
            <EmptyState testID="conversations.empty" title="No conversations yet" subtitle="Match with someone in Discover to start a conversation." />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          if (typeof item === 'number') {
            return (
              <View style={styles.row}>
                <Skeleton variant="circular" width={56} height={56} style={styles.avatar} />
                <View style={{ flex: 1, gap: spacing.xs, justifyContent: 'center' }}>
                  <Skeleton variant="text" width={120} height={18} />
                  <Skeleton variant="text" width={180} height={14} />
                </View>
              </View>
            )
          }

          const other = item.participants.find((p: any) => p.id !== myProfileId) ?? item.participants[0]
          if (!other) return null

          const isUnread = item.hasUnread

          return (
            <Swipeable renderRightActions={() => renderRightActions(item.id, other.displayName)} overshootRight={false}>
              <Pressable testID={`conversations.row.${item.id}`}
                style={styles.row}
                onPress={() => navigation.navigate('Conversation', { conversationId: item.id, displayName: other.displayName })}
              >
                {other.avatarUrl ? (
                  <Image source={{ uri: other.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarLocked]}>
                    <Text style={styles.avatarLockedText}>{other.displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <View style={styles.rowHeader}>
                    <Typography variant="heading" style={isUnread && { fontWeight: '800', color: colors.ink }}>
                      {other.displayName}
                    </Typography>
                    {item.lastMessageAt && (
                      <Typography variant="label" style={{ color: isUnread ? colors.primary : colors.inkMuted, fontSize: 13 }}>
                        {formatTimeRelative(item.lastMessageAt)}
                      </Typography>
                    )}
                  </View>
                  <View style={styles.rowSub}>
                    <Typography 
                      variant="bodyMuted" 
                      numberOfLines={1} 
                      style={[styles.snippet, isUnread && { color: colors.ink, fontWeight: '600' }]}
                    >
                      {item.lastMessageBody || 'Say hi!'}
                    </Typography>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>
                </View>
              </Pressable>
            </Swipeable>
          )
        }}
      />
      <ActionSheet testID="conversations.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { 
    flexDirection: 'row', 
    paddingVertical: spacing.md, 
    backgroundColor: colors.surface 
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56 + spacing.md,
  },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, marginRight: spacing.md },
  avatarLocked: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarLockedText: { ...type.heading, color: colors.primary },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowSub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snippet: {
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  unmatchAction: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    paddingVertical: spacing.md,
  },
  unmatchText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  }
})
