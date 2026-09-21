import { db, Prisma } from '@project/db'
import { ENTITLEMENT_KEYS, getPolicyEntitlements, setPolicyEntitlement, snapshotMemberFloor, type Entitlements } from '../lib/entitlements'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

export class MembershipService {
  // ── Entitlement policy ──────────────────────────────────
  async getEntitlementPolicy() {
    const [FREE, MEMBER] = await Promise.all([getPolicyEntitlements('FREE'), getPolicyEntitlements('MEMBER')])
    return { FREE, MEMBER }
  }

  async updateEntitlementPolicy(state: 'FREE' | 'MEMBER', key: keyof Entitlements, value: boolean | number | 'UNLIMITED', actorUserId: string) {
    if (!(ENTITLEMENT_KEYS as readonly string[]).includes(key)) throw { statusCode: 400, message: 'Unknown entitlement key' }
    if (key === 'messaging.dailySendLimit') {
      if (value !== 'UNLIMITED' && !(typeof value === 'number' && Number.isInteger(value) && value >= 0)) {
        throw { statusCode: 400, message: 'messaging.dailySendLimit must be a non-negative integer or "UNLIMITED"' }
      }
    } else if (typeof value !== 'boolean') {
      throw { statusCode: 400, message: `${key} must be a boolean` }
    }
    await setPolicyEntitlement(state, key, value, actorUserId)
    return this.getEntitlementPolicy()
  }

  // ── Grants ───────────────────────────────────────────────
  async listGrants(opts: { userId?: string; cursor?: string; limit?: number }) {
    const cursor = decodeCursor(opts.cursor)
    const limit = normalizeLimit(opts.limit)
    const grants = await db.membershipGrant.findMany({
      where: {
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }] } : {}),
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { username: true, displayName: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    const hasMore = grants.length > limit
    const page = grants.slice(0, limit)
    const last = page[page.length - 1]
    return { grants: page, hasMore, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null }
  }

  async createGrant(input: { userId: string; expiresAt: Date | null; reason: string | null; grantedByUserId: string }) {
    const user = await db.user.findUnique({ where: { id: input.userId } })
    if (!user) throw { statusCode: 404, message: 'User not found' }

    return db.membershipGrant.create({
      data: {
        userId: input.userId,
        source: 'MANUAL_ADMIN',
        reason: input.reason,
        expiresAt: input.expiresAt,
        entitlementFloor: (await snapshotMemberFloor()) as any,
        grantedByUserId: input.grantedByUserId,
      },
    })
  }

  async revokeGrant(grantId: string, revokedByUserId: string, revokeReason: string | null) {
    const grant = await db.membershipGrant.findUnique({ where: { id: grantId } })
    if (!grant) throw { statusCode: 404, message: 'Grant not found' }
    if (grant.revokedAt) throw { statusCode: 400, message: 'Grant is already revoked' }

    return db.membershipGrant.update({
      where: { id: grantId },
      data: { revokedAt: new Date(), revokedByUserId, revokeReason },
    })
  }

  // ── Signup promotions ────────────────────────────────────
  async listSignupPromotions() {
    return db.signupPromotion.findMany({
      orderBy: { startAt: 'desc' },
      include: { _count: { select: { grants: true } } },
    })
  }

  async createSignupPromotion(input: { label: string; startAt: Date; endAt: Date; awardType: 'LIFETIME_MEMBER' | 'TEMPORARY_MEMBER'; durationDays: number | null; createdByUserId: string }) {
    if (input.endAt <= input.startAt) throw { statusCode: 400, message: 'endAt must be after startAt' }
    if (input.awardType === 'TEMPORARY_MEMBER' && (!input.durationDays || input.durationDays < 1)) {
      throw { statusCode: 400, message: 'durationDays is required for a temporary award' }
    }
    const created = await db.signupPromotion.create({
      data: {
        label: input.label,
        startAt: input.startAt,
        endAt: input.endAt,
        awardType: input.awardType,
        durationDays: input.awardType === 'TEMPORARY_MEMBER' ? input.durationDays : null,
        createdByUserId: input.createdByUserId,
      },
    })
    return { ...created, _count: { grants: 0 } }
  }

