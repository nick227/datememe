import { useEffect, useRef, useState } from 'react'
import { FlatList, Keyboard, Platform, Pressable, StyleSheet, useWindowDimensions, View, ScrollView } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { ChevronUp, ChevronDown } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategory, useCategoryEntities, useMyLists, useSubmitEntity, useUpsertList } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { SearchBar } from '../components/SearchBar'
import { RankingBoard } from '../components/RankingBoard'
import { FastPickTile } from '../components/FastPickTile'
import { AutocompleteOverlay } from '../components/AutocompleteOverlay'
import { PollHeader } from '../components/PollHeader'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { colors, spacing } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import type { CategoriesStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

// GlobalHeader body (logo + vertical padding) and the bottom tab bar. The
// builder locks to the leftover viewport on web, where the app shell grows
// with the page instead of clipping to one screen.
const WEB_HEADER_CHROME = 52
const WEB_TAB_CHROME = 49

type Props = NativeStackScreenProps<CategoriesStackParamList, 'ListBuilder'>

type PickedItem = { entityId: string; rank: number; name: string; imageUrl?: string | null }

export function ListBuilderScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const category = useCategory(categorySlug)
  const myLists = useMyLists()
  const isDesktop = useIsDesktop()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const webFrameHeight = Platform.OS === 'web'
    ? Math.max(320, windowHeight - insets.top - WEB_HEADER_CHROME - WEB_TAB_CHROME - insets.bottom)
    : undefined

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [picked, setPicked] = useState<PickedItem[]>([])
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isListExpanded, setIsListExpanded] = useState(true)
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const { mutateAsync: saveListAsync } = upsertList
  
  // Background autosave logic
  useEffect(() => {
    if (!hydrated.current) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)

    saveTimeout.current = setTimeout(() => {
      isSaving.current = true
      setSaveError(null)
      saveListAsync({
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
  }, [picked, minItems, saveListAsync])

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
        sheet.show({ title: 'That’s the max', message: `This category only allows ${maxItems}. Remove one to add another.`, buttons: [{ testID: 'list-builder.dialog.ok', text: 'OK' }] })
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
      const result = await submitEntity.mutateAsync({ categorySlug, rawText: newQuery })
      toggle(result.submittedEntity.id, result.submittedEntity.canonicalName, result.submittedEntity.imageUrl)
    } catch (err: any) {
      sheet.show({ title: 'Could not add that', message: err?.message ?? 'Try again in a moment', buttons: [{ testID: 'list-builder.dialog.ok', text: 'OK' }] })
    }
  }

  async function handleDone() {
    try {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      
      setSaveError(null)
      const isComplete = picked.length >= minItems
      await upsertList.mutateAsync({
        items: picked.map((p) => ({ entityId: p.entityId, rank: p.rank })),
        isComplete,
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

  function openPollResults() {
    const label = category.data?.shortLabel ?? shortLabel
    ;(navigation.getParent()?.navigate as (name: string, params: object) => void)('Rankings', {
      screen: 'CategoryRanking',
      params: { categorySlug, shortLabel: label },
      initial: false,
    })
  }

  // Fast picks are the initial results when no query
  const fastPicks = entities.data?.pages[0]?.data ?? []
  
  // Picked dictionary for O(1) lookups
  const pickedRanks = picked.reduce((acc, p) => ({ ...acc, [p.entityId]: p.rank }), {} as Record<string, number>)

  const RightPane = (
    <Animated.ScrollView 
      style={[styles.rightPane, { maxHeight: isListExpanded ? 280 : 112 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      layout={LinearTransition.duration(200)}
    >
      <RankingBoard
        items={picked}
        maxItems={maxItems}
        onRemove={handleRemove}
        onReorder={handleReorder}
      />
    </Animated.ScrollView>
  )

  const question = category.data?.prompt ?? shortLabel

  return (
    <ScreenContainer testID="screen.list-builder" width="narrow">
      <View style={[styles.frame, webFrameHeight != null && { height: webFrameHeight }]}>
        <View style={styles.chrome}>
          <PollHeader
            testID="list-builder.header"
            takeCount={category.data?.popularityCount}
            onBack={() => navigation.goBack()}
            onViewResults={openPollResults}
          />
          <Typography
            testID="list-builder.question"
            variant="title"
            style={isDesktop ? styles.questionDesktop : styles.question}
          >
            {question}
          </Typography>
          {RightPane}
          {maxItems > 2 && (
            <Pressable
              testID="list-builder.toggle"
              style={styles.toggleButton}
              hitSlop={12}
              onPress={() => setIsListExpanded(prev => !prev)}
            >
              {isListExpanded ? (
                <ChevronUp size={24} color={colors.inkMuted} />
              ) : (
                <ChevronDown size={24} color={colors.inkMuted} />
              )}
            </Pressable>
          )}
          <View style={styles.searchWrapper}>
            <SearchBar testID="list-builder.search" value={query} onChangeText={setQuery} placeholder="Type your own..." />
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
        </View>
        <FlatList
          style={styles.values}
          data={fastPicks}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.fastPicksList}
          renderItem={({ item }) => (
            <FastPickTile testID={`list-builder.pick.${item.id}`}
              name={item.canonicalName}
              imageUrl={item.imageUrl}
              isPending={item.status === 'PENDING'}
              pickedRank={pickedRanks[item.id] ?? null}
              onToggle={() => toggle(item.id, item.canonicalName, item.imageUrl)}
            />
          )}
        />
        <View style={styles.footer}>
          {saveError && (
            <View testID="list-builder.save-error" style={styles.errorRow}>
              <Typography variant="body" style={styles.errorText}>
                {saveError}
              </Typography>
              <Pressable testID="list-builder.retry-save" onPress={handleRetrySave}>
                <Typography variant="button" style={styles.retryText}>Retry</Typography>
              </Pressable>
            </View>
          )}
          <Button testID="list-builder.done"
            label={upsertList.isPending ? 'Saving...' : 'Done'}
            onPress={handleDone}
            loading={upsertList.isPending}
          />
        </View>
      </View>
      <ActionSheet testID="list-builder.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  chrome: {
    flexShrink: 0,
    zIndex: 2,
  },
  question: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  questionDesktop: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1,
  },
  rightPane: {
    zIndex: 1,
    flexShrink: 1,
  },
  toggleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    width: '100%',
    zIndex: 1,
  },
  searchWrapper: {
    marginTop: spacing.md,
    zIndex: 100,
  },
  values: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  fastPicksList: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  footer: {
    flexShrink: 0,
    zIndex: 2,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
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
