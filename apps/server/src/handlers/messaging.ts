import { MessagingService } from '../services/MessagingService'

const messagingService = new MessagingService()

export async function listConversations(request: any, reply: any) {
  const result = await messagingService.listConversations(request.user.id, request.user.profile.id, request.query)
  return reply.send(result)
}

export async function listMessages(request: any, reply: any) {
  const result = await messagingService.listMessages(
    request.user.id,
    request.user.profile.id,
    request.params.conversationId,
    request.query,
  )
  return reply.send(result)
}

export async function sendMessage(request: any, reply: any) {
  const data = await messagingService.sendMessage(
    request.user.id,
    request.user.profile.id,
    request.params.conversationId,
    request.body.body,
  )
  return reply.status(201).send({ data })
}
