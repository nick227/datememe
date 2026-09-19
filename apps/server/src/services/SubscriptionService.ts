import { db } from '@project/db'
import { isPremiumUser } from '../lib/entitlements'

function serializePlan(plan: any) {
  return {
    id: plan.id,
    slug: plan.slug,
    label: plan.label,
    interval: plan.interval,
    priceCents: plan.priceCents,
    currency: plan.currency,
  }
}

function serializeSubscription(sub: any, isActive: boolean) {
  return {
    id: sub.id,
    planId: sub.planId,
    provider: sub.provider,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    isActive,
  }
}

export class SubscriptionService {
  async listPlans() {
    const plans = await db.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: 'asc' } })
    return plans.map(serializePlan)
  }

  async getMySubscription(userId: string) {
    const sub = await db.subscription.findFirst({
      where: { userId },
      orderBy: { currentPeriodEnd: 'desc' },
    })
    if (!sub) return null
    return serializeSubscription(sub, await isPremiumUser(userId))
  }

  /**
   * Dev/staging only (docs: DevPurchaseInput) — simulates a completed purchase without a
   * real Apple/Google receipt so the paywall flow (photo gate, message cap/receive gate)
   * is testable before native IAP wiring lands. Real IAP validation is a follow-up.
   */
  async devPurchase(userId: string, planSlug: string) {
    if (process.env.NODE_ENV === 'production') {
      throw { statusCode: 403, message: 'Dev purchase endpoint is disabled in production' }
    }
    const plan = await db.plan.findUnique({ where: { slug: planSlug } })
    if (!plan) throw { statusCode: 404, message: 'Plan not found' }

    const periodMs = plan.interval === 'ANNUAL' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
    const sub = await db.subscription.create({
      data: {
        userId,
        planId: plan.id,
        provider: 'STRIPE',
        providerSubscriptionId: `dev_${userId}_${Date.now()}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + periodMs),
      },
    })
    return serializeSubscription(sub, true)
  }
}
