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
    // Whole-list replacements must reach the server in answer order.
    scope: { id: `list:${categorySlug}` },
    mutationFn: async (body: UpsertListInput) => {
      const { data, error, response } = await getApiClient().PUT('/lists/{categorySlug}', {
        params: { path: { categorySlug } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<number>(['rankingTargetRevision', categorySlug], (previous = 0) =>
        Math.max(previous, saved.answerRevision),
      )
      queryClient.invalidateQueries({ queryKey: ['myLists'] })
      // The actual Lists tab (CategoriesScreen) reads `listsFeed`, not
      // `myLists` — confirmed live: saving a list updated the DB correctly
      // but the Lists tab kept showing "0 lists completed" and the
      // just-ranked category still prompting "Rank yours" until something
      // else happened to refetch it. `listsFeedCollection` (the "view all"
      // per-topic-group pagination) reads the same underlying data and has
      // the same staleness risk.
      queryClient.invalidateQueries({ queryKey: ['listsFeed'] })
      queryClient.invalidateQueries({ queryKey: ['listsFeedCollection'] })
      // Both Discover query keys — see useMatching.ts's useSwipe for why.
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      queryClient.invalidateQueries({ queryKey: ['discoverFeed'] })
      // Saving is complete once committed. Publication is tracked separately
      // by the results revision; never hold navigation on a background rebuild.
      queryClient.invalidateQueries({ queryKey: ['rankingsFeed'] })
      void queryClient.invalidateQueries({ queryKey: ['categoryRankings', categorySlug] })
    },
  })
}
