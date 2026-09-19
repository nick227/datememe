import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/plans')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    staleTime: 5 * 60_000,
  })
}

export function useMySubscription() {
  return useQuery({
    queryKey: ['mySubscription'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/subscriptions/me')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
  })
}

/** Dev/staging only — see DevPurchaseInput in the spec. */
export function useDevPurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { planSlug: string }) => {
      const { data, error, response } = await getApiClient().POST('/subscriptions/dev-purchase', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubscription'] })
    },
  })
}
