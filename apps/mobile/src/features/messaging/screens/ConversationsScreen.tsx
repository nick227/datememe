import { useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useConversations, useCurrentUser, useUnmatchConversation } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { PageHeader } from '../../../ui/content/PageHeader'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { TextField } from '../../../ui/TextField'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { CANVAS_WIDTH, colors, type, spacing } from '../../../theme'
import { hapticMedium } from '../../../lib/haptics'
import { ConversationRow } from '../components/ConversationRow'
import { SystemConversationRow } from '../components/SystemConversationRow'
import { ConversationRowSkeleton } from '../components/ConversationRowSkeleton'
import type { MessagesStackParamList } from '../../../navigation/types'

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>



export function ConversationsScreen({ navigation }: Props) {
  const me = useCurrentUser()
  const myProfileId = me.data?.profile?.id
  const conversations = useConversations()
  const unmatchConversation = useUnmatchConversation()
  const sheet = useActionSheet()
  const [search, setSearch] = useState('')
  const allRows = conversations.data?.pages.flatMap((p) => p.data) ?? []
  
  // Enforce sort rule: unread human > recent human > unread system > recent system
  const sortedRows = [...allRows].sort((a: any, b: any) => {
    // 1. Rank Unread Human
    const aHumanUnread = a.type !== 'SYSTEM' && a.hasUnread
    const bHumanUnread = b.type !== 'SYSTEM' && b.hasUnread
    if (aHumanUnread && !bHumanUnread) return -1
    if (bHumanUnread && !aHumanUnread) return 1

    // 2. Rank Type (Human > System)
    if (a.type !== 'SYSTEM' && b.type === 'SYSTEM') return -1
    if (b.type !== 'SYSTEM' && a.type === 'SYSTEM') return 1

    // 3. Rank Recent (Time)
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bTime - aTime
  })

  const query = search.trim().toLowerCase()
  const rows = query
    ? sortedRows.filter((item) => {
        const other = item.participants.find((p: any) => p.id !== myProfileId) ?? item.participants[0]
        return (
          other?.displayName?.toLowerCase().includes(query) ||
          item.lastMessageBody?.toLowerCase().includes(query)
        )
      })
    : allRows

  const unreadCount = allRows.filter((r) => r.hasUnread).length
  const pageFacts = [
    { value: allRows.length, label: allRows.length === 1 ? 'conversation' : 'conversations' },
    { value: unreadCount, label: 'unread' },
  ]

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



  if (conversations.isError) {
    return (
      <ScreenContainer testID="screen.conversations" width="full">
        <ErrorState testID="conversations.error" subtitle="Couldn't load your messages." onRetry={() => conversations.refetch()} />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer testID="screen.conversations" padded={false} width="full">
      <FlatList
        data={(conversations.isLoading ? [1, 2, 3, 4, 5] : rows) as any[]}
        keyExtractor={(item) => (typeof item === 'number' ? String(item) : item.id)}
        // Full-bleed scroll box, constrained content width
        contentContainerStyle={[styles.listContent, { width: '100%', maxWidth: CANVAS_WIDTH, alignSelf: 'center' }]}
        onEndReached={() => conversations.hasNextPage && conversations.fetchNextPage()}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <PageHeader
              title="Messages"
              facts={pageFacts}
              sectionTitle="Conversations"
              sectionAction={<Text style={styles.dropdownPlaceholder}>ALL ▾</Text>}
            />
            {!conversations.isLoading && allRows.length > 0 && (
              <View style={styles.searchContainer}>
                <TextField testID="conversations.search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search messages"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          query ? (
            <EmptyState testID="conversations.empty" title="No matches" subtitle={`No conversations match "${search.trim()}".`} />
          ) : (
            <EmptyState testID="conversations.empty" title="No conversations yet" subtitle="When you match with someone, your conversations will appear here." />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          if (typeof item === 'number') {
            return <ConversationRowSkeleton />
          }

          if (item.type === 'SYSTEM') {
            return (
              <SystemConversationRow
                conversationId={item.id}
                title="Datememe"
                previewText={item.lastMessageBody || 'New updates available'}
                createdAt={item.lastMessageAt}
                isUnread={item.hasUnread}
                onPress={() => navigation.navigate('Conversation', { conversationId: item.id, displayName: 'Datememe' })}
              />
            )
          }

          const other = item.participants?.find((p: any) => p.id !== myProfileId) ?? item.participants?.[0]
          if (!other) return null

          return (
            <ConversationRow
              conversationId={item.id}
              otherDisplayName={other.displayName}
              otherAvatarUrl={other.avatarUrl}
              lastMessageBody={item.lastMessageBody}
              lastMessageAt={item.lastMessageAt}
              isUnread={item.hasUnread}
              onPress={() => navigation.navigate('Conversation', { conversationId: item.id, displayName: other.displayName })}
              onUnmatch={() => confirmUnmatch(item.id, other.displayName)}
            />
          )
        }}
      />
      <ActionSheet testID="conversations.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xxl },
  headerContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  searchContainer: { 
    paddingHorizontal: spacing.lg, 
    marginBottom: spacing.md 
  },
  dropdownPlaceholder: {
    ...type.label,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56 + spacing.md + spacing.lg,
    maxWidth: 800 - (56 + spacing.md + spacing.lg),
    width: '100%',
    alignSelf: 'center',
  }
})
