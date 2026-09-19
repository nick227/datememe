import { SwipeService } from '../services/SwipeService'

const swipeService = new SwipeService()

export async function submitSwipe(request: any, reply: any) {
  const data = await swipeService.submitSwipe(
    request.user.id,
    request.user.profile.id,
    request.body.targetProfileId,
    request.body.action,
  )
  return reply.status(201).send({ data })
}
