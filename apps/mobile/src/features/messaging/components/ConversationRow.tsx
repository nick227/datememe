import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { colors, radius, spacing, type } from '../../../theme'

export type ConversationRowProps = {
  conversationId: string
  otherDisplayName: string
  otherAvatarUrl?: string | null
  lastMessageBody?: string | null
  lastMessageAt?: string | null
  isUnread?: boolean
  onPress: () => void
  onUnmatch: () => void
}

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

export function ConversationRow({
  conversationId,
  otherDisplayName,
  otherAvatarUrl,
  lastMessageBody,
  lastMessageAt,
  isUnread,
  onPress,
  onUnmatch,
}: ConversationRowProps) {
  function renderRightActions() {
    return (
      <Pressable testID={`conversations.unmatch.${conversationId}`} style={styles.unmatchAction} onPress={onUnmatch}>
        <Icon name="X" size={24} color={colors.white} />
        <Text style={styles.unmatchText}>Unmatch</Text>
      </Pressable>
    )
  }

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable testID={`conversations.row.${conversationId}`} style={styles.row} onPress={onPress}>
        {otherAvatarUrl ? (
          <Image source={{ uri: otherAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarLocked]}>
            <Text style={styles.avatarLockedText}>{otherDisplayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.contentColumn}>
          <View style={styles.rowHeader}>
            <Typography variant="heading" numberOfLines={1} style={[styles.name, isUnread && styles.unreadName]}>
              {otherDisplayName}
            </Typography>
            {lastMessageAt && (
              <Typography variant="label" numberOfLines={1} style={[styles.time, isUnread && styles.unreadTime]}>
                {formatTimeRelative(lastMessageAt)}
              </Typography>
            )}
          </View>
          <View style={styles.rowSub}>
            <Typography 
              variant="bodyMuted" 
              numberOfLines={1} 
              style={[styles.snippet, isUnread && styles.unreadSnippet]}
            >
              {lastMessageBody || 'Say hi!'}
            </Typography>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical: spacing.md, 
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: radius.pill, 
    marginRight: spacing.md 
  },
  avatarLocked: { 
    backgroundColor: colors.primarySoft, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  avatarLockedText: { 
    ...type.heading, 
    color: colors.primary 
  },
  contentColumn: { 
    flex: 1, 
    justifyContent: 'center' 
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadName: {
    fontWeight: '800',
    color: colors.ink,
  },
  time: {
    color: colors.inkMuted,
    fontSize: 13,
  },
  unreadTime: {
    color: colors.primary,
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
  unreadSnippet: {
    color: colors.ink,
    fontWeight: '600',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  unmatchAction: {
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  unmatchText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  }
})
