import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { db } from '@project/db'
import { resolveEntitlements, resolveMembership, snapshotMemberFloor } from '../lib/entitlements'
import { MembershipService } from '../services/MembershipService'
import { SubscriptionService } from '../services/SubscriptionService'

const service = new MembershipService()
const subscriptionService = new SubscriptionService()

describe('Phase 7 — membership', () => {
  let user: any
  const cleanupUserIds: string[] = []
  const cleanupPromotionIds: string[] = []
  const cleanupCouponIds: string[] = []
  const cleanupWindowIds: string[] = []

  async function makeUser(email: string) {
    const created = await db.user.create({
      data: {
        email,
        passwordHash: 'hash',
        role: 'USER',
        profile: { create: { username: email.split('@')[0] ?? email, displayName: 'Test', birthdate: new Date('1990-01-01') } },
      },
    })
    cleanupUserIds.push(created.id)
    return created
  }

  beforeAll(async () => {
    user = await makeUser(`membership-${Date.now()}@example.com`)
  })

  afterEach(async () => {
    // Reset any per-test grants/policy overrides so tests don't bleed into each other.
    await db.membershipGrant.deleteMany({ where: { userId: { in: cleanupUserIds } } })
    await db.entitlementPolicy.deleteMany({})
  })

  afterAll(async () => {
    await db.couponRedemption.deleteMany({ where: { userId: { in: cleanupUserIds } } })
    await db.couponCode.deleteMany({ where: { id: { in: cleanupCouponIds } } })
    await db.signupPromotion.deleteMany({ where: { id: { in: cleanupPromotionIds } } })
    await db.globalMembershipWindow.deleteMany({ where: { id: { in: cleanupWindowIds } } })
    await db.membershipGrant.deleteMany({ where: { userId: { in: cleanupUserIds } } })
    await db.session.deleteMany({ where: { userId: { in: cleanupUserIds } } })
    await db.profile.deleteMany({ where: { userId: { in: cleanupUserIds } } })
    await db.user.deleteMany({ where: { id: { in: cleanupUserIds } } })
  })

  it('FREE user has no membership sources and default entitlements', async () => {
    const membership = await resolveMembership(user.id)
    expect(membership.state).toBe('FREE')
    expect(membership.sources).toHaveLength(0)
    const entitlements = await resolveEntitlements(user.id)
    expect(entitlements['profile.fullPhotoAccess']).toBe(false)
  })

  it('a lifetime grant flips the user to MEMBER with entitlements from live policy', async () => {
    const grant = await service.createGrant({ userId: user.id, expiresAt: null, reason: 'test', grantedByUserId: user.id })
    expect(grant.expiresAt).toBeNull()

    const membership = await resolveMembership(user.id)
    expect(membership.state).toBe('MEMBER')
    expect(membership.sources[0]).toMatchObject({ kind: 'MANUAL_ADMIN', id: grant.id, expiresAt: null })

    const entitlements = await resolveEntitlements(user.id)
    expect(entitlements['profile.fullPhotoAccess']).toBe(true)
    expect(entitlements['messaging.dailySendLimit']).toBe('UNLIMITED')
  })

  it('an expired grant does not count as MEMBER', async () => {
    await service.createGrant({ userId: user.id, expiresAt: new Date(Date.now() - 1000), reason: 'already expired', grantedByUserId: user.id })
    const membership = await resolveMembership(user.id)
    expect(membership.state).toBe('FREE')
  })

  it('revoking a grant immediately drops the user to FREE', async () => {
    const grant = await service.createGrant({ userId: user.id, expiresAt: null, reason: 'test', grantedByUserId: user.id })
    expect((await resolveMembership(user.id)).state).toBe('MEMBER')

    await service.revokeGrant(grant.id, user.id, 'test revoke')
    expect((await resolveMembership(user.id)).state).toBe('FREE')

    await expect(service.revokeGrant(grant.id, user.id, 'again')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('grandfathering: a policy reduction after a grant is created does not take away what the grant already promised', async () => {
    const grant = await service.createGrant({ userId: user.id, expiresAt: null, reason: 'test', grantedByUserId: user.id })
    expect((await resolveEntitlements(user.id))['lists.memberOnly']).toBe(true)

    // Reduce the live MEMBER policy after the grant was already created.
    await service.updateEntitlementPolicy('MEMBER', 'lists.memberOnly', false, user.id)

    const livePolicy = await service.getEntitlementPolicy()
    expect(livePolicy.MEMBER['lists.memberOnly']).toBe(false)

    // This specific grant holder keeps the better (grandfathered) value.
    const entitlements = await resolveEntitlements(user.id)
    expect(entitlements['lists.memberOnly']).toBe(true)

    // A brand-new grant created *after* the reduction gets the new, lower value.
    const otherUser = await makeUser(`membership-other-${Date.now()}@example.com`)
    await service.createGrant({ userId: otherUser.id, expiresAt: null, reason: 'test', grantedByUserId: user.id })
    expect((await resolveEntitlements(otherUser.id))['lists.memberOnly']).toBe(false)

    void grant
  })

  it('a policy improvement flows through immediately to an existing grant holder', async () => {
    await service.createGrant({ userId: user.id, expiresAt: null, reason: 'test', grantedByUserId: user.id })
    // Sanity: MEMBER default for readIncoming is already true; flip FREE up instead to prove "improvement flows through" on a fresh FREE user.
    const freeUser = await makeUser(`membership-free-${Date.now()}@example.com`)
    expect((await resolveEntitlements(freeUser.id))['messaging.readIncoming']).toBe(false)
    await service.updateEntitlementPolicy('FREE', 'messaging.readIncoming', true, user.id)
    expect((await resolveEntitlements(freeUser.id))['messaging.readIncoming']).toBe(true)
  })

  it('signup promotion: applySignupPromotionsForNewUser grants MEMBER only inside [startAt, endAt)', async () => {
    const now = new Date()
    const promo = await service.createSignupPromotion({
      label: 'test promo',
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 60_000),
      awardType: 'LIFETIME_MEMBER',
      durationDays: null,
      createdByUserId: user.id,
    })
    cleanupPromotionIds.push(promo.id)

    const newUser = await makeUser(`membership-signup-${Date.now()}@example.com`)
    const grants = await service.applySignupPromotionsForNewUser(newUser.id, now)
    expect(grants).toHaveLength(1)
    expect((await resolveMembership(newUser.id)).state).toBe('MEMBER')

    // Outside the window: no grant.
    const outsideUser = await makeUser(`membership-signup-outside-${Date.now()}@example.com`)
    const outsideGrants = await service.applySignupPromotionsForNewUser(outsideUser.id, new Date(now.getTime() + 3600_000))
    expect(outsideGrants).toHaveLength(0)
  })

  it('coupon: a FULL redemption grants MEMBER with immutable snapshotted terms; a PERCENTAGE redemption does not', async () => {
    const fullCoupon = await service.createCoupon({
      code: `full-${Date.now()}`,
      discountType: 'FULL',
      discountPercent: 100,
      grantDurationDays: 30,
      campaign: 'launch',
      partner: null,
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
      startAt: null,
      endAt: null,
      createdByUserId: user.id,
    })
    cleanupCouponIds.push(fullCoupon.id)

    const redeemer = await makeUser(`membership-redeemer-${Date.now()}@example.com`)
    const { redemption, grant } = await service.redeemCoupon(redeemer.id, fullCoupon.code)
    expect(grant).not.toBeNull()
    expect(redemption.campaignSnapshot).toBe('launch')
    expect((await resolveMembership(redeemer.id)).state).toBe('MEMBER')

    // Editing the coupon afterward must not rewrite the redemption's snapshot.
    await service.updateCoupon(fullCoupon.id, { campaign: 'renamed-later' })
    const [savedRedemption] = await service.listRedemptions(fullCoupon.id)
    expect(savedRedemption?.campaignSnapshot).toBe('launch')

    // Per-user redemption limit.
    await expect(service.redeemCoupon(redeemer.id, fullCoupon.code)).rejects.toMatchObject({ statusCode: 409 })

    const pctCoupon = await service.createCoupon({
      code: `pct-${Date.now()}`,
      discountType: 'PERCENTAGE',
      discountPercent: 30,
      grantDurationDays: null,
      campaign: null,
      partner: null,
      maxRedemptions: null,
      maxRedemptionsPerUser: 1,
      startAt: null,
      endAt: null,
      createdByUserId: user.id,
    })
    cleanupCouponIds.push(pctCoupon.id)

    const pctResult = await service.redeemCoupon(redeemer.id, pctCoupon.code)
    expect(pctResult.grant).toBeNull()
    expect((await resolveMembership(redeemer.id)).state).toBe('MEMBER') // still MEMBER from the earlier FULL coupon's grant, not from this one
  })

  it('global membership window elevates every user without a per-user grant', async () => {
    const now = new Date()
    const window = await service.createGlobalWindow({
      label: 'test window',
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 60_000),
      createdByUserId: user.id,
    })
    cleanupWindowIds.push(window.id)

    const freshUser = await makeUser(`membership-global-${Date.now()}@example.com`)
    const membership = await resolveMembership(freshUser.id, now)
    expect(membership.state).toBe('MEMBER')
    expect(membership.sources[0]).toMatchObject({ kind: 'GLOBAL_PROMOTION', id: window.id })

    const grantCount = await db.membershipGrant.count({ where: { userId: freshUser.id } })
    expect(grantCount).toBe(0)

    // Outside the window: back to FREE.
    expect((await resolveMembership(freshUser.id, new Date(now.getTime() + 3600_000))).state).toBe('FREE')
  })

  it('snapshotMemberFloor reflects the live MEMBER policy at call time', async () => {
    await service.updateEntitlementPolicy('MEMBER', 'messaging.dailySendLimit', 42, user.id)
    const floor = await snapshotMemberFloor()
    expect(floor['messaging.dailySendLimit']).toBe(42)
  })

  it('a LIFETIME plan dev-purchase is a license (MembershipGrant), never an expiring Subscription', async () => {
    const buyer = await makeUser(`membership-lifetime-${Date.now()}@example.com`)
    const plan = await db.plan.create({
      data: { label: 'Lifetime Test', slug: `lifetime-test-${Date.now()}`, interval: 'LIFETIME', priceCents: 12000 },
    })

    const result = await subscriptionService.devPurchase(buyer.id, plan.slug)
    expect(result.isActive).toBe(true)

    const subCount = await db.subscription.count({ where: { userId: buyer.id } })
    expect(subCount).toBe(0)

    const grant = await db.membershipGrant.findFirst({ where: { userId: buyer.id, source: 'ONE_TIME_PURCHASE' } })
    expect(grant).toBeTruthy()
    expect(grant?.expiresAt).toBeNull()
    expect(grant?.planId).toBe(plan.id)
    expect(grant?.pricePaidCentsSnapshot).toBe(12000)

    const membership = await resolveMembership(buyer.id)
    expect(membership.state).toBe('MEMBER')
    expect(membership.sources[0]).toMatchObject({ kind: 'ONE_TIME_PURCHASE', id: grant!.id, expiresAt: null })

    // getMySubscription still returns a Subscription-shaped response for API
    // compatibility, backed by the grant rather than a Subscription row.
    const mine = await subscriptionService.getMySubscription(buyer.id)
    expect(mine?.planId).toBe(plan.id)
    expect(mine?.isActive).toBe(true)

    // Repricing the plan afterward never touches what this buyer already paid.
    await db.plan.update({ where: { id: plan.id }, data: { priceCents: 20000 } })
    const unchangedGrant = await db.membershipGrant.findUnique({ where: { id: grant!.id } })
    expect(unchangedGrant?.pricePaidCentsSnapshot).toBe(12000)

    await db.membershipGrant.deleteMany({ where: { userId: buyer.id } })
    await db.plan.delete({ where: { id: plan.id } })
  })
})
