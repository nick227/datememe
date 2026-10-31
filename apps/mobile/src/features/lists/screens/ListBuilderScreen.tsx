import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Keyboard, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { ChevronUp, ChevronDown } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategory, useCategoryRankings, useCategoryEntities, useMyLists, useSubmitEntity, useUpsertList } from '@project/sdk'
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
import { openPoll } from '../../../navigation/openPoll'
import type { PollParams } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

// GlobalHeader body, plus the tab bar this screen now sits above.
const WEB_HEADER_CHROME = 52
const WEB_TAB_BAR = 56

type Props = NativeStackScreenProps<{ ListBuilder: PollParams; PollResults: PollParams }, 'ListBuilder'>

type PickedItem = { entityId: string; rank: number; name: string; imageUrl?: string | null }

export function ListBuilderScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const category = useCategory(categorySlug)
  const myLists = useMyLists()
  // Warm results while the user answers; saves refresh this active query.
  useCategoryRankings(categorySlug)
  const isDesktop = useIsDesktop()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const webFrameHeight = Platform.OS === 'web'
    ? Math.max(320, windowHeight - insets.top - WEB_HEADER_CHROME - WEB_TAB_BAR - insets.bottom)
    : undefined

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [picked, setPicked] = useState<PickedItem[]>([])
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isListExpanded, setIsListExpanded] = useState(true)
  const hydrated = useRef(false)
  const dirty = useRef(false)
  const latestSave = useRef<{ key: string; promise: Promise<unknown> } | null>(null)
  const [openingResults, setOpeningResults] = useState(false)
  const sheet = useActionSheet()

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setIsOverlayVisible(query.trim().length > 0)
    }, 50)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const keyboardSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsListExpanded(false)
    )
    return () => keyboardSub.remove()
  }, [])

  const entities = useCategoryEntities(categorySlug, { q: debouncedQuery || undefined })
  const submitEntity = useSubmitEntity()
  const upsertList = useUpsertList(categorySlug)

  useEffect(() => {
    if (hydrated.current || !myLists.data) return
    if (dirty.current) {
      hydrated.current = true
      return
    }
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
  
  const saveAnswers = useCallback(() => {
    const body = {
      items: picked.map((p) => ({ entityId: p.entityId, rank: p.rank })),
      isComplete: picked.length >= minItems,
    }
    const key = JSON.stringify({ categorySlug, ...body })
    if (latestSave.current?.key === key) return latestSave.current.promise

    setSaveError(null)
    const promise = saveListAsync(body).catch((err) => {
      // An older request must not replace feedback for a newer answer.
      if (latestSave.current?.promise === promise) {
        latestSave.current = null
        setSaveError(err?.message ?? 'Couldn’t save')
      }
      throw err
    })
    latestSave.current = { key, promise }
    return promise
  }, [categorySlug, picked, minItems, saveListAsync])

  useEffect(() => {
    // Hydrating an existing list is not an edit. Start real saves immediately,
    // so leaving the editor cannot cancel a pending debounce.
    if (!dirty.current || !category.data) return
    void saveAnswers().catch(() => {})
  }, [saveAnswers, category.data])

  function toggle(entityId: string, name: string, imageUrl?: string | null) {
    if (openingResults || !hydrated.current || !category.data) return
    if (picked.some((p) => p.entityId === entityId)) return
    if (picked.length >= maxItems) {
      sheet.show({ title: 'That’s the max', message: `This category only allows ${maxItems}. Remove one to add another.`, buttons: [{ testID: 'list-builder.dialog.ok', text: 'OK' }] })
      return
    }
    dirty.current = true
    setQuery('')
    setIsOverlayVisible(false)
    Keyboard.dismiss()
    setPicked((prev) => [...prev, { entityId, rank: prev.length + 1, name, imageUrl }])
  }

  function handleRemove(entityId: string) {
    if (openingResults) return
    dirty.current = true
    setPicked((prev) => {
      return prev
        .filter((p) => p.entityId !== entityId)
        .map((p, i) => ({ ...p, rank: i + 1 })) // shift ranks up
    })
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    if (openingResults) return
    dirty.current = true
    setPicked((prev) => {
      const arr = [...prev].sort((a, b) => a.rank - b.rank)
      const [moved] = arr.splice(fromIndex, 1)
      arr.splice(toIndex, 0, moved)
      return arr.map((p, i) => ({ ...p, rank: i + 1 }))
    })
  }

  async function handleSuggestNew(newQuery: string) {
    if (openingResults || !hydrated.current || !category.data) return
    try {
      const result = await submitEntity.mutateAsync({ categorySlug, rawText: newQuery })
      toggle(result.submittedEntity.id, result.submittedEntity.canonicalName, result.submittedEntity.imageUrl)
    } catch (err: any) {
      sheet.show({ title: 'Could not add that', message: err?.message ?? 'Try again in a moment', buttons: [{ testID: 'list-builder.dialog.ok', text: 'OK' }] })
    }
  }

  async function handleDone() {
    if (openingResults || !myLists.data || !category.data) return
    setOpeningResults(true)
    try {
      // Wait only for the latest answer to commit. Results independently
      // track publication and explain any remaining background delay.
      if (dirty.current) await saveAnswers()
      openPollResults()
    } catch {
      // saveAnswers keeps the edits here and exposes the retry banner.
    } finally {
      setOpeningResults(false)
    }
  }

  function handleRetrySave() {
    void handleDone()
  }

  function openPollResults() {
    openPoll(navigation, 'results', { categorySlug, shortLabel: category.data?.shortLabel ?? shortLabel })
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
            actionLabel="results"
            onBack={() => navigation.goBack()}
            onAction={handleDone}
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
            label={openingResults ? 'Opening results...' : 'Done'}
            onPress={handleDone}
            loading={openingResults}
            disabled={!myLists.data || !category.data}
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
    flexShrink: 1,
    zIndex: 2,
  },
  question: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.md,
  },
  questionDesktop: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: 80,
    lineHeight: 95,
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
    minHeight: 120,
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
