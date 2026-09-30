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
const COUNT_UNTIL = 10

export function barFraction(score: number, leaderScore: number) {
  return leaderScore > 0 ? score / leaderScore : 0
}

function ordinal(n: number) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

function amount(count: number, total: number) {
  if (total < COUNT_UNTIL) return String(count)
  return `${Math.round((count / total) * 100)}%`
}

function peopleLine(takeCount: number) {
  return takeCount === 1 ? '1 person ranked this' : `${takeCount} people ranked this`
}

export function trendSentence(option: Pick<RankedOption, 'rank' | 'previousRank'>) {
  if (option.previousRank == null) return 'New since yesterday'
  const delta = option.previousRank - option.rank
  if (delta > 0) return `Up ${delta} since yesterday`
  if (delta < 0) return `Down ${-delta} since yesterday`
  return null
}

function raceLine(winner: RankedOption, next: RankedOption | undefined, takeCount: number) {
  if (!next || takeCount <= 1) return null
  if (winner.score === next.score) return `${winner.name} and ${next.name} are tied`
  const lead = winner.score - next.score
  const close = winner.score > 0 && (lead <= 1 || lead / winner.score <= CLOSE_RACE)
  return close ? `${winner.name} just leads ${next.name}` : `${winner.name} leads ${next.name}`
}

function youLine(option: RankedOption, takeCount: number, surface: 'row' | 'sheet') {
  if (option.viewerRank == null || takeCount <= 1) return null
  if (option.viewerRank === 1) {
    if (surface === 'row' && option.rank === 1) return null
    return 'Your first pick'
  }
  if (option.viewerRank === option.rank) return 'Same as you'
  return `You ranked it ${ordinal(option.viewerRank)}`
}

export function crowdLine(option: RankedOption, takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  if (takeCount <= 1 || option.pickCount === 0) return null
  const picked = amount(option.pickCount, takeCount)
  const first = amount(option.firstPlaceCount, takeCount)
  if (orderingMode === 'UNRANKED' || option.firstPlaceCount === 0) return `Of ${takeCount}, ${picked} picked it`
  if (option.firstPlaceCount === option.pickCount) return `Of ${takeCount}, ${first} put it first`
  return `Of ${takeCount}, ${picked} picked it and ${first} put it first`
}

export function barCaption(option: RankedOption, takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  const parts = [crowdLine(option, takeCount, orderingMode), youLine(option, takeCount, 'row')].filter((line): line is string => line != null)
  return parts.length ? parts.join(' · ') : null
}

export function rankingSummary(options: RankedOption[], takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  const winner = options[0]
  if (!winner) return []
  const lines = [peopleLine(takeCount)]
  const race = raceLine(winner, options[1], takeCount)
  if (race) lines.push(race)
  const trend = trendSentence(winner)
  if (trend && winner.previousRank !== winner.rank) lines.push(trend)
  const yours = options.find((option) => option.viewerRank === 1)
  if (yours && takeCount <= 1) lines.push('This is your ranking')
  else if (yours?.rank === 1) lines.push('Your first pick is in the lead')
  else if (yours) lines.push(`Your first pick, ${yours.name}, placed ${ordinal(yours.rank)}`)
  const aside = asideLine(options, takeCount, orderingMode, winner)
  if (aside) lines.push(aside)
  return lines
}

function asideLine(options: RankedOption[], takeCount: number, orderingMode: 'RANKED' | 'UNRANKED', winner: RankedOption) {
  if (orderingMode === 'RANKED' && takeCount > 1) {
    const mostFirst = [...options].sort((a, b) => b.firstPlaceCount - a.firstPlaceCount || a.rank - b.rank)[0]
    if (mostFirst && mostFirst.id !== winner.id && mostFirst.firstPlaceCount > winner.firstPlaceCount) {
      return `Of ${takeCount}, ${amount(mostFirst.firstPlaceCount, takeCount)} put ${mostFirst.name} first`
    }
  }
  const rising = options.find((option) => option.id !== winner.id && option.previousRank != null && option.previousRank - option.rank >= 3)
  if (rising?.previousRank != null) return `${rising.name} climbed ${rising.previousRank - rising.rank} places since yesterday`
  const challenger = options.find((option) => option.id !== winner.id && option.previousRank == null && option.rank <= 5)
  if (challenger) return `${challenger.name} is new since yesterday`
  return null
}

export function optionSheetLines(option: RankedOption, takeCount: number, orderingMode: 'RANKED' | 'UNRANKED') {
  if (takeCount <= 1) {
    const place = option.rank === 1 ? 'First on the only ranking' : `${ordinal(option.rank)} on the only ranking`
    return [place]
  }
  const trend = trendSentence(option)
  return [crowdLine(option, takeCount, orderingMode), trend && option.previousRank !== option.rank ? trend : null, youLine(option, takeCount, 'sheet')].filter((line): line is string => line != null)
}
