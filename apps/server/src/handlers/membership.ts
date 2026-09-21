import type { AuthenticatedRequest } from '../lib/userContext'
import { MembershipService } from '../services/MembershipService'
import { recordAdminAudit } from './admin'

const membershipService = new MembershipService()

function coerceStringId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw { statusCode: 400, message: `${label} is required` }
  }
  return value.trim()
}

function coerceDate(value: unknown, label: string): Date {
  if (typeof value !== 'string') throw { statusCode: 400, message: `${label} is required` }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw { statusCode: 400, message: `${label} is not a valid date` }
  return date
}

function coerceOptionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === '') return null
  return coerceDate(value, label)
}

// ── Entitlement policy ──────────────────────────────────────
export async function getEntitlementPolicy(_request: AuthenticatedRequest, reply: any) {
  return reply.send(await membershipService.getEntitlementPolicy())
}

export async function updateEntitlementPolicy(request: AuthenticatedRequest, reply: any) {
  const { state, key, value } = request.body ?? {}
  if (state !== 'FREE' && state !== 'MEMBER') throw { statusCode: 400, message: 'state must be FREE or MEMBER' }
  const before = await membershipService.getEntitlementPolicy()
  const after = await membershipService.updateEntitlementPolicy(state, key, value, request.user.id)
  await recordAdminAudit(request.user.id, request.user.role, 'update_entitlement_policy', 'entitlement_policy', `${state}:${key}`, { [key]: before[state as 'FREE' | 'MEMBER'][key as keyof typeof before.FREE] }, { [key]: value })
  return reply.send(after)
}

// ── Grants ────────────────────────────────────────────────
export async function listMembershipGrants(request: AuthenticatedRequest, reply: any) {
  const { userId, cursor, limit } = request.query ?? {}
  const result = await membershipService.listGrants({ userId, cursor, limit: limit ? Number(limit) : undefined })
  return reply.send(result)
}

export async function createMembershipGrant(request: AuthenticatedRequest, reply: any) {
  const userId = coerceStringId(request.body?.userId, 'userId')
  const expiresAt = coerceOptionalDate(request.body?.expiresAt, 'expiresAt')
  const reason = typeof request.body?.reason === 'string' && request.body.reason.trim() ? request.body.reason.trim() : null

  const grant = await membershipService.createGrant({ userId, expiresAt, reason, grantedByUserId: request.user.id })
  await recordAdminAudit(request.user.id, request.user.role, 'create_membership_grant', 'user', userId, null, { grantId: grant.id, expiresAt: grant.expiresAt, reason: grant.reason })
  return reply.status(201).send({ grant })
}

export async function revokeMembershipGrant(request: AuthenticatedRequest, reply: any) {
  const id = coerceStringId(request.params?.id, 'id')
  const revokeReason = typeof request.body?.reason === 'string' && request.body.reason.trim() ? request.body.reason.trim() : null

  const grant = await membershipService.revokeGrant(id, request.user.id, revokeReason)
  await recordAdminAudit(request.user.id, request.user.role, 'revoke_membership_grant', 'user', grant.userId, { grantId: id }, { revokedAt: grant.revokedAt, revokeReason })
  return reply.send({ grant })
}

// ── Signup promotions ────────────────────────────────────
export async function listSignupPromotions(_request: AuthenticatedRequest, reply: any) {
  return reply.send({ signupPromotions: await membershipService.listSignupPromotions() })
}

export async function createSignupPromotion(request: AuthenticatedRequest, reply: any) {
  const body = request.body ?? {}
  const promotion = await membershipService.createSignupPromotion({
    label: coerceStringId(body.label, 'label'),
    startAt: coerceDate(body.startAt, 'startAt'),
    endAt: coerceDate(body.endAt, 'endAt'),
    awardType: body.awardType === 'TEMPORARY_MEMBER' ? 'TEMPORARY_MEMBER' : 'LIFETIME_MEMBER',
    durationDays: typeof body.durationDays === 'number' ? body.durationDays : null,
    createdByUserId: request.user.id,
  })
  await recordAdminAudit(request.user.id, request.user.role, 'create_signup_promotion', 'signup_promotion', promotion.id, null, { label: promotion.label, awardType: promotion.awardType })
  return reply.status(201).send({ signupPromotion: promotion })
}

export async function updateSignupPromotion(request: AuthenticatedRequest, reply: any) {
  const id = coerceStringId(request.params?.id, 'id')
  const body = request.body ?? {}
  const promotion = await membershipService.updateSignupPromotion(id, {
    label: body.label,
    startAt: body.startAt ? coerceDate(body.startAt, 'startAt') : undefined,
    endAt: body.endAt ? coerceDate(body.endAt, 'endAt') : undefined,
    awardType: body.awardType,
    durationDays: typeof body.durationDays === 'number' ? body.durationDays : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  })
  await recordAdminAudit(request.user.id, request.user.role, 'update_signup_promotion', 'signup_promotion', id, null, { isActive: promotion.isActive })
  return reply.send({ signupPromotion: promotion })
}

