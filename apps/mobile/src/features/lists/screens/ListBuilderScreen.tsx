import { usePageTitle } from '../../../navigation/usePageTitle'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Keyboard, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import type { ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useCategory, useCategoryRankings, useCategoryEntities, useMyLists, useSubmitEntity, useUpsertList } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { SearchBar } from '../components/SearchBar'
import { RankingBoard } from '../components/RankingBoard'
import { FastPickTile } from '../components/FastPickTile'
import { PollHeader } from '../components/PollHeader'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { colors, spacing } from '../../../theme'
import { useIsDesktop } from '../../../lib/useResponsive'
import { openPoll } from '../../../navigation/openPoll'
import type { PollParams } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

// GlobalHeader body, plus the tab bar this screen now sits above.
const WEB_HEADER_CHROME = 53
const WEB_TAB_BAR = 56

type Props = NativeStackScreenProps<{ ListBuilder: PollParams; PollResults: PollParams }, 'ListBuilder'>

type PickedItem = { entityId: string; rank: number; name: string; imageUrl?: string | null }

export function ListBuilderScreen({ route, navigation }: Props) {
  const { categorySlug, shortLabel } = route.params
  const category = useCategory(categorySlug)
  usePageTitle(category.data?.shortLabel ? `${category.data.shortLabel} — Build Your List` : undefined)
  const myLists = useMyLists()
  // Warm results while the user answers; saves refresh this active query.
  useCategoryRankings(categorySlug)
  const isDesktop = useIsDesktop()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [picked, setPicked] = useState<PickedItem[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const searchRef = useRef<TextInput>(null)
  const listRef = useRef<FlatList>(null)
  const searchOffset = useRef(0)
  const discoveryRef = useRef<View>(null)
  const [rankingHeight, setRankingHeight] = useState(0)
  const hydrated = useRef(false)
  const dirty = useRef(false)
  const latestSave = useRef<{ key: string; promise: Promise<unknown> } | null>(null)
  const [openingResults, setOpeningResults] = useState(false)
  const sheet = useActionSheet()

  useEffect(() => {
    if (Platform.OS !== 'web' || !isFocused) return
    // Navigation's web fallbacks use absolute screen layers and a clipped tab
    // container. This page needs normal document flow for browser scrolling
    // and sticky ranks; scope the override to its ancestors while focused.
    const style = document.createElement('style')
    style.textContent = `
      div:has([data-testid="screen.list-builder"]) {
        position: relative !important;
        overflow: visible !important;
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [isFocused])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 50)
    return () => clearTimeout(timer)
  }, [query])

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
    if (openingResults || toIndex < 0 || toIndex >= picked.length) return
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

  const question = category.data?.prompt ?? shortLabel
  const searching = query.trim().length > 0
  const full = picked.length >= maxItems
  const hasExactMatch = results.some((item) => item.canonicalName.toLowerCase() === query.trim().toLowerCase())
  const editingDisabled = openingResults || !myLists.data || !category.data
  const focusSearch = () => {
    if (Platform.OS !== 'web') listRef.current?.scrollToOffset({ offset: searchOffset.current, animated: false })
    searchRef.current?.focus()
    if (Platform.OS === 'web') {
      (discoveryRef.current as unknown as HTMLElement | null)?.scrollIntoView({ block: 'start' })
    }
  }

  // Keep the complete ranking reachable on short viewports before it sticks.
  const rankingTop = Math.min(insets.top + WEB_HEADER_CHROME, windowHeight - rankingHeight - WEB_TAB_BAR - insets.bottom - 120)
  const questionHeader = (
    <View>
      <PollHeader
        testID="list-builder.header"
        takeCount={category.data?.popularityCount}
        actionLabel="View results"
        outlinedAction
        onBack={() => navigation.goBack()}
        onAction={handleDone}
      />
      <Typography testID="list-builder.question" variant="title"
        style={isDesktop ? styles.questionDesktop : styles.question}>
        {question}
      </Typography>
    </View>
  )
  const rankingEditor = (
    <View onLayout={(event) => setRankingHeight(event.nativeEvent.layout.height)} style={[styles.rankingPanel, Platform.OS === 'web' && { position: 'sticky', top: rankingTop, zIndex: 2, backgroundColor: colors.canvas } as unknown as ViewStyle]}>
      <View style={styles.sectionHeader}>
        <Typography variant="heading">Your ranking</Typography>
        <Typography variant="bodyMuted" accessibilityLiveRegion="polite">
          {picked.length} of {maxItems} selected
        </Typography>
      </View>
      <RankingBoard items={picked} maxItems={maxItems}
        onRemove={handleRemove} onReorder={handleReorder} onAdd={focusSearch} />
    </View>

  )
  const discoveryHeader = (
    <View style={styles.libraryHeader} onLayout={(event) => { searchOffset.current = event.nativeEvent.layout.y }}>
      <View style={styles.sectionHeader}>
        <Typography variant="heading">Find your picks</Typography>
        <Typography variant="bodyMuted">
          {full ? 'List full' : `Add ${maxItems - picked.length} more`}
        </Typography>
      </View>
      <SearchBar inputRef={searchRef} testID="list-builder.search" value={query}
        onChangeText={setQuery} placeholder="Search answers or add your own…" />
    </View>
  )
  const emptyAnswers = (
    <Typography variant="bodyMuted" style={styles.emptyText}>
      {entities.isLoading || query.trim() !== debouncedQuery ? 'Searching…' : entities.isError
        ? 'Couldn’t load answers. Try searching again.'
        : searching ? 'No matching answers.' : 'Start by searching for your first pick.'}
    </Typography>
  )
  const newAnswer = searching && query.trim().length > 1 && query.trim() === debouncedQuery && !entities.isLoading && !entities.isError && !hasExactMatch ? (
    <Pressable testID="list-builder.suggest-new" accessibilityRole="button"
      disabled={editingDisabled || full || submitEntity.isPending}
      style={[styles.addNew, (full || submitEntity.isPending) && styles.disabled]}
      onPress={() => handleSuggestNew(query.trim())}>
      <Typography variant="body" style={styles.accentText}>
        {submitEntity.isPending ? 'Adding answer…' : `Add “${query.trim()}” as a new answer`}
      </Typography>
    </Pressable>
  ) : null
  const renderAnswer = (item: (typeof fastPicks)[number]) => (
    <View key={item.id} style={[styles.tileCell, Platform.OS === 'web' && (isDesktop ? styles.webTileDesktop : styles.webTile)]}>
      <FastPickTile testID={searching ? `list-builder.suggestion.${item.id}` : `list-builder.pick.${item.id}`}
        name={item.canonicalName}
        isPending={item.status === 'PENDING'}
        pickedRank={pickedRanks[item.id] ?? null}
        disabled={editingDisabled || full}
        onToggle={() => toggle(item.id, item.canonicalName, item.imageUrl)}
      />
    </View>
  )

  return (
    <ScreenContainer testID="screen.list-builder" width="narrow">
      <View style={[styles.frame, Platform.OS === 'web' && styles.webFrame]}>
        {Platform.OS === 'web' ? (
          <>
            {questionHeader}
            {rankingEditor}
            <View ref={discoveryRef} style={{ scrollMarginTop: Math.max(0, rankingTop) + rankingHeight } as unknown as ViewStyle}>
              {discoveryHeader}
              <View style={styles.webGrid}>
                {fastPicks.map(renderAnswer)}
              </View>
              {fastPicks.length === 0 && emptyAnswers}
              {newAnswer}
            </View>
          </>
        ) : (
          <FlatList
            ref={listRef}
            key={isDesktop ? 'desktop' : 'mobile'}
            numColumns={isDesktop ? 2 : 1}
            columnWrapperStyle={isDesktop ? styles.columns : undefined}
            style={styles.values}
            data={fastPicks}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            ListHeaderComponent={<View>{questionHeader}{rankingEditor}{discoveryHeader}</View>}
            renderItem={({ item }) => renderAnswer(item)}
            ListEmptyComponent={emptyAnswers}
            ListFooterComponent={newAnswer}
          />
        )}
        <View style={[styles.footer, Platform.OS === 'web' && { position: 'sticky', bottom: WEB_TAB_BAR + insets.bottom, zIndex: 3 } as unknown as ViewStyle]}>
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
            label={openingResults ? 'Saving...' : 'Done'}
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
  frame: { flex: 1, minHeight: 0, maxWidth: 960, width: '100%', alignSelf: 'center' },
  webFrame: { flex: 0, overflow: 'visible' },
  webGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xl },
  webTile: { flexBasis: '100%', flexGrow: 0, flexShrink: 0 },
  webTileDesktop: { flexBasis: 'calc((100% - 24px) / 2)', flexGrow: 0, flexShrink: 0 } as unknown as ViewStyle,
  values: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto', minHeight: 0 },
  content: { paddingBottom: spacing.sm },
  question: { marginTop: spacing.xl, fontSize: 32, lineHeight: 37, letterSpacing: -1, marginBottom: spacing.xxl },
  questionDesktop: { marginTop: spacing.xl, fontSize: 48, lineHeight: 52, letterSpacing: -1.8, maxWidth: 840, marginBottom: spacing.xxl },
  rankingPanel: { paddingBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  libraryHeader: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.xl },
  columns: { gap: spacing.xl },
  tileCell: { flex: 1, minWidth: 0, marginBottom: spacing.sm },
  emptyText: { paddingVertical: spacing.lg },
  addNew: { padding: spacing.lg, borderWidth: 1, borderColor: colors.accent, borderRadius: 12, marginTop: spacing.sm },
  accentText: { color: colors.accent },
  disabled: { opacity: 0.5 },
  footer: { flexShrink: 0, paddingTop: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.canvas },
  errorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  errorText: { color: colors.danger },
  retryText: { color: colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold' },
})
