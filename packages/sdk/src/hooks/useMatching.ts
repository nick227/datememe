import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

/**
 * The only way a Conversation comes to exist (docs §7/§8) — a mutual LIKE
 * completes a Match and creates it server-side; the result tells the caller
 * whether that just happened.
 */
export function useSwipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { targetProfileId: string; action: 'LIKE' | 'PASS' }) => {
      const { data, error, response } = await getApiClient().POST('/swipes', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: (result) => {
      // Two parallel Discover query keys exist: the legacy swipe-deck
      // (`useDiscoveryFeed`, key 'discovery') and the current Grid/Rail/
      // Spotlight/River feed (`useDiscoverFeed`, key 'discoverFeed') — a
      // swipe made from either screen must invalidate both, or the one not
      // matching the invalidated key silently keeps showing the
      // just-swiped person until something else happens to refetch it.
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      queryClient.invalidateQueries({ queryKey: ['discoverFeed'] })
      if (result.matched) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    },
  })
}
