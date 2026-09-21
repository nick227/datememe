import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { MessagingService } from '../services/MessagingService'

const messagingService = new MessagingService()

export async function listConversations(request: AuthenticatedRequest, reply: any) {
  const result = await messagingService.listConversations(request.user.id, requireProfileId(request.user), request.query)
  return reply.send(result)
}

export async function listMessages(request: AuthenticatedRequest, reply: any) {
  const result = await messagingService.listMessages(
    request.user.id,
    requireProfileId(request.user),
    request.params.conversationId,
    request.query,
  )
  return reply.send(result)
}

export async function sendMessage(request: AuthenticatedRequest, reply: any) {
  const data = await messagingService.sendMessage(
    request.user.id,
    requireProfileId(request.user),
    request.params.conversationId,
    request.body.body,
    request.body.attachments,
  )
  return reply.status(201).send({ data })
}

export async function unmatchConversation(request: AuthenticatedRequest, reply: any) {
  const data = await messagingService.unmatchConversation(requireProfileId(request.user), request.params.conversationId)
  return reply.send({ data })
}

export async function markAsRead(request: AuthenticatedRequest, reply: any) {
  const data = await messagingService.markAsRead(
    requireProfileId(request.user),
    request.params.conversationId
  )
  return reply.send({ data })
}
