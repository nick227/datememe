import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import openapiGlue from 'fastify-openapi-glue'
import bcrypt from 'bcryptjs'
import { resolve } from 'path'
import { db } from '@project/db'
import * as handlers from '../handlers'
import * as security from '../plugins/security'

/**
 * Regression guard for a bug class that has hit this codebase four separate
 * times this session: a service computes a field correctly, but the
 * OpenAPI response schema never declares it, so `fast-json-stringify`
 * (which fastify-openapi-glue wires up from that schema) silently drops it
 * from the real HTTP response — no error, no 500, the field just vanishes.
 * Testing `serializeUser()` or a service method directly never catches this,
 * because the object it returns is correct; only the field is lost in the
 * schema-driven serialization step in between the handler and the wire.
 *
 * The concrete incident this guards against: `User.role` was missing from
 * the OpenAPI spec, so every `/auth/login` and `/auth/me` response silently
 * omitted it — which meant the admin app's own `user.role !== 'ADMIN'` login
 * gate failed for every real admin, in a way no unit test caught.
 *
 * This registers the *real* fastify-openapi-glue plugin against the *real*
 * spec file and the *real* handlers — the actual pipeline that dropped the
 * field — rather than a hand-built Fastify app with ad-hoc schemas.
 */
async function buildRealApiApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie)
  await app.register(openapiGlue, {
    specification: resolve(__dirname, '../../../../packages/api-spec/openapi.yaml'),
    service: handlers,
    securityHandlers: security,
    noAdditional: true,
  } as any)
  return app
}

