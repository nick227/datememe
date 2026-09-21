import type { AuthenticatedRequest } from '../lib/userContext'
import { requireProfileId } from '../lib/userContext'
import { SwipeService } from '../services/SwipeService'

const swipeService = new SwipeService()

export async function submitSwipe(request: AuthenticatedRequest, reply: any) {
  const data = await swipeService.submitSwipe(
    request.user.id,
    requireProfileId(request.user),
    request.body.targetProfileId,
    request.body.action,
  )
  return reply.status(201).send({ data })
}
