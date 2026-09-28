import { useEffect, useState } from 'react'
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAdminLists, type AdminListRow, type AdminListsQuery } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { SelectField } from '../../../ui/SelectField'
import { Skeleton } from '../../../ui/Skeleton'
import { EmptyState } from '../../../ui/EmptyState'
import { ErrorState } from '../../../ui/ErrorState'
import { Typography } from '../../../ui/Typography'
import { borderWidth, colors, spacing } from '../../../theme'
import type { AdminStackParamList } from '../../../navigation/types'

// Admin → Lists: find any list in seconds (docs/admin-lists-roadmap.md §3.1).

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminLists'>
type Status = NonNullable<AdminListsQuery['status']>
type Sort = NonNullable<AdminListsQuery['sort']>

const STATUSES: { id: Status; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'attention', label: 'Needs attention' },
]
const SORTS: { value: Sort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'az', label: 'A–Z' },
  { value: 'takes', label: 'Most taken' },
]
const PROBLEM_LABEL: Record<NonNullable<AdminListRow['problem']>, string> = {
  cover: '⚠ Cover',
  'cover-failed': '⚠ Cover failed',
  values: '⚠ Needs values',
  duplicate: '⚠ Duplicate',
  'too-broad': '⚠ Too broad',
  'weak-cover': '⚠ Weak cover',
  'wrong-group': '⚠ Wrong group',
  'low-takes': '⚠ No takes',
}

export function AdminListsScreen({ navigation }: Props) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [groupId, setGroupId] = useState('')
  const [sort, setSort] = useState<Sort>('updated')

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(timer)
  }, [text])

  const lists = useAdminLists({ q: q || undefined, status, groupId: groupId || undefined, sort, limit: 200 })
  const groupOptions = [{ label: 'All groups', value: '' }, ...(lists.data?.groups ?? []).map((g) => ({ label: `${g.label} (${g.count})`, value: g.id }))]

  return (
    <ScreenContainer testID="screen.admin-lists" width="standard">
      <TopNavigation testID="admin-lists.header"
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title="Lists"
        subtitle={lists.data ? `${lists.data.total} ${lists.data.total === 1 ? 'list' : 'lists'}` : undefined}
        rightElement={
          <Pressable testID="admin-lists.new" hitSlop={12} onPress={() => navigation.navigate('AdminListDetail', undefined)}>
            <Typography variant="button" style={styles.newLink}>+ New</Typography>
          </Pressable>
        }
      />

      <TextField testID="admin-lists.search" placeholder="Search lists…" value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />

      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Pressable key={s.id} testID={`admin-lists.status.${s.id}`} style={[styles.chip, status === s.id && styles.chipOn]} onPress={() => setStatus(s.id)}>
            <Typography variant="label" style={status === s.id ? styles.chipTextOn : styles.chipText}>{s.label}</Typography>
          </Pressable>
        ))}
      </View>

      <View style={styles.filters}>
        <SelectField testID="admin-lists.group" style={styles.filter} value={groupId} options={groupOptions} onSelect={setGroupId} placeholder="All groups" />
        <SelectField testID="admin-lists.sort" style={styles.filter} value={sort} options={SORTS} onSelect={(v) => setSort(v as Sort)} />
      </View>

      {lists.isLoading ? (
        <View style={{ gap: spacing.md }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={72} />)}
        </View>
      ) : lists.isError ? (
        <ErrorState testID="admin-lists.error" subtitle="Couldn't load lists." onRetry={() => lists.refetch()} />
      ) : !lists.data?.items.length ? (
        <EmptyState testID="admin-lists.empty" title="No lists match" subtitle={q || status !== 'all' || groupId ? 'Try a different search or filter.' : 'Create one with + New.'} />
      ) : (
        <FlatList
          data={lists.data.items}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <ListRow item={item} onPress={() => navigation.navigate('AdminListDetail', { listId: item.id })} />}
        />
      )}
    </ScreenContainer>
  )
}

function ListRow({ item, onPress }: { item: AdminListRow; onPress: () => void }) {
  const badge = item.problem ? PROBLEM_LABEL[item.problem] : item.isActive ? 'Live' : item.neverPublished ? 'Hidden · Never published' : 'Hidden'
  return (
    <Pressable testID={`admin-lists.row.${item.slug}`} style={styles.row} onPress={onPress}>
      <View style={styles.thumb}>
        {item.imageCardUrl ? <Image source={{ uri: item.imageCardUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="body" numberOfLines={1} style={styles.title}>{item.title}</Typography>
        <Typography variant="bodyMuted" numberOfLines={1}>
          {item.group.label} · {item.valueCount} {item.valueCount === 1 ? 'value' : 'values'} · {item.takes} {item.takes === 1 ? 'take' : 'takes'}
        </Typography>
      </View>
      <Typography variant="label" style={[styles.badge, item.problem ? styles.badgeProblem : item.isActive ? styles.badgeLive : null]} numberOfLines={1}>
        {badge}
      </Typography>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  newLink: { color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { borderWidth: borderWidth.thin, borderColor: colors.ink, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.ink },
  chipText: { color: colors.ink },
  chipTextOn: { color: colors.white },
  filters: { flexDirection: 'row', gap: spacing.sm },
  filter: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  thumb: { width: 48, height: 64, backgroundColor: colors.surfaceMuted, borderWidth: borderWidth.thin, borderColor: colors.border, overflow: 'hidden' },
  title: { fontFamily: 'PlusJakartaSans_700Bold' },
  badge: { color: colors.inkMuted, maxWidth: 140, textAlign: 'right' },
  badgeLive: { color: colors.ink },
  badgeProblem: { color: colors.danger },
  separator: { height: 1, backgroundColor: colors.border },
})
