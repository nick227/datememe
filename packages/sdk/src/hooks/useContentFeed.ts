import { useInfiniteQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useListsFeed() {
  return useInfiniteQuery({
    queryKey: ['listsFeed'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      // A small page of "beats" (Rail/Spotlight/Grid/River), not a big batch —
      // the feed is meant to unfold gradually, not front-load everything.
      const { data, error, response } = await getApiClient().GET('/lists/feed', {
        params: { query: { cursor: pageParam, limit: 4 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
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
  groupSlug?: string
  nearMe?: boolean
  ageBucket?: '20s' | '30s' | '40s' | '50plus'
}

// Discover's chips are real filters (unlike Lists' jump anchors) — changing
// one resets pagination via the query key, same as any other filtered list.
export function useDiscoverFeed(filters: DiscoverFeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['discoverFeed', filters],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      // Smaller pages so a Rail/River gets a fresh reason to appear on every
      // page, not just a giant Grid after page one (proposal correction).
      const { data, error, response } = await getApiClient().GET('/discover/feed', {
        params: { query: { cursor: pageParam, limit: 6, ...filters } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
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
