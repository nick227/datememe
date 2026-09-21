import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, getClientConfig, ApiError } from '../client'
import type { components } from '../generated/types'
import type { UploadableFile } from './useMedia'

type EntitySubmissionReviewInput = components['schemas']['AdminEntitySubmissionReviewInput']
type ReportReviewInput = components['schemas']['AdminReportReviewInput']
type CreatePlanInput = components['schemas']['AdminCreatePlanInput']
type UpdatePlanInput = components['schemas']['AdminUpdatePlanInput']
type CreateEntityTypeInput = components['schemas']['AdminCreateEntityTypeInput']
type UpdateEntityTypeInput = components['schemas']['AdminUpdateEntityTypeInput']
type CreateEntityInput = components['schemas']['AdminCreateEntityInput']
type UpdateEntityInput = components['schemas']['AdminUpdateEntityInput']
type GenerateEntitiesInput = components['schemas']['AdminGenerateEntitiesInput']
type BulkSaveEntitiesInput = components['schemas']['AdminBulkSaveEntitiesInput']
type CreateListDefinitionInput = components['schemas']['AdminCreateListDefinitionInput']
type UpdateListDefinitionInput = components['schemas']['AdminUpdateListDefinitionInput']
type UpdateCuratedEntitiesInput = components['schemas']['AdminUpdateCuratedEntitiesInput']
type CreateSitePickGroupInput = components['schemas']['AdminCreateSitePickGroupInput']
type UpdateSitePickGroupInput = components['schemas']['AdminUpdateSitePickGroupInput']
type UpdateSitePickItemsInput = components['schemas']['AdminUpdateSitePickItemsInput']
type SearchImagesInput = components['schemas']['AdminSearchImagesInput']
type AttachImageInput = components['schemas']['AdminAttachImageInput']
type MediaAsset = components['schemas']['AdminMediaAsset']
type MediaTarget = { entityId?: string; entityTypeId?: string; categoryId?: string }

// apps/admin -> apps/mobile Admin migration (see CLAUDE.md). Add one hook
// per /admin/* route as each gets its own spec entry — don't pre-build hooks
// for routes that aren't spec-driven yet.
export function useAdminQueueMetrics() {
  return useQuery({
    queryKey: ['admin', 'queueMetrics'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/queue')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useAdminEntitySubmissions(status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MERGED') {
  return useInfiniteQuery({
    queryKey: ['admin', 'entitySubmissions', status],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/moderation/submissions', {
        params: { query: { status, cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useAdminReviewEntitySubmission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: EntitySubmissionReviewInput & { id: string }) => {
      const { data, error, response } = await getApiClient().POST('/admin/moderation/submissions/{id}/review', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.submission
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'entitySubmissions'] })
    },
  })
}

async function fetchAdminEntities(entityTypeId: string) {
  const { data, error, response } = await getApiClient().GET('/admin/taxonomy/entities', {
    params: { query: { entityTypeId } },
  })
  if (error) throw new ApiError(response.status, (error as any).error)
  return data!.entities
}

export function useAdminEntities(entityTypeId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'entities', entityTypeId],
    queryFn: () => fetchAdminEntities(entityTypeId!),
    enabled: !!entityTypeId,
  })
}

// Imperative variant for one-off lookups triggered from an event handler
// (Moderation's "merge into…" picker populates an ActionSheet on demand)
// where a reactive hook doesn't fit. Shares useAdminEntities' cache key.
export function useFetchAdminEntities() {
  const queryClient = useQueryClient()
  return (entityTypeId: string) =>
    queryClient.fetchQuery({ queryKey: ['admin', 'entities', entityTypeId], queryFn: () => fetchAdminEntities(entityTypeId) })
}

// Separate from useAdminEntities above (which only filters by type, for the
// Moderation merge picker) — the taxonomy tree browser lazy-loads one level
// at a time by (type, parent), matching apps/admin's own fetch-per-expand
// pattern rather than requesting a deep nested tree in one response.
// `parentId: null` means "root level of this type" (sent as the literal
// string "null", per getEntities' query contract).
export function useAdminEntitiesByParent(entityTypeId: string, parentId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'entitiesByParent', entityTypeId, parentId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/taxonomy/entities', {
        params: { query: { entityTypeId, parentId: parentId ?? 'null' } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.entities
    },
    enabled,
  })
}

export function useAdminEntityTypes() {
  return useQuery({
    queryKey: ['admin', 'entityTypes'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/taxonomy/types')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.entityTypes
    },
  })
}

function useInvalidateTaxonomy() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'entityTypes'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'entitiesByParent'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'entities'] })
  }
}

