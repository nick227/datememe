export type RankedOption = {
  id: string
  name: string
  rank: number
  previousRank: number | null
  score: number
  pickCount: number
  firstPlaceCount: number
  pickPercent: number
  viewerRank: number | null
}

export function barFraction(score: number, leaderScore: number) {
  return leaderScore > 0 ? score / leaderScore : 0
}

export function rankingsLabel(takeCount: number) {
  return takeCount === 1 ? '1 ranking' : `${takeCount} rankings`
}

export function countOf(count: number, total: number) {
  return `${count} of ${total}`
}

export function barCaption(option: Pick<RankedOption, 'pickCount'>, takeCount: number) {
  if (takeCount <= 0 || option.pickCount === 0) return null
  return countOf(option.pickCount, takeCount)
}

export function optionSheetLines(option: Pick<RankedOption, 'pickCount'>, takeCount: number) {
  if (takeCount <= 0) return []
  return [countOf(option.pickCount, takeCount)]
}
