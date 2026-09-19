import { ListService } from '../services/ListService'

const listService = new ListService()

export async function getMyLists(request: any, reply: any) {
  const data = await listService.getMyLists(request.user.profile.id)
  return reply.send({ data })
}

export async function getProfileLists(request: any, reply: any) {
  const data = await listService.getProfileLists(
    request.user.id,
    request.user.profile.id,
    request.params.profileId,
  )
  return reply.send({ data })
}

export async function upsertMyList(request: any, reply: any) {
  const data = await listService.upsertMyList(request.user.profile.id, request.params.categorySlug, request.body)
  return reply.send({ data })
}
