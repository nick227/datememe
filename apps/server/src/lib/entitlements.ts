import { db } from '@project/db'

export type ProductLimit = number | 'UNLIMITED'
export type Entitlements = {
  'profile.fullPhotoAccess': boolean
  'messaging.readIncoming': boolean
  'messaging.dailySendLimit': ProductLimit
  'lists.memberOnly': boolean
}

// Preserve existing product behavior during the foundation migration.
export const ENTITLEMENT_DEFAULTS: Record<'FREE' | 'MEMBER', Entitlements> = {
  FREE: { 'profile.fullPhotoAccess': false, 'messaging.readIncoming': false, 'messaging.dailySendLimit': 3, 'lists.memberOnly': false },
  MEMBER: { 'profile.fullPhotoAccess': true, 'messaging.readIncoming': true, 'messaging.dailySendLimit': 'UNLIMITED', 'lists.memberOnly': true },
}

export async function resolveMembership(userId: string, now = new Date()) {
  const subscriptions = await db.subscription.findMany({
    where: { userId, status: { in: ['ACTIVE', 'TRIALING'] }, currentPeriodEnd: { gt: now } },
    select: { id: true, provider: true, currentPeriodEnd: true },
    orderBy: { id: 'asc' },
  })
  return {
    state: subscriptions.length ? 'MEMBER' as const : 'FREE' as const,
    sources: subscriptions.map(s => ({ kind: s.provider === 'MANUAL' ? 'MANUAL_SUBSCRIPTION' as const : 'SUBSCRIPTION' as const, id: s.id, expiresAt: s.currentPeriodEnd.toISOString() })),
  }
}

export async function resolveEntitlements(userId: string): Promise<Entitlements> {
  return { ...ENTITLEMENT_DEFAULTS[(await resolveMembership(userId)).state] }
}

export function enforceLimit(limit: ProductLimit, used: number, message: string) {
  if (limit !== 'UNLIMITED' && used >= limit) throw { statusCode: 403, message }
}

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
