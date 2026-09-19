import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type UpsertListInput = components['schemas']['UpsertListInput']

export function useMyLists() {
  return useQuery({
    queryKey: ['myLists'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/me/lists')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
  })
}

export function useProfileLists(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profileLists', profileId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/profiles/{profileId}/lists', {
        params: { path: { profileId: profileId! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    enabled: !!profileId,
  })
}

export function useUpsertList(categorySlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpsertListInput) => {
      const { data, error, response } = await getApiClient().PUT('/lists/{categorySlug}', {
        params: { path: { categorySlug } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myLists'] })
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}
