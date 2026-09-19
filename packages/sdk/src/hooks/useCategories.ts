import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useEntityTypes() {
  return useQuery({
    queryKey: ['entityTypes'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/entity-types')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    staleTime: 5 * 60_000,
  })
}

export function useCategoryGroups() {
  return useQuery({
    queryKey: ['categoryGroups'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/category-groups')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    staleTime: 5 * 60_000,
  })
}

export function useCategories(groupSlug?: string) {
  return useQuery({
    queryKey: ['categories', groupSlug ?? null],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/categories', {
        params: { query: groupSlug ? { groupSlug } : {} },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    staleTime: 60_000,
  })
}

export function useCategory(categorySlug: string | undefined) {
  return useQuery({
    queryKey: ['category', categorySlug],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/categories/{categorySlug}', {
        params: { path: { categorySlug: categorySlug! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    enabled: !!categorySlug,
  })
}

export function useCategoryEntities(categorySlug: string | undefined, params?: { q?: string }) {
  return useInfiniteQuery({
    queryKey: ['categoryEntities', categorySlug, params],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/categories/{categorySlug}/entities', {
        params: {
          path: { categorySlug: categorySlug! },
          query: { q: params?.q, cursor: pageParam, limit: 20 },
        },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!categorySlug,
  })
}
