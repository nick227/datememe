import { ProfileService } from '../services/ProfileService'

const profileService = new ProfileService()

export async function updateMyProfile(request: any, reply: any) {
  const profile = await profileService.updateMyProfile(request.user.profile.id, request.body)
  return reply.send({ data: profile })
}

export async function getProfile(request: any, reply: any) {
  const profile = await profileService.getProfile(
    request.user.id,
    request.user.profile.id,
    request.params.profileId,
  )
  return reply.send({ data: profile })
}