  async updateSignupPromotion(id: string, input: { label?: string; startAt?: Date; endAt?: Date; awardType?: 'LIFETIME_MEMBER' | 'TEMPORARY_MEMBER'; durationDays?: number | null; isActive?: boolean }) {
    const existing = await db.signupPromotion.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Signup promotion not found' }
    const startAt = input.startAt ?? existing.startAt
    const endAt = input.endAt ?? existing.endAt
    if (endAt <= startAt) throw { statusCode: 400, message: 'endAt must be after startAt' }
    const awardType = input.awardType ?? existing.awardType
    const durationDays = awardType === 'TEMPORARY_MEMBER' ? (input.durationDays ?? existing.durationDays) : null
    if (awardType === 'TEMPORARY_MEMBER' && (!durationDays || durationDays < 1)) {
      throw { statusCode: 400, message: 'durationDays is required for a temporary award' }
    }
    return db.signupPromotion.update({
      where: { id },
      data: {
        label: input.label ?? existing.label,
        startAt,
        endAt,
        awardType,
        durationDays,
        isActive: input.isActive ?? existing.isActive,
      },
      include: { _count: { select: { grants: true } } },
    })
  }

  // Called from AuthService.register right after the user row is created.
  // Applies every currently-active [startAt,endAt) promotion — in the
  // ordinary case there's at most one, but nothing stops an admin from
  // running two at once, and awarding both is harmless (still just MEMBER).
  async applySignupPromotionsForNewUser(userId: string, now = new Date()) {
    const promotions = await db.signupPromotion.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gt: now } },
    })
    if (promotions.length === 0) return []

    const floor = (await snapshotMemberFloor()) as any
    return Promise.all(
      promotions.map((promo) =>
        db.membershipGrant.create({
          data: {
            userId,
            source: 'SIGNUP_PROMOTION',
            reason: `Signup promotion: ${promo.label}`,
            expiresAt: promo.awardType === 'LIFETIME_MEMBER' ? null : addDays(now, promo.durationDays!),
            entitlementFloor: floor,
            signupPromotionId: promo.id,
          },
        }),
      ),
    )
  }

  // ── Global membership windows ────────────────────────────
  async listGlobalWindows() {
    return db.globalMembershipWindow.findMany({ orderBy: { startAt: 'desc' } })
  }

  async createGlobalWindow(input: { label: string; startAt: Date; endAt: Date; createdByUserId: string }) {
    if (input.endAt <= input.startAt) throw { statusCode: 400, message: 'endAt must be after startAt' }
    return db.globalMembershipWindow.create({ data: input })
  }

  async updateGlobalWindow(id: string, input: { label?: string; startAt?: Date; endAt?: Date; isActive?: boolean }) {
    const existing = await db.globalMembershipWindow.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Global membership window not found' }
    const startAt = input.startAt ?? existing.startAt
    const endAt = input.endAt ?? existing.endAt
    if (endAt <= startAt) throw { statusCode: 400, message: 'endAt must be after startAt' }
    return db.globalMembershipWindow.update({
      where: { id },
      data: { label: input.label ?? existing.label, startAt, endAt, isActive: input.isActive ?? existing.isActive },
    })
  }

  // ── Coupons ───────────────────────────────────────────────
  async listCoupons() {
    return db.couponCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    })
  }

  async createCoupon(input: {
    code: string
    discountType: 'PERCENTAGE' | 'FULL'
    discountPercent: number
    grantDurationDays: number | null
    campaign: string | null
    partner: string | null
    maxRedemptions: number | null
    maxRedemptionsPerUser: number
    startAt: Date | null
    endAt: Date | null
    createdByUserId: string
  }) {
    const discountPercent = input.discountType === 'FULL' ? 100 : input.discountPercent
    if (discountPercent < 1 || discountPercent > 100) throw { statusCode: 400, message: 'discountPercent must be between 1 and 100' }
    if (input.startAt && input.endAt && input.endAt <= input.startAt) throw { statusCode: 400, message: 'endAt must be after startAt' }

    try {
      const created = await db.couponCode.create({
        data: { ...input, code: normalizeCode(input.code), discountPercent },
      })
      return { ...created, _count: { redemptions: 0 } }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw { statusCode: 409, message: 'A coupon with this code already exists' }
      }
      throw err
    }
  }

  async updateCoupon(id: string, input: Partial<{ discountType: 'PERCENTAGE' | 'FULL'; discountPercent: number; grantDurationDays: number | null; campaign: string | null; partner: string | null; maxRedemptions: number | null; maxRedemptionsPerUser: number; startAt: Date | null; endAt: Date | null; isActive: boolean }>) {
    const existing = await db.couponCode.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Coupon not found' }
    const discountType = input.discountType ?? existing.discountType
    const discountPercent = discountType === 'FULL' ? 100 : (input.discountPercent ?? existing.discountPercent)
    const startAt = input.startAt !== undefined ? input.startAt : existing.startAt
    const endAt = input.endAt !== undefined ? input.endAt : existing.endAt
    if (startAt && endAt && endAt <= startAt) throw { statusCode: 400, message: 'endAt must be after startAt' }

    return db.couponCode.update({
      where: { id },
      data: {
        discountType,
        discountPercent,
        grantDurationDays: input.grantDurationDays !== undefined ? input.grantDurationDays : existing.grantDurationDays,
        campaign: input.campaign !== undefined ? input.campaign : existing.campaign,
        partner: input.partner !== undefined ? input.partner : existing.partner,
        maxRedemptions: input.maxRedemptions !== undefined ? input.maxRedemptions : existing.maxRedemptions,
        maxRedemptionsPerUser: input.maxRedemptionsPerUser ?? existing.maxRedemptionsPerUser,
        startAt,
        endAt,
        isActive: input.isActive ?? existing.isActive,
      },
      include: { _count: { select: { redemptions: true } } },
    })
  }

  async listRedemptions(couponCodeId: string) {
    const coupon = await db.couponCode.findUnique({ where: { id: couponCodeId } })
    if (!coupon) throw { statusCode: 404, message: 'Coupon not found' }
    return db.couponRedemption.findMany({
      where: { couponCodeId },
      orderBy: { redeemedAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, profile: { select: { username: true, displayName: true } } } },
        grant: true,
      },
    })
  }

  // Immutable redemption terms: everything about the discount is snapshotted
  // onto CouponRedemption at redeem time — a later edit to CouponCode never
  // rewrites what this specific redemption actually promised. A FULL (100%)
  // redemption grants MEMBER immediately; a PERCENTAGE redemption is only
  // recorded — applying it requires a verified real payment, which doesn't
  // exist in this codebase yet (dev-purchase is a simulation, not payment
  // verification), so no grant is created for it here.
  async redeemCoupon(userId: string, rawCode: string, now = new Date()) {
    const code = normalizeCode(rawCode)
    const coupon = await db.couponCode.findUnique({ where: { code } })
    if (!coupon || !coupon.isActive) throw { statusCode: 404, message: 'Coupon not found' }
    if (coupon.startAt && now < coupon.startAt) throw { statusCode: 400, message: 'This coupon is not active yet' }
    if (coupon.endAt && now >= coupon.endAt) throw { statusCode: 400, message: 'This coupon has expired' }

    const [totalRedemptions, userRedemptions] = await Promise.all([
      coupon.maxRedemptions != null ? db.couponRedemption.count({ where: { couponCodeId: coupon.id } }) : Promise.resolve(0),
      db.couponRedemption.count({ where: { couponCodeId: coupon.id, userId } }),
    ])
    if (coupon.maxRedemptions != null && totalRedemptions >= coupon.maxRedemptions) throw { statusCode: 409, message: 'This coupon has reached its redemption limit' }
    if (userRedemptions >= coupon.maxRedemptionsPerUser) throw { statusCode: 409, message: 'You have already redeemed this coupon' }

    return db.$transaction(async (tx) => {
      const redemption = await tx.couponRedemption.create({
        data: {
          couponCodeId: coupon.id,
          userId,
          codeSnapshot: coupon.code,
          discountType: coupon.discountType,
          discountPercent: coupon.discountPercent,
          grantDurationDaysSnapshot: coupon.grantDurationDays,
          campaignSnapshot: coupon.campaign,
          partnerSnapshot: coupon.partner,
          redeemedAt: now,
        },
      })

      if (coupon.discountType !== 'FULL') {
        return { redemption, grant: null }
      }

      const floor = await snapshotMemberFloor()
      const grant = await tx.membershipGrant.create({
        data: {
          userId,
          source: 'COUPON_REDEMPTION',
          reason: `Coupon: ${coupon.code}`,
          expiresAt: coupon.grantDurationDays ? addDays(now, coupon.grantDurationDays) : null,
          entitlementFloor: floor as any,
          couponRedemptionId: redemption.id,
        },
      })
      return { redemption, grant }
    })
  }

  // ── Reporting ────────────────────────────────────────────
  async getOverview(now = new Date()) {
    const [subs, grants, globalWindow, totalUserCount] = await Promise.all([
      db.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, currentPeriodEnd: { gt: now } }, select: { userId: true } }),
      db.membershipGrant.findMany({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { userId: true, source: true } }),
      db.globalMembershipWindow.findFirst({ where: { isActive: true, startAt: { lte: now }, endAt: { gt: now } } }),
      db.user.count(),
    ])
    const memberUserIds = new Set<string>([...subs.map((s) => s.userId), ...grants.map((g) => g.userId)])
    return {
      effectiveMemberCount: memberUserIds.size,
      totalUserCount,
      bySource: {
        subscriptions: subs.length,
        manualGrants: grants.filter((g) => g.source === 'MANUAL_ADMIN').length,
        signupPromotionGrants: grants.filter((g) => g.source === 'SIGNUP_PROMOTION').length,
        couponGrants: grants.filter((g) => g.source === 'COUPON_REDEMPTION').length,
        oneTimePurchaseGrants: grants.filter((g) => g.source === 'ONE_TIME_PURCHASE').length,
      },
      globalWindow: globalWindow ? { active: true, id: globalWindow.id, label: globalWindow.label, endsAt: globalWindow.endAt.toISOString() } : null,
    }
  }

  async listEffectiveMembers(opts: { cursor?: string; limit?: number }, now = new Date()) {
    const limit = normalizeLimit(opts.limit)
    const offset = opts.cursor ? Number(Buffer.from(opts.cursor, 'base64url').toString('utf8')) || 0 : 0

    const [subs, grants] = await Promise.all([
      db.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, currentPeriodEnd: { gt: now } }, select: { userId: true, provider: true, currentPeriodEnd: true } }),
      db.membershipGrant.findMany({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { userId: true, source: true, expiresAt: true } }),
    ])
    const byUser = new Map<string, { kind: string; expiresAt: string | null }[]>()
    for (const s of subs) {
      const list = byUser.get(s.userId) ?? []
      list.push({ kind: s.provider === 'MANUAL' ? 'MANUAL_SUBSCRIPTION' : 'SUBSCRIPTION', expiresAt: s.currentPeriodEnd.toISOString() })
      byUser.set(s.userId, list)
    }
    for (const g of grants) {
      const list = byUser.get(g.userId) ?? []
      list.push({ kind: g.source, expiresAt: g.expiresAt?.toISOString() ?? null })
      byUser.set(g.userId, list)
    }
    const userIds = [...byUser.keys()]
    const page = userIds.slice(offset, offset + limit)
    const users = await db.user.findMany({
      where: { id: { in: page } },
      select: { id: true, email: true, profile: { select: { username: true, displayName: true } } },
    })
    const usersById = new Map(users.map((u) => [u.id, u]))
    const members = page.map((id) => ({ user: usersById.get(id), sources: byUser.get(id)! })).filter((m) => m.user)
    const hasMore = offset + limit < userIds.length
    return { members, hasMore, nextCursor: hasMore ? Buffer.from(String(offset + limit)).toString('base64url') : null }
  }
}
