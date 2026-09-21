import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type UpdateProfileInput = components['schemas']['UpdateProfileInput']

export function useProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/profiles/{profileId}', {
        params: { path: { profileId: profileId! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    enabled: !!profileId,
  })
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateProfileInput) => {
      const { data, error, response } = await getApiClient().PATCH('/profiles/me', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      // seekingGenders/genderIdentity/isDiscoverable are all editable here and
      // directly change the viewer's own Discover candidate pool — without
      // this, changing who you're seeking wouldn't visibly change Discover
      // until something else happened to refetch it. Both keys, per
      // useMatching.ts's useSwipe for why both exist.
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      queryClient.invalidateQueries({ queryKey: ['discoverFeed'] })
    },
  })
}
