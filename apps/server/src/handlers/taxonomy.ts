import { TaxonomyService } from '../services/TaxonomyService'

const taxonomyService = new TaxonomyService()

export async function listEntityTypes(_request: any, reply: any) {
  const data = await taxonomyService.listEntityTypes()
  return reply.send({ data })
}

export async function listCategoryGroups(_request: any, reply: any) {
  const data = await taxonomyService.listCategoryGroups()
  return reply.send({ data })
}

export async function listCategories(request: any, reply: any) {
  const data = await taxonomyService.listCategories(request.query.groupSlug)
  return reply.send({ data })
}

export async function getCategory(request: any, reply: any) {
  const data = await taxonomyService.getCategory(request.params.categorySlug)
  return reply.send({ data })
}

export async function searchCategoryEntities(request: any, reply: any) {
  const result = await taxonomyService.searchCategoryEntities(
    request.params.categorySlug,
    request.user.profile.id,
    request.query,
  )
  return reply.send(result)
}

export async function submitEntity(request: any, reply: any) {
  const data = await taxonomyService.submitEntity(
    request.user.profile.id,
    request.body.entityTypeId,
    request.body.rawText,
  )
  return reply.status(201).send({ data })
}
