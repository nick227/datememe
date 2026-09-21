import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { ProfileService } from '../services/ProfileService'

const profileService = new ProfileService()

export async function updateMyProfile(request: AuthenticatedRequest, reply: any) {
  const profile = await profileService.updateMyProfile(requireProfileId(request.user), request.body)
  return reply.send({ data: profile })
}

export async function getProfile(request: AuthenticatedRequest, reply: any) {
  const profile = await profileService.getProfile(
    request.user.id,
    requireProfileId(request.user),
    request.params.profileId,
  )
  return reply.send({ data: profile })
}