// ── Global membership windows ────────────────────────────
export async function listGlobalMembershipWindows(_request: AuthenticatedRequest, reply: any) {
  return reply.send({ globalWindows: await membershipService.listGlobalWindows() })
}

export async function createGlobalMembershipWindow(request: AuthenticatedRequest, reply: any) {
  const body = request.body ?? {}
  const window = await membershipService.createGlobalWindow({
    label: coerceStringId(body.label, 'label'),
    startAt: coerceDate(body.startAt, 'startAt'),
    endAt: coerceDate(body.endAt, 'endAt'),
    createdByUserId: request.user.id,
  })
  await recordAdminAudit(request.user.id, request.user.role, 'create_global_membership_window', 'global_membership_window', window.id, null, { label: window.label })
  return reply.status(201).send({ globalWindow: window })
}

export async function updateGlobalMembershipWindow(request: AuthenticatedRequest, reply: any) {
  const id = coerceStringId(request.params?.id, 'id')
  const body = request.body ?? {}
  const window = await membershipService.updateGlobalWindow(id, {
    label: body.label,
    startAt: body.startAt ? coerceDate(body.startAt, 'startAt') : undefined,
    endAt: body.endAt ? coerceDate(body.endAt, 'endAt') : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  })
  await recordAdminAudit(request.user.id, request.user.role, 'update_global_membership_window', 'global_membership_window', id, null, { isActive: window.isActive })
  return reply.send({ globalWindow: window })
}

// ── Coupons ───────────────────────────────────────────────
export async function listCouponCodes(_request: AuthenticatedRequest, reply: any) {
  return reply.send({ coupons: await membershipService.listCoupons() })
}

export async function createCouponCode(request: AuthenticatedRequest, reply: any) {
  const body = request.body ?? {}
  const coupon = await membershipService.createCoupon({
    code: coerceStringId(body.code, 'code'),
    discountType: body.discountType === 'FULL' ? 'FULL' : 'PERCENTAGE',
    discountPercent: typeof body.discountPercent === 'number' ? body.discountPercent : 100,
    grantDurationDays: typeof body.grantDurationDays === 'number' ? body.grantDurationDays : null,
    campaign: typeof body.campaign === 'string' ? body.campaign : null,
    partner: typeof body.partner === 'string' ? body.partner : null,
    maxRedemptions: typeof body.maxRedemptions === 'number' ? body.maxRedemptions : null,
    maxRedemptionsPerUser: typeof body.maxRedemptionsPerUser === 'number' ? body.maxRedemptionsPerUser : 1,
    startAt: coerceOptionalDate(body.startAt, 'startAt'),
    endAt: coerceOptionalDate(body.endAt, 'endAt'),
    createdByUserId: request.user.id,
  })
  await recordAdminAudit(request.user.id, request.user.role, 'create_coupon_code', 'coupon_code', coupon.id, null, { code: coupon.code, discountType: coupon.discountType, discountPercent: coupon.discountPercent })
  return reply.status(201).send({ coupon })
}

export async function updateCouponCode(request: AuthenticatedRequest, reply: any) {
  const id = coerceStringId(request.params?.id, 'id')
  const body = request.body ?? {}
  const coupon = await membershipService.updateCoupon(id, {
    discountType: body.discountType,
    discountPercent: typeof body.discountPercent === 'number' ? body.discountPercent : undefined,
    grantDurationDays: body.grantDurationDays !== undefined ? body.grantDurationDays : undefined,
    campaign: body.campaign !== undefined ? body.campaign : undefined,
    partner: body.partner !== undefined ? body.partner : undefined,
    maxRedemptions: body.maxRedemptions !== undefined ? body.maxRedemptions : undefined,
    maxRedemptionsPerUser: typeof body.maxRedemptionsPerUser === 'number' ? body.maxRedemptionsPerUser : undefined,
    startAt: body.startAt !== undefined ? coerceOptionalDate(body.startAt, 'startAt') : undefined,
    endAt: body.endAt !== undefined ? coerceOptionalDate(body.endAt, 'endAt') : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
  })
  await recordAdminAudit(request.user.id, request.user.role, 'update_coupon_code', 'coupon_code', id, null, { isActive: coupon.isActive })
  return reply.send({ coupon })
}

export async function listCouponRedemptions(request: AuthenticatedRequest, reply: any) {
  const id = coerceStringId(request.params?.id, 'id')
  return reply.send({ redemptions: await membershipService.listRedemptions(id) })
}

export async function redeemCoupon(request: AuthenticatedRequest, reply: any) {
  const code = coerceStringId(request.body?.code, 'code')
  const result = await membershipService.redeemCoupon(request.user.id, code)
  return reply.status(201).send(result)
}

// ── Reporting ────────────────────────────────────────────
export async function getMembershipOverview(_request: AuthenticatedRequest, reply: any) {
  return reply.send(await membershipService.getOverview())
}

export async function listEffectiveMembers(request: AuthenticatedRequest, reply: any) {
  const { cursor, limit } = request.query ?? {}
  const result = await membershipService.listEffectiveMembers({ cursor, limit: limit ? Number(limit) : undefined })
  return reply.send(result)
}
