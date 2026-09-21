import { useMutation, useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

/**
 * One prompt per widget instance — `key` should be the feed module's own id
 * (e.g. "quick-picks-0") so multiple Quick Picks modules on the same page
 * each get their own prompt instead of sharing one React Query cache entry.
 * `context: 'discover'` grounds both options in a real person from the
 * viewer's current Discover pool instead of two bare things.
 */
export function useNextQuickPick(key: string, context?: 'discover'): any {
  return useQuery({
    queryKey: ['quickPicksNext', key],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/quick-picks/next', { params: { query: { context } } })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data as any
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export type SubmitQuickPickPayload = { contextType: string; contextId: string; winnerEntityId: string; loserEntityId: string }
export function useSubmitQuickPickChoice() {
  return useMutation({
    mutationFn: async (input: SubmitQuickPickPayload) => {
      const { data, error, response } = await getApiClient().POST('/quick-picks/choice', { body: input as any })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
  })
}
