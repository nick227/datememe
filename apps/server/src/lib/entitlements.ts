import { db } from '@project/db'

export type ProductLimit = number | 'UNLIMITED'
export type Entitlements = {
  'profile.fullPhotoAccess': boolean
  'messaging.readIncoming': boolean
  'messaging.dailySendLimit': ProductLimit
  'lists.memberOnly': boolean
}

export const ENTITLEMENT_KEYS = ['profile.fullPhotoAccess', 'messaging.readIncoming', 'messaging.dailySendLimit', 'lists.memberOnly'] as const

// Seed/fallback values — used for any (state, key) that has no EntitlementPolicy
// row yet, so the product works before an admin ever touches Member Features.
export const ENTITLEMENT_DEFAULTS: Record<'FREE' | 'MEMBER', Entitlements> = {
  FREE: { 'profile.fullPhotoAccess': false, 'messaging.readIncoming': false, 'messaging.dailySendLimit': 3, 'lists.memberOnly': false },
  MEMBER: { 'profile.fullPhotoAccess': true, 'messaging.readIncoming': true, 'messaging.dailySendLimit': 'UNLIMITED', 'lists.memberOnly': true },
}

// A row's `value` is stored as JSON — booleans round-trip as-is, the one
// numeric-or-'UNLIMITED' key round-trips as either a JSON number or string.
export async function getPolicyEntitlements(state: 'FREE' | 'MEMBER'): Promise<Entitlements> {
  const rows = await db.entitlementPolicy.findMany({ where: { state } })
  const result = { ...ENTITLEMENT_DEFAULTS[state] }
  for (const row of rows) {
    if ((ENTITLEMENT_KEYS as readonly string[]).includes(row.key)) {
      ;(result as any)[row.key] = row.value
    }
  }
  return result
}

export async function setPolicyEntitlement(state: 'FREE' | 'MEMBER', key: keyof Entitlements, value: boolean | ProductLimit, updatedByUserId: string) {
  await db.entitlementPolicy.upsert({
    where: { state_key: { state, key } },
    create: { state, key, value: value as any, updatedByUserId },
    update: { value: value as any, updatedByUserId },
  })
}

// A subscription/grant's protected floor at the moment it grants MEMBER —
// call this right when creating one, never later (grandfathering is about
// what was promised *then*, not what the policy happens to say right now).
export async function snapshotMemberFloor(): Promise<Entitlements> {
  return getPolicyEntitlements('MEMBER')
}

function moreGenerous<K extends keyof Entitlements>(a: Entitlements[K], b: Entitlements[K]): Entitlements[K] {
  if (typeof a === 'boolean' || typeof b === 'boolean') return ((a === true || b === true) as Entitlements[K])
  if (a === 'UNLIMITED' || b === 'UNLIMITED') return 'UNLIMITED' as Entitlements[K]
  return Math.max(a as number, b as number) as Entitlements[K]
}

type ActiveSources = {
  subscriptions: { id: string; provider: string; currentPeriodEnd: Date; entitlementFloor: unknown }[]
  grants: { id: string; source: string; expiresAt: Date | null; entitlementFloor: unknown }[]
  globalWindow: { id: string; endAt: Date } | null
}

async function getActiveSources(userId: string, now: Date): Promise<ActiveSources> {
  const [subscriptions, grants, globalWindow] = await Promise.all([
    db.subscription.findMany({
      where: { userId, status: { in: ['ACTIVE', 'TRIALING'] }, currentPeriodEnd: { gt: now } },
      select: { id: true, provider: true, currentPeriodEnd: true, entitlementFloor: true },
      orderBy: { id: 'asc' },
    }),
    db.membershipGrant.findMany({
      where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { id: true, source: true, expiresAt: true, entitlementFloor: true },
      orderBy: { id: 'asc' },
    }),
    db.globalMembershipWindow.findFirst({
      where: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
      select: { id: true, endAt: true },
    }),
  ])
  return { subscriptions, grants, globalWindow }
}

export async function resolveMembership(userId: string, now = new Date()) {
  const { subscriptions, grants, globalWindow } = await getActiveSources(userId, now)
  const sources = [
    ...subscriptions.map((s) => ({ kind: s.provider === 'MANUAL' ? ('MANUAL_SUBSCRIPTION' as const) : ('SUBSCRIPTION' as const), id: s.id, expiresAt: s.currentPeriodEnd.toISOString() })),
    ...grants.map((g) => ({ kind: g.source as 'MANUAL_ADMIN' | 'SIGNUP_PROMOTION' | 'COUPON_REDEMPTION' | 'ONE_TIME_PURCHASE', id: g.id, expiresAt: g.expiresAt?.toISOString() ?? null })),
    ...(globalWindow ? [{ kind: 'GLOBAL_PROMOTION' as const, id: globalWindow.id, expiresAt: globalWindow.endAt.toISOString() }] : []),
  ]
  return {
    state: sources.length ? ('MEMBER' as const) : ('FREE' as const),
    sources,
  }
}

export async function resolveEntitlements(userId: string, now = new Date()): Promise<Entitlements> {
  const { subscriptions, grants, globalWindow } = await getActiveSources(userId, now)
  const isMember = subscriptions.length > 0 || grants.length > 0 || !!globalWindow
  const base = await getPolicyEntitlements(isMember ? 'MEMBER' : 'FREE')
  if (!isMember) return base

  // Grandfathering: a policy reduction after this subscription/grant was
  // created never takes away what it already promised — take the more
  // generous value, per key, between live policy and every active floor.
  let result = { ...base }
  for (const source of [...subscriptions, ...grants]) {
    const floor = source.entitlementFloor as Entitlements | null
    if (!floor) continue
    for (const key of ENTITLEMENT_KEYS) {
      ;(result as any)[key] = moreGenerous(result[key], floor[key])
    }
  }
  return result
}

export function enforceLimit(limit: ProductLimit, used: number, message: string) {
  if (limit !== 'UNLIMITED' && used >= limit) throw { statusCode: 403, message }
}

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
