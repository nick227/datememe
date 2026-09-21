import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { db } from '@project/db'
import * as handlers from '../handlers'
import * as security from '../plugins/security'
import cookie from '@fastify/cookie'

async function buildAdminApp() {
  const app = Fastify({ logger: false })
  await app.register(cookie)

  app.get('/admin/users', { preHandler: [security.adminAuth] }, handlers.getUsers)
  app.get('/admin/users/:id', { preHandler: [security.adminAuth] }, handlers.getUser)
  app.post('/admin/users/ban', { preHandler: [security.adminAuth] }, handlers.banUser)
  app.post('/admin/users/verify', { preHandler: [security.adminAuth] }, handlers.verifyUser)
  app.post('/admin/users/membership', { preHandler: [security.adminAuth] }, handlers.overrideUserMembership)
  app.post('/admin/users/membership/revoke', { preHandler: [security.adminAuth] }, handlers.revokeUserMembership)
  app.post('/admin/plans', { preHandler: [security.adminAuth] }, handlers.createPlan)
  app.post('/admin/plans/update', { preHandler: [security.adminAuth] }, handlers.updatePlan)

  return app
}

describe('admin user management', () => {
  let adminUser: any
  let adminToken: string
  let targetUser: any
  let createdUserIds: string[] = []
  let planId: string
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    app = await buildAdminApp()
    const now = Date.now()

    adminUser = await db.user.create({
      data: {
        email: `admin-usermgmt-${now}@example.com`,
        passwordHash: 'hash',
        role: 'ADMIN',
        profile: {
          create: {
            username: `admin-usermgmt-${now}`,
            displayName: 'Admin User',
            birthdate: new Date('1990-01-01T00:00:00.000Z'),
          },
        },
      },
      include: { profile: true },
    })
    createdUserIds.push(adminUser.id)

    const adminSession = await db.session.create({
      data: { userId: adminUser.id, expiresAt: new Date(Date.now() + 1000000), token: `admin-token-${now}` },
    })
    adminToken = adminSession.token

    targetUser = await db.user.create({
      data: {
        email: `target-${now}@example.com`,
        passwordHash: 'hash',
        role: 'USER',
        profile: {
          create: {
            username: `target-${now}`,
            displayName: 'Target User',
            birthdate: new Date('1990-01-01T00:00:00.000Z'),
          },
        },
      },
      include: { profile: true },
    })
    createdUserIds.push(targetUser.id)

    const testPlan = await db.plan.create({
      data: {
        slug: `test-plan-${now}`,
        label: 'Test Plan',
        interval: 'MONTHLY',
        priceCents: 999,
      }
    })
    planId = testPlan.id
  })

  afterAll(async () => {
    await db.adminAuditEvent.deleteMany({
      where: { actorUserId: adminUser.id }
    })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.subscription.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
    if (planId) {
      await db.plan.delete({ where: { id: planId } })
    }
  })

  it('can search for users by email and username', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/admin/users?search=${targetUser.email.split('@')[0]}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.users).toBeInstanceOf(Array)
    expect(json.users.length).toBeGreaterThan(0)
    expect(json.users.some((u: any) => u.id === targetUser.id)).toBe(true)
  })

  it('can fetch specific user detail and audits', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/admin/users/${targetUser.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.user).toBeTruthy()
    expect(json.user.id).toBe(targetUser.id)
    expect(json.auditEvents).toBeInstanceOf(Array)
  })

  it('records an audit event when verifying a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/verify',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: targetUser.id, verify: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.isVerified).toBe(true)

    const audits = await db.adminAuditEvent.findMany({
      where: { targetId: targetUser.id, action: 'verify_user' },
      orderBy: { createdAt: 'desc' }
    })
    expect(audits.length).toBeGreaterThan(0)
    expect(audits[0]?.afterValue).toMatchObject({ isVerified: true })
  })

  it('records an audit event when suspending a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/ban',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: targetUser.id, ban: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.suspendedAt).toBeTruthy()

    const audits = await db.adminAuditEvent.findMany({
      where: { targetId: targetUser.id, action: 'ban_user' },
      orderBy: { createdAt: 'desc' }
    })
    expect(audits.length).toBeGreaterThan(0)
    expect(audits[0]?.metadata).toMatchObject({ action: 'ban' })
  })

  it('can override user membership', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/membership',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: targetUser.id, planId },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.subscription.planId).toBe(planId)
    expect(json.subscription.status).toBe('ACTIVE')

    const audits = await db.adminAuditEvent.findMany({
      where: { targetId: targetUser.id, action: 'override_membership' },
      orderBy: { createdAt: 'desc' }
    })
    expect(audits.length).toBeGreaterThan(0)
    expect(audits[0]?.afterValue).toMatchObject({ planId, status: 'ACTIVE' })
  })

  it('can revoke user membership', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/membership/revoke',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: targetUser.id },
    })
    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.subscription.status).toBe('CANCELED')

    const audits = await db.adminAuditEvent.findMany({
      where: { targetId: targetUser.id, action: 'revoke_membership' },
      orderBy: { createdAt: 'desc' }
    })
    expect(audits.length).toBeGreaterThan(0)
    expect(audits[0]?.afterValue).toMatchObject({ status: 'CANCELED' })
  })

  it('can create a new plan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/plans',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { label: 'New Plan', slug: `new-plan-${Date.now()}`, interval: 'MONTHLY', priceCents: 1500, features: { bonus: true } },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().plan.label).toBe('New Plan')
    expect(res.json().plan.priceCents).toBe(1500)
  })

  it('rejects price mutation on an active plan', async () => {
    // targetUser is currently subscribed to planId because we just tested overriding membership but wait, we revoked it!
    // Let's re-override membership to make planId have an active subscriber
    await app.inject({
      method: 'POST',
      url: '/admin/users/membership',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: targetUser.id, planId },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/admin/plans/update',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { planId, priceCents: 1000 }, // changing from 999 to 1000
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.stringify(res.json())).toMatch(/Cannot change price of a plan with active subscriptions/)
  })
})
