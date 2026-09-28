import type { AuthenticatedRequest } from '../lib/userContext'
import { ListAdminService, type ListSort, type ListStatusFilter } from '../services/ListAdminService'
import { ListCoverService } from '../services/ListCoverService'

// Admin → Lists (docs/admin-lists-roadmap.md, Phase 1).

const lists = new ListAdminService()
const covers = new ListCoverService()
const actor = (request: AuthenticatedRequest) => ({ id: request.user.id, role: request.user.role })

export async function getAdminLists(request: AuthenticatedRequest, reply: any) {
  const q = request.query ?? {}
  return reply.send(await lists.browse({
    q: q.q, status: q.status as ListStatusFilter, groupId: q.groupId, sort: q.sort as ListSort,
    limit: q.limit ? Number(q.limit) : undefined, offset: q.offset ? Number(q.offset) : undefined,
  }))
}

export async function createAdminList(request: AuthenticatedRequest, reply: any) {
  return reply.status(201).send({ list: await lists.create(request.body ?? {}, actor(request)) })
}

export async function getAdminList(request: AuthenticatedRequest, reply: any) {
  return reply.send({ list: await lists.detail(request.params.id) })
}

export async function updateAdminList(request: AuthenticatedRequest, reply: any) {
  return reply.send({ list: await lists.update(request.params.id, request.body ?? {}, actor(request)) })
}

export async function setAdminListValues(request: AuthenticatedRequest, reply: any) {
  return reply.send({ list: await lists.setValues(request.params.id, request.body?.entityIds, actor(request)) })
}

export async function addAdminListValue(request: AuthenticatedRequest, reply: any) {
  return reply.send(await lists.addValue(request.params.id, request.body ?? {}, actor(request)))
}

export async function suggestAdminListCover(request: AuthenticatedRequest, reply: any) {
  await covers.suggest(request.params.id, actor(request))
  return reply.status(202).send({ list: await lists.detail(request.params.id) })
}

export async function setAdminListCover(request: AuthenticatedRequest, reply: any) {
  const { action, candidateId } = request.body ?? {}
  const id = request.params.id
  if (action === 'use') {
    if (typeof candidateId !== 'string') throw { statusCode: 400, message: 'candidateId is required' }
    await covers.use(id, candidateId, actor(request))
  } else if (action === 'none') await covers.none(id, actor(request))
  else if (action === 'revert') await covers.revert(id, actor(request))
  else throw { statusCode: 400, message: 'action must be use, none or revert' }
  return reply.send({ list: await lists.detail(id) })
}
