import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { useNextQuickPick, useSubmitQuickPickChoice } from '@project/sdk'
import { Typography } from '../Typography'
import { PressableScale } from '../PressableScale'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { colors, spacing } from '../../theme'

type Entity = { id: string; imageUrl: string | null; canonicalName: string }
type Representative = { profileId: string; displayName: string; avatarUrl: string | null }
type Result = {
  winnerEntityId: string
  winnerPercent: number
  loserPercent: number
  totalComparisons: number
  winnerOverallWinRate: number | null
  loserOverallWinRate: number | null
}

/**
 * A real, persisted preference signal (QuickPickSignal) — never a ranked-
 * list write. Deliberately bounded: one comparison, then an immediate result
 * showing how that choice compares to the rest of the site — not an
 * infinite loop. Recurrence comes from this module reappearing fresh
 * further down the feed, not from looping in place.
 *
 * No hard-coded taxonomy: it renders whatever pair /quick-picks/next
 * returns, so a new, more specific Category is all it takes to go deeper.
 *
 * `peopleMode` (Discover): comparing two bare things doesn't fit a page
 * about people — each option is grounded in a real candidate who prefers
 * it (photo + "Prefers X" caption), so the choice is legibly about people's
 * preferences, not an abstract taxonomy quiz. Falls back to the plain
 * entity tile whenever no representative was found for that prompt.
 */
export function QuickPicksSpotlight({ moduleId, peopleMode = false }: { moduleId: string; peopleMode?: boolean }) {
  const prompt = useNextQuickPick(moduleId, peopleMode ? 'discover' : undefined)
  const submitChoice = useSubmitQuickPickChoice()
  const [picked, setPicked] = useState<Entity | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  function choose(winner: Entity, loser: Entity, contextType: string, contextId: string) {
    if (picked) return
    setPicked(winner)
    submitChoice.mutate(
      { contextType, contextId, winnerEntityId: winner.id, loserEntityId: loser.id },
      { onSuccess: (data) => data && setResult(data) },
    )
  }

  return (
    <View testID={`feed.module.${moduleId}`} style={styles.section}>
      <Typography variant="label" style={styles.eyebrow}>
        Quick Picks
      </Typography>

      {prompt.isLoading ? (
        <Skeleton variant="rect" width="100%" height={380} />
      ) : prompt.isError || !prompt.data ? (
        <View style={styles.emptyWrap}>
          <EmptyState title="No quiz prompts yet" subtitle="Check back once more categories are live." />
        </View>
      ) : (() => {
        const data: any = prompt.data
        return (
        <>
          <Typography variant="heading" style={styles.prompt}>
            {data.prompt}
          </Typography>
          <View style={styles.optionsRow}>
            <QuickPickOption
              entity={data.optionA}
              representative={data.optionARepresentative ?? null}
              picked={picked}
              result={result}
              onPress={() => choose(data.optionA, data.optionB, data.contextType, data.contextId)}
            />
            <Typography variant="title" style={styles.or}>
              or
            </Typography>
            <QuickPickOption
              entity={data.optionB}
              representative={data.optionBRepresentative ?? null}
              picked={picked}
              result={result}
              onPress={() => choose(data.optionB, data.optionA, data.contextType, data.contextId)}
            />
          </View>

          {result ? (
            <Typography variant="bodyMuted" style={styles.sampleSize}>
              Based on {result.totalComparisons} comparison{result.totalComparisons === 1 ? '' : 's'}
            </Typography>
          ) : null}
        </>
      )
      })()}
    </View>
  )
}

function QuickPickOption({
  entity,
  representative,
  onPress,
  picked,
  result,
}: {
  entity: Entity
  representative: Representative | null
  onPress: () => void
  picked: Entity | null
  result: Result | null
}) {
  const isThisPicked = picked?.id === entity.id
  const percent = result ? (result.winnerEntityId === entity.id ? result.winnerPercent : result.loserPercent) : null
  const overallWinRate = result ? (result.winnerEntityId === entity.id ? result.winnerOverallWinRate : result.loserOverallWinRate) : null

  const photoUrl = representative?.avatarUrl ?? entity.imageUrl
  const initial = (representative?.displayName ?? entity.canonicalName).charAt(0).toUpperCase()

  return (
    <PressableScale 
      style={[styles.option, isThisPicked && styles.optionSelected, picked && !isThisPicked && styles.optionNotPicked]} 
      onPress={onPress} 
      disabled={!!picked}
      scaleTo={0.98}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.optionImage} />
      ) : (
        <View style={[styles.optionImage, styles.optionImageFallback]}>
          <Typography variant="display" style={styles.optionInitial}>
            {initial}
          </Typography>
        </View>
      )}

      {representative ? (
        <Typography variant="heading" style={styles.optionName} numberOfLines={1}>
          {representative.displayName}
        </Typography>
      ) : (
        <Typography variant="heading" style={styles.optionName} numberOfLines={2}>
          {entity.canonicalName}
        </Typography>
      )}

      {result ? (
        <View style={styles.resultBlock}>
          <Typography variant="display" style={[styles.percent, isThisPicked && styles.percentPicked]}>
            {percent}%
          </Typography>
          <Typography variant="label" style={styles.percentLabel}>
            {representative
              ? isThisPicked
                ? `agree with ${representative.displayName}, like you`
                : `agree with ${representative.displayName}`
              : isThisPicked
                ? 'picked this, like you'
                : 'picked this'}
          </Typography>
          {overallWinRate !== null ? (
            <Typography variant="bodyMuted" style={styles.overallLine}>
              Wins {overallWinRate}% of its matchups overall
            </Typography>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  // A full-bleed band with its own generous vertical rhythm — reads as a
  // genuinely different beat from the surrounding Grid/Rail sections.
  section: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.md,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: { color: colors.accent, marginBottom: spacing.sm, textAlign: 'center' },
  prompt: { color: colors.ink, textAlign: 'center', marginBottom: spacing.lg },
  optionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, maxWidth: 600, alignSelf: 'center', width: '100%' },
  option: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.ink },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceMuted, transform: [{ scale: 1.02 }] },
  optionNotPicked: { opacity: 0.5, borderColor: colors.border },
  optionImage: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md, backgroundColor: colors.surfaceMuted },
  optionImageFallback: { alignItems: 'center', justifyContent: 'center' },
  optionInitial: { color: colors.inkMuted },
  optionName: { textAlign: 'center' },
  optionCaption: { textAlign: 'center', marginTop: 2 },
  or: { color: colors.ink, opacity: 0.5, marginTop: spacing.xl },
  emptyWrap: { backgroundColor: colors.surface, padding: spacing.xl },
  sampleSize: { color: colors.ink, opacity: 0.6, textAlign: 'center', marginTop: spacing.lg },
  resultBlock: { marginTop: spacing.md, alignItems: 'center', borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md, width: '100%' },
  percent: { color: colors.ink },
  percentPicked: { color: colors.accent },
  percentLabel: { color: colors.inkMuted, marginTop: 2 },
  overallLine: { marginTop: spacing.xs, textAlign: 'center' },
})
