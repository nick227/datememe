import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export type ListsFeedFilters = {
  /** Multi-select CategoryGroup slugs (OR'd) — same real server-side filter as Discover's, see DiscoverFeedFilters. */
  groupSlugs?: string[]
}

// Lists' chips are a real server-side filter (same groupSlugs query param
// and OR semantics as Discover's) — changing the selection resets
// pagination via the query key, same as any other filtered list.
export function useListsFeed(filters: ListsFeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['listsFeed', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      // A small page of "beats" (Rail/Spotlight/Grid/River), not a big batch —
      // the feed is meant to unfold gradually, not front-load everything.
      const { data, error, response } = await getApiClient().GET('/lists/feed', {
        params: { query: { cursor: pageParam, limit: 4, groupSlugs: filters.groupSlugs?.length ? filters.groupSlugs.join(',') : undefined } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    // Selecting a chip changes the query key (a real new filtered request) —
    // keep showing the previous filter's data while the new one loads
    // instead of dropping to an empty/loading state, which read as a UI
    // flash on every chip tap (reported live).
    placeholderData: keepPreviousData,
  })
}

export function useListsFeedCollection(collectionId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['listsFeedCollection', collectionId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/lists/feed/collections/{collectionId}', {
        params: { path: { collectionId: collectionId! }, query: { cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!collectionId,
  })
}

export type DiscoverFeedFilters = {
  /** Multi-select CategoryGroup slugs (OR'd) — real engagement in *any* selected group, not an AND across all of them. */
  groupSlugs?: string[]
  nearMe?: boolean
  ageBucket?: '20s' | '30s' | '40s' | '50plus'
}

// Discover's chips are a real server-side filter — changing the selection
// resets pagination via the query key, same as any other filtered list, and
// (as of the groupSlugs multi-select) the same filtering logic Lists uses.
export function useDiscoverFeed(filters: DiscoverFeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['discoverFeed', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      // Smaller pages so a Rail/River gets a fresh reason to appear on every
      // page, not just a giant Grid after page one (proposal correction).
      const { data, error, response } = await getApiClient().GET('/discover/feed', {
        params: {
          query: {
            cursor: pageParam,
            limit: 6,
            nearMe: filters.nearMe,
            ageBucket: filters.ageBucket,
            groupSlugs: filters.groupSlugs?.length ? filters.groupSlugs.join(',') : undefined,
          },
        },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    // See useListsFeed — avoids the loading-state flash on every chip tap.
    placeholderData: keepPreviousData,
  })
}

export function useDiscoverFeedCollection(collectionId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['discoverFeedCollection', collectionId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/discover/feed/collections/{collectionId}', {
        params: { path: { collectionId: collectionId! }, query: { cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!collectionId,
  })
}
