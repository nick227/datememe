import { useEffect, useRef, useState } from 'react'
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategory, useCategoryEntities, useMyLists, useSubmitEntity, useUpsertList } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { SearchBar } from '../components/SearchBar'
import { RankingBoard } from '../components/RankingBoard'
import { FastPickTile } from '../components/FastPickTile'
import { AutocompleteOverlay } from '../components/AutocompleteOverlay'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
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
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hydrated = useRef(false)
  const isSaving = useRef(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sheet = useActionSheet()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setIsOverlayVisible(query.trim().length > 0)
    }, 50)
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

  // Background autosave logic
  useEffect(() => {
    if (!hydrated.current) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    saveTimeout.current = setTimeout(() => {
      isSaving.current = true
      setSaveError(null)
      upsertList.mutateAsync({
        items: picked.map((p) => ({ entityId: p.entityId, rank: p.rank })),
        isComplete: picked.length >= minItems,
      }).catch((err) => {
        setSaveError(err?.message ?? 'Couldn’t save')
      }).finally(() => {
        isSaving.current = false
      })
    }, 1000)

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [picked, minItems])

  function toggle(entityId: string, name: string, imageUrl?: string | null) {
    setPicked((prev) => {
      if (prev.some((p) => p.entityId === entityId)) {
        // We do not remove on toggle anymore if they select from fast picks, but this toggle handles unpicking if forced
        // Wait, redesign says fast picks don't unpick on tap? 
        // Actually it says "require explicit remove/reorder first". 
        // We will just return prev if they tap an already picked item.
        return prev
      }
      if (prev.length >= maxItems) {
        sheet.show({ title: 'That’s the max', message: `This category only allows ${maxItems}. Remove one to add another.`, buttons: [{ text: 'OK' }] })
        return prev
      }
      // Hide overlay and clear query
      setQuery('')
      setIsOverlayVisible(false)
      Keyboard.dismiss()
      return [...prev, { entityId, rank: prev.length + 1, name, imageUrl }]
    })
  }

  function handleRemove(entityId: string) {
    setPicked((prev) => {
      return prev
        .filter((p) => p.entityId !== entityId)
        .map((p, i) => ({ ...p, rank: i + 1 })) // shift ranks up
    })
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    setPicked((prev) => {
      const arr = [...prev].sort((a, b) => a.rank - b.rank)
      const [moved] = arr.splice(fromIndex, 1)
      arr.splice(toIndex, 0, moved)
      return arr.map((p, i) => ({ ...p, rank: i + 1 }))
    })
  }

  async function handleSuggestNew(newQuery: string) {
    if (!category.data) return
    try {
      const result = await submitEntity.mutateAsync({ entityTypeId: category.data.entityTypeId, rawText: newQuery })
      toggle(result.submittedEntity.id, result.submittedEntity.canonicalName, result.submittedEntity.imageUrl)
    } catch (err: any) {
      sheet.show({ title: 'Could not add that', message: err?.message ?? 'Try again in a moment', buttons: [{ text: 'OK' }] })
    }
  }

  async function handleDone() {
    try {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      
      setSaveError(null)
      await upsertList.mutateAsync({
        items: picked.map((p) => ({ entityId: p.entityId, rank: p.rank })),
        isComplete: picked.length >= minItems,
      })
      navigation.goBack()
    } catch (err: any) {
      // The inline error banner (rendered below, with its own retry action)
      // is the real feedback here — it already worked on web; a second,
      // redundant Alert.alert never did.
      setSaveError(err?.message ?? 'Couldn’t save')
    }
  }
  
  function handleRetrySave() {
    handleDone()
  }

  // Fast picks are the initial results when no query
  const fastPicks = entities.data?.pages[0]?.data ?? []
  
  // Picked dictionary for O(1) lookups
  const pickedRanks = picked.reduce((acc, p) => ({ ...acc, [p.entityId]: p.rank }), {} as Record<string, number>)

  const LeftPane = (
    <View style={styles.leftPane}>
      <View style={styles.searchWrapper}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={`Type an artist name...`} />
        {isOverlayVisible && (
          <AutocompleteOverlay
            query={query}
            results={results}
            pickedRanks={pickedRanks}
            onToggle={toggle}
            onSuggestNew={handleSuggestNew}
            isPendingNew={submitEntity.isPending}
          />
        )}
      </View>
      
      {category.data && category.data.requiredTags.length > 0 && (
        <View style={styles.filterRow}>
          {category.data.requiredTags.map((tag) => (
            <View key={tag.id} style={styles.filterChip}>
              <Typography variant="label" style={styles.filterChipText}>{tag.label}</Typography>
            </View>
          ))}
        </View>
      )}

      <FlatList
        data={fastPicks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.fastPicksList}
        renderItem={({ item }) => (
          <FastPickTile
            name={item.canonicalName}
            imageUrl={item.imageUrl}
            isPending={item.status === 'PENDING'}
            pickedRank={pickedRanks[item.id] ?? null}
            onToggle={() => toggle(item.id, item.canonicalName, item.imageUrl)}
          />
        )}
      />
    </View>
  )

  const RightPane = (
    <View style={styles.rightPane}>
      <RankingBoard
        items={picked}
        maxItems={maxItems}
        onRemove={handleRemove}
        onReorder={handleReorder}
      />
    </View>
  )

  return (
    <ScreenContainer width="narrow">
      <TopNavigation
        alignment="left"
        leftAction="back"
        onLeftAction={() => navigation.goBack()}
        title={category.data?.prompt ?? shortLabel}
      />
      <View style={styles.content}>
        {RightPane}
        {LeftPane}
      </View>
      <View style={styles.footer}>
        {saveError && (
          <View style={styles.errorRow}>
            <Typography variant="body" style={styles.errorText}>
              {saveError}
            </Typography>
            <Pressable onPress={handleRetrySave}>
              <Typography variant="button" style={styles.retryText}>Retry</Typography>
            </Pressable>
          </View>
        )}
        <Button
          label={upsertList.isPending ? 'Saving...' : 'Done'}
          onPress={handleDone}
          loading={upsertList.isPending}
        />
      </View>
      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  leftPane: {
    zIndex: 10,
    flex: 1,
  },
  rightPane: {
    minHeight: 350,
    zIndex: 1,
  },
  searchWrapper: {
    marginBottom: spacing.md,
    zIndex: 100,
  },
  fastPicksList: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
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
  footer: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  errorText: { color: colors.danger },
  retryText: { color: colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
})
