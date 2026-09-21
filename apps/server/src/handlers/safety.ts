import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { SafetyService } from '../services/SafetyService'

const safetyService = new SafetyService()

export async function listBlockedProfiles(request: AuthenticatedRequest, reply: any) {
  const data = await safetyService.listBlockedProfiles(requireProfileId(request.user))
  return reply.send({ data })
}

export async function blockProfile(request: AuthenticatedRequest, reply: any) {
  await safetyService.blockProfile(requireProfileId(request.user), request.body.blockedProfileId)
  return reply.status(201).send({ data: null })
}

export async function unblockProfile(request: AuthenticatedRequest, reply: any) {
  await safetyService.unblockProfile(requireProfileId(request.user), request.params.profileId)
  return reply.send({ data: null })
}

export async function submitReport(request: AuthenticatedRequest, reply: any) {
  const data = await safetyService.submitReport(requireProfileId(request.user), request.body)
  return reply.status(201).send({ data })
}
