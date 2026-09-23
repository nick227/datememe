import { useQuery } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { operations } from '../generated/types'
export type CatalogCommand = operations['commandAdminCatalog']['requestBody']['content']['application/json']
export type CatalogRules = { minItems: number; maxItems: number; orderingMode: 'RANKED' | 'UNRANKED' }
export type CatalogConcept = { id: string; key: string; label: string; status: string; _count: { drafts: number } }
export type CatalogFacet = { id: string; axis: string; value: string }
export type CatalogEntity = { id: string; canonicalName: string; slug: string; facets?: CatalogFacet[] }
export type CatalogCandidate = { id: string; name: string; slug: string; details: string; resolutionState: string; resolvedEntityId: string | null; reviewState: string; entity?: CatalogEntity | null }
export type CatalogDraft = { id: string; conceptId: string; title: string; prompt: string; slug: string; groupId: string | null; entityTypeId: string | null; approvalState: 'DRAFT' | 'APPROVED' | 'REJECTED'; rules: CatalogRules; publishedCategoryId: string | null; concept?: CatalogConcept; candidates?: CatalogCandidate[]; _count?: { candidates: number } }
export type CatalogOperation = { id: string; kind: string; status: string; targetId: string | null; error?: string | null; output?: { items: { axis: string; value: string; reason: string }[] }; model?: string; systemPrompt?: string; userPrompt?: string; promptVersion?: string }
export type CatalogState = { concepts: CatalogConcept[]; conceptCount: number; drafts: CatalogDraft[]; draftCount: number; operations: CatalogOperation[]; groups: { id: string; label: string }[]; types: { id: string; label: string }[]; draft: CatalogDraft | null }
export function useAdminCatalog(query: { conceptId?: string; draftId?: string; offset?: number } = {}) {
  return useQuery({ queryKey: ['admin', 'catalog', query], queryFn: async () => {
    const { data, error, response } = await getApiClient().GET('/admin/catalog', { params: { query } })
    if (!response.ok) throw new ApiError(response.status, (error as any)?.error || 'Unable to load content workspace')
    return data as unknown as CatalogState
  } })
}
export async function catalogCommand<T = unknown>(body: CatalogCommand): Promise<T> {
  const { data, error, response } = await getApiClient().POST('/admin/catalog', { body })
  if (!response.ok) throw new ApiError(response.status, (error as any)?.error || 'Content action failed')
  return data!.result as T
}
