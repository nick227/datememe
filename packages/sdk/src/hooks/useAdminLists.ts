import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components, operations } from '../generated/types'

// Admin → Lists (docs/admin-lists-roadmap.md). Every mutation returns the
// saved list, which replaces the cached detail; the browse page refetches.

export type AdminListRow = components['schemas']['AdminListRow']
export type AdminListDetail = components['schemas']['AdminListDetail']
export type AdminListCoverCandidate = components['schemas']['AdminListCoverCandidate']
export type AdminListsQuery = NonNullable<operations['getAdminLists']['parameters']['query']>
type UpdateInput = NonNullable<operations['updateAdminList']['requestBody']>['content']['application/json']
type CreateInput = NonNullable<operations['createAdminList']['requestBody']>['content']['application/json']

const fail = (response: Response, error: unknown): never => { throw new ApiError(response.status, (error as any)?.error ?? (error as any)?.message) }

export function useAdminLists(query: AdminListsQuery) {
  return useQuery({
    queryKey: ['admin', 'lists', query],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/lists', { params: { query } })
      if (error) fail(response, error)
      return data!
    },
    placeholderData: keepPreviousData,
  })
}

/** Polls every 3 s while a cover suggestion is running. */
export function useAdminList(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'list', id],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/lists/{id}', { params: { path: { id: id! } } })
      if (error) fail(response, error)
      return data!.list
    },
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.coverSuggest?.status === 'running' ? 3000 : false),
  })
}

function useSaved() {
  const queryClient = useQueryClient()
  return (list: AdminListDetail) => {
    queryClient.setQueryData(['admin', 'list', list.id], list)
    queryClient.invalidateQueries({ queryKey: ['admin', 'lists'] })
  }
}

export function useAdminCreateList() {
  const saved = useSaved()
  return useMutation({
    mutationFn: async (body: CreateInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/lists', { body })
      if (error) fail(response, error)
      return data!.list
    },
    onSuccess: saved,
  })
}

export function useAdminUpdateList() {
  const saved = useSaved()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PATCH('/admin/lists/{id}', { params: { path: { id } }, body })
      if (error) fail(response, error)
      return data!.list
    },
    onSuccess: saved,
  })
}

/** Remove and reorder: the complete list of value ids, in order. */
export function useAdminSetListValues() {
  const saved = useSaved()
  return useMutation({
    mutationFn: async ({ id, entityIds }: { id: string; entityIds: string[] }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/lists/{id}/values', { params: { path: { id } }, body: { entityIds } })
      if (error) fail(response, error)
      return data!.list
    },
    onSuccess: saved,
  })
}

/** + Add by entity id or name. `status: 'similar'` means nothing was added — confirm `match` or retry with `create: true`. */
export function useAdminAddListValue() {
  const saved = useSaved()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; entityId?: string; name?: string; create?: boolean }) => {
      const { data, error, response } = await getApiClient().POST('/admin/lists/{id}/values', { params: { path: { id } }, body })
      if (error) fail(response, error)
      return data!
    },
    onSuccess: (result) => { if (result.list) saved(result.list) },
  })
}

export function useAdminSuggestListCover() {
  const saved = useSaved()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error, response } = await getApiClient().POST('/admin/lists/{id}/cover/suggest', { params: { path: { id } } })
      if (error) fail(response, error)
      return data!.list
    },
    onSuccess: saved,
  })
}

export function useAdminSetListCover() {
  const saved = useSaved()
  return useMutation({
    mutationFn: async ({ id, action, candidateId }: { id: string; action: 'use' | 'none' | 'revert'; candidateId?: string }) => {
      const { data, error, response } = await getApiClient().POST('/admin/lists/{id}/cover', { params: { path: { id } }, body: { action, candidateId } })
      if (error) fail(response, error)
      return data!.list
    },
    onSuccess: saved,
  })
}