export function useAdminCreateEntityType() {
  const invalidate = useInvalidateTaxonomy()
  return useMutation({
    mutationFn: async (input: CreateEntityTypeInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/taxonomy/types', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.entityType
    },
    onSuccess: invalidate,
  })
}

export function useAdminUpdateEntityType() {
  const invalidate = useInvalidateTaxonomy()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateEntityTypeInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/taxonomy/types/{id}', { params: { path: { id } }, body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.entityType
    },
    onSuccess: invalidate,
  })
}

export function useAdminCreateEntity() {
  const invalidate = useInvalidateTaxonomy()
  return useMutation({
    mutationFn: async (input: CreateEntityInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/taxonomy/entities', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.entity
    },
    onSuccess: invalidate,
  })
}

export function useAdminUpdateEntity() {
  const invalidate = useInvalidateTaxonomy()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateEntityInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/taxonomy/entities/{id}', { params: { path: { id } }, body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.entity
    },
    onSuccess: invalidate,
  })
}

export function useAdminGenerateEntities() {
  return useMutation({
    mutationFn: async (input: GenerateEntitiesInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/taxonomy/entities/generate', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.candidates
    },
  })
}

export function useAdminBulkSaveEntities() {
  const invalidate = useInvalidateTaxonomy()
  return useMutation({
    mutationFn: async (input: BulkSaveEntitiesInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/taxonomy/entities/bulk', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: invalidate,
  })
}

export function useAdminReports(status: 'PENDING' | 'REVIEWED' | 'ACTIONED') {
  return useInfiniteQuery({
    queryKey: ['admin', 'reports', status],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/moderation/reports', {
        params: { query: { status, cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useAdminReviewReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: ReportReviewInput & { id: string }) => {
      const { data, error, response } = await getApiClient().POST('/admin/moderation/reports/{id}/review', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.report
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    },
  })
}

export function useAdminUsers(opts: { search?: string; planId?: string }) {
  return useInfiniteQuery({
    queryKey: ['admin', 'users', opts.search, opts.planId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/users', {
        params: { query: { search: opts.search, planId: opts.planId, cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/users/{id}', {
        params: { path: { id: userId! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    enabled: !!userId,
  })
}

function useInvalidateAdminUser() {
  const queryClient = useQueryClient()
  return (userId: string) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] })
  }
}

export function useAdminBanUser() {
  const invalidate = useInvalidateAdminUser()
  return useMutation({
    mutationFn: async (input: { userId: string; ban: boolean }) => {
      const { data, error, response } = await getApiClient().POST('/admin/users/ban', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.user
    },
    onSuccess: (_data, input) => invalidate(input.userId),
  })
}

export function useAdminVerifyUser() {
  const invalidate = useInvalidateAdminUser()
  return useMutation({
    mutationFn: async (input: { userId: string; verify: boolean }) => {
      const { data, error, response } = await getApiClient().POST('/admin/users/verify', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.user
    },
    onSuccess: (_data, input) => invalidate(input.userId),
  })
}

// useAdminOverrideMembership/useAdminRevokeMembership were removed here
// (Phase 7) — replaced by useAdminCreateMembershipGrant/
// useAdminRevokeMembershipGrant in useMembership.ts, which never touch
// Subscription.

export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/plans')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.plans
    },
  })
}

export function useAdminCreatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/plans', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.plan
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}

export function useAdminUpdatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdatePlanInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/plans/update', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.plan
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}

function useInvalidateListDefinitions() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['admin', 'listDefinitions'] })
}

export function useAdminListDefinitions() {
  return useQuery({
    queryKey: ['admin', 'listDefinitions'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/lists/definitions')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.categories
    },
  })
}

export function useAdminCreateListDefinition() {
  const invalidate = useInvalidateListDefinitions()
  return useMutation({
    mutationFn: async (input: CreateListDefinitionInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/lists/definitions', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.category
    },
    onSuccess: invalidate,
  })
}

export function useAdminUpdateListDefinition() {
  const invalidate = useInvalidateListDefinitions()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateListDefinitionInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/lists/definitions/{id}', { params: { path: { id } }, body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.category
    },
    onSuccess: invalidate,
  })
}

export function useAdminListCuratedEntities(listId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'listCuratedEntities', listId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/lists/definitions/{id}/entities', {
        params: { path: { id: listId! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.curatedEntities
    },
    enabled: !!listId,
  })
}

