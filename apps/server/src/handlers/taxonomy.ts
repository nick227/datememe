import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { TaxonomyService } from '../services/TaxonomyService'

const taxonomyService = new TaxonomyService()

export async function listEntityTypes(_request: AuthenticatedRequest, reply: any) {
  const data = await taxonomyService.listEntityTypes()
  return reply.send({ data })
}

export async function listCategoryGroups(_request: AuthenticatedRequest, reply: any) {
  const data = await taxonomyService.listCategoryGroups()
  return reply.send({ data })
}

export async function listCategories(request: AuthenticatedRequest, reply: any) {
  const data = await taxonomyService.listCategories(requireProfileId(request.user), request.query.groupSlug)
  return reply.send({ data })
}

export async function getCategory(request: AuthenticatedRequest, reply: any) {
  const data = await taxonomyService.getCategory(request.params.categorySlug)
  return reply.send({ data })
}

export async function searchCategoryEntities(request: AuthenticatedRequest, reply: any) {
  const result = await taxonomyService.searchCategoryEntities(
    request.params.categorySlug,
    requireProfileId(request.user),
    request.query,
  )
  return reply.send(result)
}

export async function submitEntity(request: AuthenticatedRequest, reply: any) {
  const data = await taxonomyService.submitEntity(
    requireProfileId(request.user),
    request.body.entityTypeId,
    request.body.rawText,
  )
  return reply.status(201).send({ data })
}
