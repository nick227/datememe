import type { ContentUnit } from './types'
import type { CardModel } from './cardModel'
import { pickMetrics } from './renderBudgets'

export function categoryToCardModel(unit: ContentUnit): CardModel {
  const items = unit.previewEntities ?? []
  const isComplete = !!unit.relationship?.completed
  const inProgress = !isComplete && items.length > 0
  
  const metric = pickMetrics(unit.metrics, 'grid-square')[0]

  let badge: CardModel['badge'] = undefined
  if (isComplete) {
    badge = { label: 'DONE', variant: 'neutral' }
  } else if (inProgress) {
    badge = { label: 'IN PROGRESS', variant: 'accent' }
  }

  return {
    id: unit.id,
    title: unit.title,
    titleLines: 2,
    media: {
      uri: unit.imageUrl,
      aspectRatio: 16 / 9,
    },
    badge,
    meta: {
      value: metric?.value ? String(metric.value) : '',
    },
  }
}

export function personToCardModel(unit: ContentUnit): CardModel {
  const matchMetric = unit.metrics?.find((m) => m.type === 'overlap')
  const locationLine = unit.subtitle || ''

  let badge: CardModel['badge'] = undefined
  if (matchMetric) {
    badge = { label: `${matchMetric.value} match`, variant: 'neutral' }
  }

  return {
    id: unit.id,
    title: unit.title,
    titleLines: 1,
    media: {
      uri: unit.imageUrl,
      aspectRatio: 3 / 4,
      credit: unit.imageCredit,
    },
    badge,
    meta: {
      value: locationLine || ' ',
    },
  }
}