describe('OpenAPI response contract — real serialization, not just service objects', () => {
  let adminUser: any
  let adminSession: any
  const plainPassword = 'contract-test-password-123'

  beforeAll(async () => {
    const now = Date.now()
    adminUser = await db.user.create({
      data: {
        email: `contract-admin-${now}@example.com`,
        passwordHash: await bcrypt.hash(plainPassword, 12),
        role: 'ADMIN',
        profile: { create: { username: `contract-admin-${now}`, displayName: 'Contract Admin', birthdate: new Date('1990-01-01T00:00:00.000Z') } },
      },
    })
    adminSession = await db.session.create({
      data: { userId: adminUser.id, token: `contract-token-${now}`, expiresAt: new Date(Date.now() + 60_000) },
    })
  })

  afterAll(async () => {
    // The moderation-review test below creates AdminAuditEvent rows against
    // this same adminUser — must go first, or deleting the user 409s on the
    // audit table's actorUserId foreign key.
    await db.adminAuditEvent.deleteMany({ where: { actorUserId: adminUser.id } })
    await db.session.deleteMany({ where: { userId: adminUser.id } })
    await db.profile.deleteMany({ where: { userId: adminUser.id } })
    await db.user.deleteMany({ where: { id: adminUser.id } })
  })

  it('role survives real serialization through POST /auth/login', async () => {
    const app = await buildRealApiApp()
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: adminUser.email, password: plainPassword },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // A field silently dropped by the response schema is `undefined` here,
    // not an error — assert presence explicitly, not just "no exception".
    expect(body.data).toHaveProperty('role')
    expect(body.data.role).toBe('ADMIN')
  })

  it('role survives real serialization through GET /auth/me', async () => {
    const app = await buildRealApiApp()
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveProperty('role')
    expect(body.data.role).toBe('ADMIN')
  })

  /**
   * GET /admin/queue moved from a hand-registered `server.get(..., {preHandler:
   * [security.adminAuth]})` route to spec-driven glue routing (apps/mobile
   * Admin migration, batch 1) — the handler function is unchanged, but the
   * *mechanism* enforcing the role check is new (openapi-glue's
   * `securityHandlers` calling `security.adminAuth` via the spec's
   * `security: [{adminAuth: []}]`, not a manual preHandler array). Real-app
   * coverage here, not just the hand-built app in admin-security.test.ts,
   * because that's the exact seam that changed.
   */
  it('GET /admin/queue enforces adminAuth through the real glue pipeline and serializes real data', async () => {
    const app = await buildRealApiApp()

    const unauthed = await app.inject({ method: 'GET', url: '/admin/queue' })
    expect(unauthed.statusCode).toBe(401)

    const nonAdminUser = await db.user.create({
      data: {
        email: `contract-nonadmin-${Date.now()}@example.com`,
        passwordHash: 'hash',
        role: 'USER',
        profile: { create: { username: `contract-nonadmin-${Date.now()}`, displayName: 'Non Admin', birthdate: new Date('1995-01-01T00:00:00.000Z') } },
      },
    })
    const nonAdminSession = await db.session.create({
      data: { userId: nonAdminUser.id, token: `contract-nonadmin-token-${Date.now()}`, expiresAt: new Date(Date.now() + 60_000) },
    })
    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/queue',
      headers: { authorization: `Bearer ${nonAdminSession.token}` },
    })
    expect(forbidden.statusCode).toBe(403)
    await db.session.deleteMany({ where: { userId: nonAdminUser.id } })
    await db.profile.deleteMany({ where: { userId: nonAdminUser.id } })
    await db.user.deleteMany({ where: { id: nonAdminUser.id } })

    const ok = await app.inject({
      method: 'GET',
      url: '/admin/queue',
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(ok.statusCode).toBe(200)
    const body = ok.json()
    expect(body).toHaveProperty('metrics')
    expect(body).toHaveProperty('oldestPending')
    expect(body).toHaveProperty('latestFailed')
  })

  /**
   * The /admin/moderation/* + /admin/taxonomy/entities routes moved to
   * spec-driven glue routing in the same migration batch (batch 2). Business
   * logic (approve/reject/merge transitions, audit events) is already
   * covered by adminModeration.test.ts's hand-built Fastify app; this test
   * exists purely to catch schema/serialization drift against the *real*
   * pipeline — which is exactly how the `entityType` field, present on every
   * real submission but missing from `AdminEntitySubmission`'s `required`
   * array, was caught: the hand-built test app has no response schema at
   * all, so it can't see fast-json-stringify silently dropping (or, for a
   * `required` field, throwing on) a field the service actually returns.
   */
  it('GET /admin/moderation/submissions and /reports serialize their includes through the real glue pipeline, and review actions return the real scalar shape', async () => {
    const app = await buildRealApiApp()
    const now = Date.now()

    const entityType = await db.entityType.create({ data: { slug: `contract-mod-type-${now}`, label: 'Contract Mod Type', pluralLabel: 'Contract Mod Types' } })
    const reporterUser = await db.user.create({
      data: {
        email: `contract-mod-reporter-${now}@example.com`,
        passwordHash: 'hash',
        profile: { create: { username: `contract-mod-reporter-${now}`, displayName: 'Contract Reporter', birthdate: new Date('1995-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    const submittedEntity = await db.entity.create({
      data: { entityTypeId: entityType.id, canonicalName: 'Contract Submission', slug: `contract-submission-${now}`, status: 'PENDING', sourceType: 'USER_SUBMITTED', submittedByProfileId: reporterUser.profile!.id },
    })
    const submission = await db.entitySubmission.create({
      data: { entityTypeId: entityType.id, rawText: 'Contract Submission', submittedByProfileId: reporterUser.profile!.id, submittedEntityId: submittedEntity.id, status: 'PENDING' },
    })
    const report = await db.report.create({
      data: { reporterProfileId: reporterUser.profile!.id, targetType: 'PROFILE', targetProfileId: reporterUser.profile!.id, reason: 'Contract test reason' },
    })

    const submissionsList = await app.inject({
      method: 'GET',
      url: '/admin/moderation/submissions',
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(submissionsList.statusCode).toBe(200)
    const foundSubmission = submissionsList.json().submissions.find((s: any) => s.id === submission.id)
    expect(foundSubmission).toBeTruthy()
    // The actual regression: entityType is always present on a real row, but
    // was missing from the response schema's `required` array, which throws
    // "entityType is required!" during serialization — a 500 the hand-built
    // test app's schema-less inject() could never surface.
    expect(foundSubmission.entityType).toMatchObject({ id: entityType.id, label: 'Contract Mod Type' })
    expect(foundSubmission.submittedEntity).toMatchObject({ id: submittedEntity.id })

    const submissionReview = await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { action: 'APPROVE' },
    })
    expect(submissionReview.statusCode).toBe(200)
    expect(submissionReview.json().submission).toMatchObject({ id: submission.id, status: 'APPROVED' })

    const reportsList = await app.inject({
      method: 'GET',
      url: '/admin/moderation/reports',
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(reportsList.statusCode).toBe(200)
    const foundReport = reportsList.json().reports.find((r: any) => r.id === report.id)
    expect(foundReport).toBeTruthy()
    expect(foundReport.reporter).toMatchObject({ id: reporterUser.profile!.id })

    const reportReview = await app.inject({
      method: 'POST',
      url: `/admin/moderation/reports/${report.id}/review`,
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { status: 'REVIEWED' },
    })
    expect(reportReview.statusCode).toBe(200)
    expect(reportReview.json().report).toMatchObject({ id: report.id, status: 'REVIEWED' })

    const entitiesLookup = await app.inject({
      method: 'GET',
      url: `/admin/taxonomy/entities?entityTypeId=${entityType.id}`,
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(entitiesLookup.statusCode).toBe(200)
    expect(entitiesLookup.json().entities.some((e: any) => e.id === submittedEntity.id)).toBe(true)

    await db.entitySubmission.deleteMany({ where: { entityTypeId: entityType.id } })
    await db.report.deleteMany({ where: { id: report.id } })
    await db.entity.deleteMany({ where: { entityTypeId: entityType.id } })
    await db.entityType.delete({ where: { id: entityType.id } })
    await db.session.deleteMany({ where: { userId: reporterUser.id } })
    await db.profile.deleteMany({ where: { userId: reporterUser.id } })
    await db.user.deleteMany({ where: { id: reporterUser.id } })
  })

  /**
   * /admin/users*, /admin/plans moved to spec-driven glue routing in the
   * same migration batch (batch 3). Business logic (audit events, price-
   * change guard, etc.) is already covered by admin-users.test.ts's
   * hand-built app. This test exists for the same reason as the two above:
   * catch schema/serialization drift the hand-built tests structurally
   * cannot see. The concrete thing it guards against: GET /admin/users/:id
   * previously had NO response schema at all (the manually-registered route
   * declared no `response` schema), so it sent the *entire* raw Prisma User
   * row — including the bcrypt `passwordHash` — to the admin browser on
   * every user-detail view. AdminUserDetail's schema is the actual fix; this
   * assertion is what proves it.
   */
  it('GET /admin/users/:id never leaks passwordHash, and admin user-management routes serialize correctly through the real glue pipeline', async () => {
    const app = await buildRealApiApp()
    const now = Date.now()

    const targetUser = await db.user.create({
      data: {
        email: `contract-target-${now}@example.com`,
        passwordHash: 'super-secret-bcrypt-hash-should-never-leave-the-server',
        role: 'USER',
        profile: { create: { username: `contract-target-${now}`, displayName: 'Contract Target', birthdate: new Date('1995-01-01T00:00:00.000Z') } },
      },
    })
    const plan = await db.plan.create({
      data: { slug: `contract-plan-${now}`, label: 'Contract Plan', interval: 'MONTHLY', priceCents: 500 },
    })

    const usersList = await app.inject({
      method: 'GET',
      url: `/admin/users?search=contract-target-${now}`,
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(usersList.statusCode).toBe(200)
    expect(usersList.json().users.some((u: any) => u.id === targetUser.id)).toBe(true)

    const plansList = await app.inject({
      method: 'GET',
      url: '/admin/plans',
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(plansList.statusCode).toBe(200)
    expect(plansList.json().plans.some((p: any) => p.id === plan.id)).toBe(true)

    // A real Subscription row, created directly — the endpoint that used to
    // create one via "override membership" is gone; grants (tested below)
    // never touch Subscription at all.
    const subscription = await db.subscription.create({
      data: {
        userId: targetUser.id,
        planId: plan.id,
        provider: 'STRIPE',
        providerSubscriptionId: `contract_${now}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    const grantRes = await app.inject({
      method: 'POST',
      url: '/admin/membership/grants',
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { userId: targetUser.id, reason: 'contract test grant' },
    })
    expect(grantRes.statusCode).toBe(201)
    expect(grantRes.json().grant).toMatchObject({ userId: targetUser.id, source: 'MANUAL_ADMIN', reason: 'contract test grant', revokedAt: null })
    const grantId = grantRes.json().grant.id

    const detail = await app.inject({
      method: 'GET',
      url: `/admin/users/${targetUser.id}`,
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(detail.statusCode).toBe(200)
    const detailBody = detail.json()
    expect(detailBody.user.id).toBe(targetUser.id)
    expect(detailBody.user).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(detailBody)).not.toContain('super-secret-bcrypt-hash-should-never-leave-the-server')
    expect(detailBody.user.subscriptions[0]).toMatchObject({ planId: plan.id, plan: { id: plan.id, label: 'Contract Plan' } })
    expect(detailBody.user.membershipGrants[0]).toMatchObject({ id: grantId, userId: targetUser.id, source: 'MANUAL_ADMIN', revokedAt: null })

    const verify = await app.inject({
      method: 'POST',
      url: '/admin/users/verify',
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { userId: targetUser.id, verify: true },
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().user).toMatchObject({ id: targetUser.id, isVerified: true })
    expect(verify.json().user).not.toHaveProperty('passwordHash')

    const ban = await app.inject({
      method: 'POST',
      url: '/admin/users/ban',
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { userId: targetUser.id, ban: true },
    })
    expect(ban.statusCode).toBe(200)
    expect(ban.json().user.suspendedAt).toBeTruthy()

    const revoke = await app.inject({
      method: 'POST',
      url: `/admin/membership/grants/${grantId}/revoke`,
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { reason: 'contract test revoke' },
    })
    expect(revoke.statusCode).toBe(200)
    expect(revoke.json().grant).toMatchObject({ id: grantId, revokeReason: 'contract test revoke' })
    expect(revoke.json().grant.revokedAt).toBeTruthy()

    await db.adminAuditEvent.deleteMany({ where: { targetId: targetUser.id } })
    await db.membershipGrant.deleteMany({ where: { userId: targetUser.id } })
    await db.subscription.deleteMany({ where: { userId: targetUser.id } })
    await db.profile.deleteMany({ where: { userId: targetUser.id } })
    await db.user.deleteMany({ where: { id: targetUser.id } })
    await db.plan.delete({ where: { id: plan.id } })
  })

  /**
   * Batch 4 (Memberships). Regression guard for a genuinely subtle bug this
   * batch's own live testing caught: a bare `{ type: object }` response
   * schema property with no `properties` or `additionalProperties` keyword
   * serializes as `{}` via fast-json-stringify *regardless of the real
   * value* — no error, no warning, just silent data loss. This hit every
   * AdminAuditEvent's before/after/metadata (the entire audit trail). The
   * fix was adding `additionalProperties: true`; this test is what would
   * catch a future regression of that fix.
   */
  it('AdminAuditEvent before/after/metadata round-trip real object content, not {}', async () => {
    const app = await buildRealApiApp()
    const now = Date.now()

    const targetUser = await db.user.create({
      data: {
        email: `contract-audit-${now}@example.com`,
        passwordHash: 'x',
        profile: { create: { username: `contract-audit-${now}`, displayName: 'Audit Target', birthdate: new Date('1995-01-01T00:00:00.000Z') } },
      },
    })
    const verify = await app.inject({
      method: 'POST',
      url: '/admin/users/verify',
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { userId: targetUser.id, verify: true },
    })
    expect(verify.statusCode).toBe(200)

    const detail = await app.inject({
      method: 'GET',
      url: `/admin/users/${targetUser.id}`,
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(detail.statusCode).toBe(200)
    const auditEvent = detail.json().auditEvents.find((e: any) => e.action === 'verify_user')
    expect(auditEvent.beforeValue).toEqual({ isVerified: false })
    expect(auditEvent.afterValue).toEqual({ isVerified: true })
    expect(auditEvent.metadata).toEqual({ action: 'verify' })

    await db.adminAuditEvent.deleteMany({ where: { targetId: targetUser.id } })
    await db.profile.deleteMany({ where: { userId: targetUser.id } })
    await db.user.deleteMany({ where: { id: targetUser.id } })
  })

  /**
   * Membership pricing fix: Subscription.pricePaidCents is the grandfathering
   * snapshot that lets admins reprice a Plan freely even with active
   * subscribers (see admin.ts updatePlan). Confirms it both round-trips
   * through the real response schema (AdminSubscriptionWithPlan) and — the
   * actual point of the field — never changes after the plan it references
   * is repriced.
   */
  it('Subscription.pricePaidCents round-trips and survives repricing its Plan', async () => {
    const app = await buildRealApiApp()
    const now = Date.now()

    const plan = await db.plan.create({
      data: { label: 'Repricing Plan', slug: `repricing-plan-${now}`, interval: 'MONTHLY', priceCents: 500 },
    })
    const targetUser = await db.user.create({
      data: {
        email: `contract-pricing-${now}@example.com`,
        passwordHash: 'x',
        profile: { create: { username: `contract-pricing-${now}`, displayName: 'Pricing Target', birthdate: new Date('1995-01-01T00:00:00.000Z') } },
      },
    })
    await db.subscription.create({
      data: {
        userId: targetUser.id,
        planId: plan.id,
        provider: 'STRIPE',
        providerSubscriptionId: `contract_${now}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        pricePaidCents: 500,
      },
    })

    const reprice = await app.inject({
      method: 'POST',
      url: '/admin/plans/update',
      headers: { authorization: `Bearer ${adminSession.token}` },
      payload: { planId: plan.id, priceCents: 900 },
    })
    expect(reprice.statusCode).toBe(200)
    expect(reprice.json().plan.priceCents).toBe(900)

    const detail = await app.inject({
      method: 'GET',
      url: `/admin/users/${targetUser.id}`,
      headers: { authorization: `Bearer ${adminSession.token}` },
    })
    expect(detail.statusCode).toBe(200)
    const sub = detail.json().user.subscriptions[0]
    expect(sub).toHaveProperty('pricePaidCents')
    expect(sub.pricePaidCents).toBe(500)
    expect(sub.plan.priceCents).toBe(900)

    await db.subscription.deleteMany({ where: { userId: targetUser.id } })
    await db.adminAuditEvent.deleteMany({ where: { targetId: plan.id } })
    await db.profile.deleteMany({ where: { userId: targetUser.id } })
    await db.user.deleteMany({ where: { id: targetUser.id } })
    await db.plan.delete({ where: { id: plan.id } })
  })
})
