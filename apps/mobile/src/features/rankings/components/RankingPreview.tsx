import { Pressable, StyleSheet, View } from 'react-native'
import { Icon } from '../../../ui/Icon'
import { Typography } from '../../../ui/Typography'
import { SmartImage } from '../../../ui/content/SmartImage'
import { ResultUnitCard } from '../../../ui/content/ResultUnitCard'
import { colors, spacing } from '../../../theme'
import type { ContentUnit, ResultUnit } from '../../../ui/content/types'
import { rankingsLabel } from '../rankingStory'

type Props = {
  testID?: string
  title: string
  imageUrl?: string | null
  takeCount: number
  answered: boolean
  items: ContentUnit[]
  onOpen: () => void
  onAnswer: () => void
}

const COVER_W = 84
const COVER_H = 112

function asResult(unit: ContentUnit): ResultUnit | null {
  if (unit.kind !== 'result' || unit.rank == null) return null
  return {
    id: unit.id,
    kind: 'result',
    resultType: unit.resultType === 'person' ? 'person' : 'entity',
    title: unit.title,
    subtitle: unit.subtitle ?? undefined,
    imageUrl: unit.imageUrl,
    metrics: unit.metrics ?? [],
    rank: unit.rank,
    trend: unit.trend ?? undefined,
    position: unit.position ?? 0,
  }
}

export function RankingPreview({ testID, title, imageUrl, takeCount, answered, items, onOpen, onAnswer }: Props) {
  return (
    <View testID={testID} style={styles.block}>
      <Pressable
        testID={testID ? `${testID}.open` : undefined}
        onPress={onOpen}
        style={styles.head}
        accessibilityRole="button"
      >
        <SmartImage uri={imageUrl} fallbackText={title} width={COVER_W} height={COVER_H} style={styles.cover} />
        <View style={styles.headText}>
          <Typography variant="heading" numberOfLines={2}>{title}</Typography>
          <Typography variant="bodyMuted">{rankingsLabel(takeCount)}</Typography>
        </View>
      </Pressable>
      {items.map((unit) => {
        const result = asResult(unit)
        if (!result) return null
        return <ResultUnitCard key={unit.id} unit={result} onPress={onOpen} />
      })}
      <Pressable
        testID={testID ? `${testID}.full` : undefined}
        onPress={onAnswer}
        style={styles.full}
        accessibilityRole="button"
      >
        <Typography variant="label" style={styles.fullText}>{answered ? 'Edit your answers' : 'Take the poll'}</Typography>
        <Icon name="ChevronRight" size={16} color={colors.ink} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cover: { borderRadius: 4, backgroundColor: colors.surfaceMuted },
  headText: { flex: 1, gap: 2 },
  full: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  fullText: { color: colors.ink, letterSpacing: 0.4 },
})
