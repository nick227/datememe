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
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      if (result.matched) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }
    },
  })
}
