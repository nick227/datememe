import { useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { ArrowUpRight, Check, ChevronDown, ChevronUp, ListOrdered } from 'lucide-react-native'
import { Typography } from '../../../ui/Typography'
import { colors, spacing } from '../../../theme'
import { listMatchPercent } from '../../lists/components/PreviewListCard'

type Props = {
  list: any
  ownerName: string
  isOwn?: boolean
  viewerList?: any | null
  onTakePoll: () => void
  onPressRankings: () => void
}

export function ProfileListResponseCard({ list, ownerName, isOwn = false, viewerList, onTakePoll, onPressRankings }: Props) {
  const [expanded, setExpanded] = useState(false)
  const items = [...(list.items ?? [])].sort((a, b) => a.rank - b.rank)
  const ranked = list.category?.orderingMode !== 'UNRANKED'
  const viewerTook = !!viewerList?.items?.length
  const viewerIds = new Set((viewerList?.items ?? []).map((item: any) => item.entityId))
  const sharedCount = items.filter(item => viewerIds.has(item.entityId)).length
  const title = list.category?.shortLabel ?? 'List'

  return (
    <View style={styles.card} testID={`profile-response.${list.id}`}>
      <View style={styles.header}>
        {list.category?.imageUrl ? (
          <Image source={{ uri: list.category.imageUrl }} style={styles.cover} accessibilityLabel={`${title} cover`} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <ListOrdered size={30} color={colors.inkMuted} />
          </View>
        )}
        <View style={styles.heading}>
          <Typography variant="heading">{title}</Typography>
          <Typography variant="bodyMuted">{items.length} {ranked ? 'ranked ' : ''}{items.length === 1 ? 'pick' : 'picks'}</Typography>
        </View>
      </View>

      <View style={styles.pick}>
        <View style={styles.pickMarker}>
          {ranked ? <Typography variant="heading" style={styles.rank}>01</Typography> : <Check size={20} color={colors.accent} />}
        </View>
        <View style={styles.pickText}>
          <Typography variant="bodyMuted">{isOwn ? 'Your' : `${ownerName}’s`} {ranked ? 'top pick' : 'pick'}</Typography>
          <Typography variant="heading" style={styles.pickName}>{items[0]?.entity?.canonicalName ?? 'See their answers'}</Typography>
        </View>
      </View>

      {viewerList !== undefined ? (
        <View style={styles.comparison}>
          {viewerTook ? <Check size={16} color={colors.accent} /> : null}
          <Typography variant="bodyMuted" style={styles.comparisonText}>
            {viewerTook
              ? `${listMatchPercent(list, viewerList)}% overlap · ${sharedCount} shared ${sharedCount === 1 ? 'pick' : 'picks'}`
              : 'You haven’t taken this poll yet'}
          </Typography>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Hide' : 'View'} ${isOwn ? 'your' : `${ownerName}’s`} answers to ${title}`}
          accessibilityState={{ expanded }}
          testID={`profile-response.${list.id}.answers`}
          onPress={() => setExpanded(value => !value)}
          style={({ pressed }) => [styles.button, styles.answersButton, pressed && styles.pressed]}
        >
          <Typography variant="body" style={styles.buttonText}>{expanded ? 'Hide answers' : 'View answers'}</Typography>
          {expanded ? <ChevronUp size={16} color={colors.ink} /> : <ChevronDown size={16} color={colors.ink} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isOwn || viewerTook ? 'Edit your answers to' : 'Take'} ${title}`}
          accessibilityHint="Opens the poll editor"
          testID={`profile-response.${list.id}.take-poll`}
          onPress={onTakePoll}
          style={({ pressed }) => [styles.button, styles.pollButton, pressed && styles.pressed]}
        >
          <Typography variant="body" style={[styles.buttonText, styles.pollText]}>{isOwn || viewerTook ? 'Edit your picks' : 'Take this poll'}</Typography>
          <ArrowUpRight size={16} color={colors.white} />
        </Pressable>
      </View>

      {expanded ? (
        <View style={styles.answers}>
          <Typography variant="heading">{isOwn ? 'Your' : `${ownerName}’s`} answers</Typography>
          {items.map((item: any) => (
            <View key={item.id ?? item.entityId} style={styles.answerRow}>
              {ranked ? <Typography variant="bodyMuted" style={styles.answerRank}>{item.rank}</Typography> : null}
              <Typography style={styles.answerName}>{item.entity?.canonicalName}</Typography>
              {viewerIds.has(item.entityId) ? <Typography variant="bodyMuted" style={styles.shared}>You too</Typography> : null}
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={onPressRankings} style={styles.rankings}>
            <Typography style={styles.buttonText}>View site rankings</Typography>
            <ArrowUpRight size={16} color={colors.ink} />
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  cover: { width: 88, height: 100, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, gap: spacing.sm, minWidth: 0 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: 12 },
  pickMarker: { width: 32, alignItems: 'center' },
  rank: { color: colors.accent, fontSize: 24, lineHeight: 30 },
  pickText: { flex: 1, gap: 2 },
  pickName: { fontSize: 19, lineHeight: 27 },
  comparison: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  comparisonText: { flex: 1, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  button: { flexGrow: 1, flexBasis: 130, minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  answersButton: { borderWidth: 1, borderColor: colors.border },
  pollButton: { backgroundColor: colors.accent },
  buttonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 },
  pollText: { color: colors.white },
  pressed: { opacity: 0.7 },
  answers: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  answerRank: { width: 24 },
  answerName: { flex: 1 },
  shared: { color: colors.accent, fontSize: 12 },
  rankings: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 44 },
})