// Full replace, not a merge — matches the endpoint's own semantics (see
// updateListDefinitionCuratedEntities on the server). Callers always send
// the complete desired curated list, in order.
export function useAdminUpdateListCuratedEntities() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, entities }: { id: string } & UpdateCuratedEntitiesInput) => {
      const { data, error, response } = await getApiClient().PUT('/admin/lists/definitions/{id}/entities', {
        params: { path: { id } },
        body: { entities },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.curatedEntities
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'listCuratedEntities', vars.id] })
    },
  })
}

function useInvalidateSitePickGroups() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['admin', 'sitePickGroups'] })
}

export function useAdminSitePickGroups() {
  return useQuery({
    queryKey: ['admin', 'sitePickGroups'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/site-picks/groups')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.groups
    },
  })
}

export function useAdminCreateSitePickGroup() {
  const invalidate = useInvalidateSitePickGroups()
  return useMutation({
    mutationFn: async (input: CreateSitePickGroupInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/site-picks/groups', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.group
    },
    onSuccess: invalidate,
  })
}

export function useAdminUpdateSitePickGroup() {
  const invalidate = useInvalidateSitePickGroups()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSitePickGroupInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/site-picks/groups/{id}', { params: { path: { id } }, body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.group
    },
    onSuccess: invalidate,
  })
}

export function useAdminDeleteSitePickGroup() {
  const invalidate = useInvalidateSitePickGroups()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, response } = await getApiClient().DELETE('/admin/site-picks/groups/{id}', { params: { path: { id } } })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: invalidate,
  })
}

// Full replace, not a merge — matches the endpoint's own semantics (see
// updateSitePickGroupItems on the server). Callers always send the complete
// desired set of curated List Definitions, in order.
export function useAdminUpdateSitePickGroupItems() {
  const invalidate = useInvalidateSitePickGroups()
  return useMutation({
    mutationFn: async ({ id, items }: { id: string } & UpdateSitePickItemsInput) => {
      const { data, error, response } = await getApiClient().PUT('/admin/site-picks/groups/{id}/items', {
        params: { path: { id } },
        body: { items },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.items
    },
    onSuccess: invalidate,
  })
}

// An image can attach to an Entity, EntityType, or Category — invalidate all
// three admin listing queries rather than threading the target type through,
// since the parent screen already patches its own local view of the result.
function useInvalidateAdminMedia() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'entityTypes'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'entities'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'entitiesByParent'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'listDefinitions'] })
  }
}

export function useAdminSearchImages() {
  return useMutation({
    mutationFn: async (input: SearchImagesInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/media/search', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.candidates
    },
  })
}

export function useAdminImportImage() {
  const invalidate = useInvalidateAdminMedia()
  return useMutation({
    mutationFn: async (input: AttachImageInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/media/import', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.asset
    },
    onSuccess: invalidate,
  })
}

export function useAdminReferenceImage() {
  const invalidate = useInvalidateAdminMedia()
  return useMutation({
    mutationFn: async (input: AttachImageInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/media/reference', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.asset
    },
    onSuccess: invalidate,
  })
}

// Multipart, like useUploadMedia in useMedia.ts — openapi-fetch has no
// multipart support, so this bypasses it with a raw fetch + FormData,
// still using the same base URL/auth as everything else via getClientConfig().
export function useAdminUploadImage() {
  const invalidate = useInvalidateAdminMedia()
  return useMutation({
    mutationFn: async ({ target, file }: { target: MediaTarget; file: UploadableFile }): Promise<MediaAsset> => {
      const { baseUrl, getToken } = getClientConfig()

      const body = new FormData()
      if (target.entityId) body.append('entityId', target.entityId)
      if (target.entityTypeId) body.append('entityTypeId', target.entityTypeId)
      if (target.categoryId) body.append('categoryId', target.categoryId)

      if (file.uri.startsWith('blob:') || file.uri.startsWith('data:')) {
        const blob = await (await fetch(file.uri)).blob()
        body.append('file', blob, file.name)
      } else {
        body.append('file', file as unknown as Blob)
      }

      const headers: Record<string, string> = {}
      const token = getToken?.()
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(`${baseUrl}/admin/media/upload`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body,
      })
      const json = await response.json()
      if (!response.ok) throw new ApiError(response.status, json.error ?? `Upload failed (${response.status})`)
      return json.asset
    },
    onSuccess: invalidate,
  })
}

export function useAdminTaxonomyImages(target: MediaTarget | undefined) {
  return useQuery({
    queryKey: ['admin', 'taxonomyImages', target],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/media/assets', { params: { query: target } })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.assets
    },
    enabled: !!(target?.entityId || target?.entityTypeId || target?.categoryId),
  })
}
