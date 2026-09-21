import { db } from '@project/db'
import { resolveMembership, snapshotMemberFloor } from '../lib/entitlements'

// A LIFETIME/one-time purchase is a license, not recurring billing — it's
// represented as a MembershipGrant (expiresAt: null), never a Subscription
// row. This is the sentinel `currentPeriodEnd` used only to keep that grant
// expressible in the Subscription-shaped API response (getMySubscription /
// devPurchase both return this schema regardless of which table backs it).
const LIFETIME_SENTINEL_PERIOD_END = new Date('9999-12-31T00:00:00.000Z')

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

function serializeLifetimeGrantAsSubscription(grant: any, isActive: boolean) {
  return {
    id: grant.id,
    planId: grant.planId,
    provider: 'STRIPE',
    status: 'ACTIVE',
    currentPeriodEnd: LIFETIME_SENTINEL_PERIOD_END,
    isActive,
  }
}

export class SubscriptionService {
  async listPlans() {
    const plans = await db.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: 'asc' } })
    return plans.map(serializePlan)
  }

  async getMySubscription(userId: string) {
    const [sub, lifetimeGrant] = await Promise.all([
      db.subscription.findFirst({ where: { userId }, orderBy: { currentPeriodEnd: 'desc' } }),
      db.membershipGrant.findFirst({
        where: { userId, source: 'ONE_TIME_PURCHASE', revokedAt: null, expiresAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    const isMember = (await resolveMembership(userId)).state === 'MEMBER'
    // A lifetime purchase never expires, so it's always the more relevant
    // answer to "what's my current membership" over any lapsed subscription.
    if (lifetimeGrant) return serializeLifetimeGrantAsSubscription(lifetimeGrant, isMember)
    if (!sub) return null
    return serializeSubscription(sub, isMember)
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

    const floor = (await snapshotMemberFloor()) as any

    if (plan.interval === 'LIFETIME') {
      const grant = await db.membershipGrant.create({
        data: {
          userId,
          source: 'ONE_TIME_PURCHASE',
          reason: `One-time purchase: ${plan.label}`,
          expiresAt: null,
          entitlementFloor: floor,
          planId: plan.id,
          pricePaidCentsSnapshot: plan.priceCents,
        },
      })
      return serializeLifetimeGrantAsSubscription(grant, true)
    }

    const periodMs = plan.interval === 'ANNUAL' ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
    const sub = await db.subscription.create({
      data: {
        userId,
        planId: plan.id,
        provider: 'STRIPE',
        providerSubscriptionId: `dev_${userId}_${Date.now()}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + periodMs),
        entitlementFloor: floor,
        pricePaidCents: plan.priceCents,
      },
    })
    return serializeSubscription(sub, true)
  }
}
