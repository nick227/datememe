import { SafetyService } from '../services/SafetyService'

const safetyService = new SafetyService()

export async function listBlockedProfiles(request: any, reply: any) {
  const data = await safetyService.listBlockedProfiles(request.user.profile.id)
  return reply.send({ data })
}

export async function blockProfile(request: any, reply: any) {
  await safetyService.blockProfile(request.user.profile.id, request.body.blockedProfileId)
  return reply.status(201).send({ data: null })
}

export async function unblockProfile(request: any, reply: any) {
  await safetyService.unblockProfile(request.user.profile.id, request.params.profileId)
  return reply.send({ data: null })
}

export async function submitReport(request: any, reply: any) {
  const data = await safetyService.submitReport(request.user.profile.id, request.body)
  return reply.status(201).send({ data })
}
