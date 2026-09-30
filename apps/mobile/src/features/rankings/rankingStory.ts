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

const CLOSE_RACE = 0.15

export function firstPlacePercent(option: Pick<RankedOption, 'firstPlaceCount'>, takeCount: number) {
  return takeCount > 0 ? Math.round((option.firstPlaceCount / takeCount) * 100) : 0
}

export function barFraction(score: number, leaderScore: number) {
  return leaderScore > 0 ? score / leaderScore : 0
}

function pointsAhead(lead: number, orderingMode: 'RANKED' | 'UNRANKED') {
  const unit = orderingMode === 'RANKED' ? 'point' : 'pick'
  return `${lead} ${unit}${lead === 1 ? '' : 's'}`
}

export function trendSentence(option: Pick<RankedOption, 'rank' | 'previousRank'>) {
  if (option.previousRank == null) return 'New since yesterday'
  if (option.previousRank > option.rank) return `↑ ${option.previousRank - option.rank} since yesterday`
  if (option.previousRank < option.rank) return `↓ ${option.rank - option.previousRank} since yesterday`
  return null
}

export function rankingHero(options: RankedOption[], takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  const winner = options[0]
  if (!winner) return null
  const next = options[1]
  const lead = next ? winner.score - next.score : null
  const close = lead != null && winner.score > 0 && (lead <= 1 || lead / winner.score <= CLOSE_RACE)
  const yours = options.find((option) => option.viewerRank === 1)
  const marginLine = next == null || lead == null
    ? null
    : lead === 0
      ? `Tied with ${next.name}`
      : `${close ? 'Only ' : ''}${pointsAhead(lead, orderingMode)} ahead of ${next.name}`

  return {
    peopleLine: `${takeCount} ${takeCount === 1 ? 'person' : 'people'} ranked this`,
    winnerName: winner.name,
    firstPlaceLine: orderingMode === 'RANKED' ? `${firstPlacePercent(winner, takeCount)}% ranked it #1` : null,
    marginLine,
    trendLine: trendSentence(winner),
    yoursLine: yoursLine(yours),
    insights: insightLines(options, takeCount, orderingMode, winner),
  }
}

function yoursLine(yours: RankedOption | undefined) {
  if (!yours) return null
  if (yours.rank === 1) return 'You agree with the crowd'
  return `Your #1: ${yours.name} · site #${yours.rank}`
}

function insightLines(options: RankedOption[], takeCount: number, orderingMode: 'RANKED' | 'UNRANKED', winner: RankedOption) {
  const lines: string[] = []
  if (orderingMode === 'RANKED') {
    const mostFirst = [...options].sort((a, b) => b.firstPlaceCount - a.firstPlaceCount || a.rank - b.rank)[0]
    if (mostFirst && mostFirst.id !== winner.id && mostFirst.firstPlaceCount > winner.firstPlaceCount) {
      lines.push(`Most #1 votes: ${mostFirst.name}`)
    }
    if (takeCount >= 3 && winner.pickPercent >= 50 && firstPlacePercent(winner, takeCount) >= 25) {
      lines.push(`Consensus pick: ${winner.name}`)
    }
  }
  const rising = options.find((option) => option.id !== winner.id && option.previousRank != null && option.previousRank - option.rank >= 3)
  if (rising && rising.previousRank != null) lines.push(`Rising: ${rising.name} ↑ ${rising.previousRank - rising.rank}`)
  const challenger = options.find((option) => option.id !== winner.id && option.previousRank == null && option.rank <= 5)
  if (challenger) lines.push(`New: ${challenger.name}`)
  return lines.slice(0, 3)
}

export function barCaption(option: RankedOption, takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  const parts = [`${option.pickPercent}% picked it`]
  if (orderingMode === 'RANKED') parts.push(`${firstPlacePercent(option, takeCount)}% ranked it #1`)
  if (option.viewerRank != null) parts.push(`You: #${option.viewerRank}`)
  return parts.join(' · ')
}

export function optionSheetLines(option: RankedOption, takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  const points = `${option.score} ${option.score === 1 ? 'point' : 'points'}`
  const lines = [`#${option.rank} overall · ${points}`, `${option.pickPercent}% picked it`]
  if (orderingMode === 'RANKED') lines.push(`${firstPlacePercent(option, takeCount)}% put it #1`)
  const trend = trendSentence(option)
  if (trend && option.previousRank !== option.rank) lines.push(trend)
  if (option.viewerRank != null) lines.push(`Your rank: #${option.viewerRank}`)
  lines.push(`${option.pickCount} ${option.pickCount === 1 ? 'person' : 'people'} picked it`)
  return lines
}
