import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export type RankingsFeedFilters = {
  /** Multi-select CategoryGroup slugs (OR'd) — same filter as Lists/Discover. */
  groupSlugs?: string[]
}

// The Rankings tab — one unpaginated response (see GET /rankings/feed).
export function useRankingsFeed(filters: RankingsFeedFilters = {}) {
  return useQuery({
    queryKey: ['rankingsFeed', filters],
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/rankings/feed', {
        params: { query: { groupSlugs: filters.groupSlugs?.length ? filters.groupSlugs.join(',') : undefined } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    // Same as useListsFeed: keep the previous filter's rows up while a chip
    // tap's new query loads, instead of flashing a loading state.
    placeholderData: keepPreviousData,
  })
}

export function useCategoryRankings(categorySlug: string | undefined) {
  // Local acknowledged save revision survives navigation and participates in
  // query subscriptions, even if an older GET was already in flight at save time.
  const target = useQuery({
    queryKey: ['rankingTargetRevision', categorySlug],
    queryFn: () => 0,
    initialData: 0,
    enabled: false,
    staleTime: Infinity,
  })
  const query = useQuery({
    queryKey: ['categoryRankings', categorySlug],
    refetchInterval: (query) => query.state.data?.isUpdating ||
      (query.state.data?.resultsRevision ?? 0) < target.data ? 1000 : 3000,
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/categories/{categorySlug}/rankings', {
        params: { path: { categorySlug: categorySlug! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    enabled: !!categorySlug,
  })
  const isUpdating = !!query.data?.isUpdating || (query.data?.resultsRevision ?? 0) < target.data
  return { ...query, isUpdating }
}
