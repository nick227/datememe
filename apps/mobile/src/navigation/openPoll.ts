import type { NavigationProp, ParamListBase } from '@react-navigation/native'
import type { PollParams } from './types'

type RootNavigate = (screen: 'ListBuilder' | 'PollResults', params: PollParams) => void

export function openPoll(navigation: NavigationProp<ParamListBase>, mode: 'edit' | 'results', params: PollParams) {
  const screen = mode === 'edit' ? 'ListBuilder' : 'PollResults'
  let current: NavigationProp<ParamListBase> = navigation
  let parent = current.getParent()
  while (parent) {
    current = parent
    parent = current.getParent()
  }
  ;(current.navigate as unknown as RootNavigate)(screen, params)
}
