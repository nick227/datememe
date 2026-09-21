import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { ListService } from '../services/ListService'

const listService = new ListService()

export async function getMyLists(request: AuthenticatedRequest, reply: any) {
  const data = await listService.getMyLists(requireProfileId(request.user))
  return reply.send({ data })
}

export async function getProfileLists(request: AuthenticatedRequest, reply: any) {
  const data = await listService.getProfileLists(
    request.user.id,
    requireProfileId(request.user),
    request.params.profileId,
  )
  return reply.send({ data })
}

export async function upsertMyList(request: AuthenticatedRequest, reply: any) {
  const data = await listService.upsertMyList(requireProfileId(request.user), request.params.categorySlug, request.body)
  return reply.send({ data })
}
