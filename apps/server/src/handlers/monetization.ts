import { SubscriptionService } from '../services/SubscriptionService'

const subscriptionService = new SubscriptionService()

export async function listPlans(_request: any, reply: any) {
  const data = await subscriptionService.listPlans()
  return reply.send({ data })
}

export async function getMySubscription(request: any, reply: any) {
  const data = await subscriptionService.getMySubscription(request.user.id)
  return reply.send({ data })
}

export async function devPurchaseSubscription(request: any, reply: any) {
  const data = await subscriptionService.devPurchase(request.user.id, request.body.planSlug)
  return reply.status(201).send({ data })
}
