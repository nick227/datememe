import type { NavigationProp, ParamListBase } from '@react-navigation/native'
import type { PollParams } from './types'

type PollNavigate = (screen: 'ListBuilder' | 'PollResults', params: PollParams) => void

// Push on the current tab stack. These screens are registered inside every
// tab, so Back returns to whoever opened them and the tab bar stays visible.
// Walking up to the root stack used to cover the tab bar entirely.
export function openPoll(navigation: NavigationProp<ParamListBase>, mode: 'edit' | 'results', params: PollParams) {
  const screen = mode === 'edit' ? 'ListBuilder' : 'PollResults'
  ;(navigation.navigate as unknown as PollNavigate)(screen, params)
}

export function pollScreenId({ params }: { params?: PollParams }) {
  return params?.categorySlug
}
