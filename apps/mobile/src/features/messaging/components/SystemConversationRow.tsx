import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Typography } from '../../../ui/Typography'
import { Icon } from '../../../ui/Icon'
import { colors, radius, spacing } from '../../../theme'

export type SystemConversationRowProps = {
  conversationId: string
  title: string
  previewText: string
  createdAt?: string | null
  isUnread?: boolean
  onPress: () => void
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

export function SystemConversationRow({
  conversationId,
  title,
  previewText,
  createdAt,
  isUnread,
  onPress,
}: SystemConversationRowProps) {
  return (
    <Pressable testID={`conversations.system.${conversationId}`} style={styles.row} onPress={onPress}>
      <View style={[styles.avatar, isUnread ? styles.avatarUnread : styles.avatarRead]}>
        <Icon name="Bell" size={24} color={isUnread ? colors.white : colors.inkMuted} />
      </View>
      <View style={styles.contentColumn}>
        <View style={styles.rowHeader}>
          <Typography variant="heading" numberOfLines={1} style={[styles.name, isUnread && styles.unreadText]}>
            {title}
          </Typography>
          {createdAt && (
            <Typography variant="label" numberOfLines={1} style={[styles.time, isUnread && styles.unreadTime]}>
              {formatTimeRelative(createdAt)}
            </Typography>
          )}
        </View>
        <View style={styles.rowSub}>
          <Typography 
            variant="bodyMuted" 
            numberOfLines={1} 
            style={[styles.snippet, isUnread && styles.unreadSnippet]}
          >
            {previewText}
          </Typography>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </Pressable>
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
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarRead: {
    backgroundColor: colors.surfaceMuted,
  },
  avatarUnread: {
    backgroundColor: colors.primary,
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
  unreadText: {
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
  }
})
