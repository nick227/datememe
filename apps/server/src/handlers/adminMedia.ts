import type { AuthenticatedRequest } from '../lib/userContext'
import { TaxonomyMediaService } from '../services/TaxonomyMediaService'

const mediaService = new TaxonomyMediaService()

function targetFromBody(body: any) {
  return {
    entityId: typeof body?.entityId === 'string' ? body.entityId : undefined,
    entityTypeId: typeof body?.entityTypeId === 'string' ? body.entityTypeId : undefined,
    categoryId: typeof body?.categoryId === 'string' ? body.categoryId : undefined,
  }
}

export async function searchTaxonomyImages(request: AuthenticatedRequest, reply: any) {
  const { query, entityTypeLabel, parentPath } = request.body ?? {}
  const candidates = await mediaService.search(query, entityTypeLabel, parentPath)
  return reply.send({ candidates })
}

export async function importTaxonomyImage(request: AuthenticatedRequest, reply: any) {
  const { candidate } = request.body ?? {}
  if (!candidate || typeof candidate.provider !== 'string' || typeof candidate.externalId !== 'string') {
    throw { statusCode: 400, message: 'A valid image candidate is required' }
  }
  const asset = await mediaService.importAndAttach(
    targetFromBody(request.body),
    candidate,
    request.user.id,
    request.user.role,
  )
  return reply.status(201).send({ asset })
}

export async function referenceTaxonomyImage(request: AuthenticatedRequest, reply: any) {
  const { candidate } = request.body ?? {}
  if (!candidate || typeof candidate.provider !== 'string' || typeof candidate.externalId !== 'string') {
    throw { statusCode: 400, message: 'A valid image candidate is required' }
  }
  const asset = await mediaService.attachReference(
    targetFromBody(request.body),
    candidate,
    request.user.id,
    request.user.role,
  )
  return reply.status(201).send({ asset })
}

export async function uploadTaxonomyImage(request: AuthenticatedRequest, reply: any) {
  const file = await request.file()
  if (!file) throw { statusCode: 400, message: 'No image file was uploaded' }

  const fields = file.fields ?? {}
  const fieldValue = (name: string) => {
    const field = fields[name]
    return field && !Array.isArray(field) && field.type === 'field' ? field.value : undefined
  }
  const target = targetFromBody({
    entityId: fieldValue('entityId'),
    entityTypeId: fieldValue('entityTypeId'),
    categoryId: fieldValue('categoryId'),
  })
  const cropValue = fieldValue('crop')
  const crop = cropValue ? JSON.parse(String(cropValue)) : undefined
  const asset = await mediaService.uploadAndAttach({
    target,
    buffer: await file.toBuffer(),
    originalName: file.filename,
    mimeType: file.mimetype,
    crop,
    actorUserId: request.user.id,
    actorRole: request.user.role,
  })
  return reply.status(201).send({ asset })
}

export async function listTaxonomyImages(request: AuthenticatedRequest, reply: any) {
  const assets = await mediaService.listAssets(targetFromBody(request.query))
  return reply.send({ assets })
}
