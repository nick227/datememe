import { useEffect, useRef, useState } from 'react'
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategory, useCategoryEntities, useMyLists, useSubmitEntity, useUpsertList } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { SearchBar } from '../components/SearchBar'
import { PickedChip } from '../components/PickedChip'
import { EntityRow } from '../components/EntityRow'
import { Button } from '../../../ui/Button'
import { colors, radius, spacing } from '../../../theme'
import type { CategoriesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<CategoriesStackParamList, 'ListBuilder'>

type PickedItem = { entityId: string; rank: number; name: string; imageUrl?: string | null }

export function ListBuilderScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const category = useCategory(categorySlug)
  const myLists = useMyLists()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [picked, setPicked] = useState<PickedItem[]>([])
  const hydrated = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 50)
    return () => clearTimeout(timer)
  }, [query])

  const entities = useCategoryEntities(categorySlug, { q: debouncedQuery || undefined })
  const submitEntity = useSubmitEntity()
  const upsertList = useUpsertList(categorySlug)

  useEffect(() => {
    if (hydrated.current || !myLists.data) return
    const existing = myLists.data.find((l) => l.category?.slug === categorySlug)
    if (existing) {
      setPicked(
        existing.items
          .slice()
          .sort((a, b) => a.rank - b.rank)
          .map((item) => ({
            entityId: item.entityId,
            rank: item.rank,
            name: item.entity.canonicalName,
            imageUrl: item.entity.imageUrl,
          })),
      )
    }
    hydrated.current = true
  }, [myLists.data, categorySlug])

  const maxItems = category.data?.maxItems ?? 5
  const minItems = category.data?.minItems ?? 1
  const results = entities.data?.pages[0]?.data ?? []

  const hasExactMatch = results.some((r) => r.canonicalName.toLowerCase() === query.trim().toLowerCase())

  function toggle(entityId: string, name: string, imageUrl?: string | null) {
    setPicked((prev) => {
      if (prev.some((p) => p.entityId === entityId)) {
        return prev.filter((p) => p.entityId !== entityId).map((p, i) => ({ ...p, rank: i + 1 }))
      }
      if (prev.length >= maxItems) {
        Alert.alert('That’s the max', `This category only allows ${maxItems}. Remove one to add another.`)
        return prev
      }
      return [...prev, { entityId, rank: prev.length + 1, name, imageUrl }]
    })
  }

  async function handleAddNew() {
    if (!category.data) return
    try {
      const result = await submitEntity.mutateAsync({ entityTypeId: category.data.entityTypeId, rawText: query.trim() })
      toggle(result.submittedEntity.id, result.submittedEntity.canonicalName, result.submittedEntity.imageUrl)
      setQuery('')
    } catch (err: any) {
      Alert.alert('Could not add that', err?.message ?? 'Try again in a moment')
    }
  }

  async function handleSave() {
    try {
      await upsertList.mutateAsync({
        items: picked.map((p) => ({ entityId: p.entityId, rank: p.rank })),
        isComplete: picked.length >= minItems,
      })
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Could not save your list', err?.message ?? 'Try again in a moment')
    }
  }

  return (
    <ScreenContainer width="narrow">
      <TopNavigation
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={category.data?.prompt ?? shortLabel}
      />

      <SearchBar value={query} onChangeText={setQuery} placeholder={`Search ${shortLabel.toLowerCase()}`} />

      {category.data && category.data.requiredTags.length > 0 ? (
        <View style={styles.filterRow}>
          {category.data.requiredTags.map((tag) => (
            <View key={tag.id} style={styles.filterChip}>
              <Typography variant="label" style={styles.filterChipText}>{tag.label}</Typography>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.pickedHeader}>
        <Typography variant="label">
          Picked {picked.length} of {maxItems}
        </Typography>
      </View>
      {picked.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickedRow}>
          {picked.map((p) => (
            <PickedChip key={p.entityId} rank={p.rank} name={p.name} onRemove={() => toggle(p.entityId, p.name, p.imageUrl)} />
          ))}
        </ScrollView>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        style={styles.results}
        renderItem={({ item }) => (
          <EntityRow
            name={item.canonicalName}
            imageUrl={item.imageUrl}
            isPending={item.status === 'PENDING'}
            pickedRank={picked.find((p) => p.entityId === item.id)?.rank ?? null}
            onToggle={() => toggle(item.id, item.canonicalName, item.imageUrl)}
          />
        )}
        ListFooterComponent={
          query.trim().length > 1 && !hasExactMatch ? (
            <Pressable style={styles.addNewRow} onPress={handleAddNew} disabled={submitEntity.isPending}>
              <Typography variant="body" style={styles.addNewText}>
                {submitEntity.isPending ? 'Adding…' : `+ Add "${query.trim()}"`}
              </Typography>
            </Pressable>
          ) : null
        }
      />

      <View style={styles.footer}>
        <Button label="Done" onPress={handleSave} loading={upsertList.isPending} />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterChipText: { color: colors.ink },
  pickedHeader: { marginBottom: spacing.xs },
  pickedRow: { marginBottom: spacing.md },
  results: { flex: 1 },
  addNewRow: { paddingVertical: spacing.md },
  addNewText: { color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
  footer: { paddingTop: spacing.md, paddingBottom: spacing.sm },
})
