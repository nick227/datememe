import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { db } from '@project/db'
import * as handlers from '../handlers'
import * as security from '../plugins/security'

async function buildAdminApp() {
  const app = Fastify({ logger: false })

  app.get('/admin/users', { preHandler: [security.adminAuth] }, handlers.getUsers)
  app.post('/admin/users/ban', { preHandler: [security.adminAuth] }, handlers.banUser)
  app.post('/admin/users/verify', { preHandler: [security.adminAuth] }, handlers.verifyUser)
  app.get('/admin/plans', { preHandler: [security.adminAuth] }, handlers.getPlans)
  app.post('/admin/plans/update', { preHandler: [security.adminAuth] }, handlers.updatePlan)
  app.get('/admin/taxonomy/types', { preHandler: [security.adminAuth] }, handlers.getEntityTypes)
  app.post('/admin/taxonomy/entities/generate', { preHandler: [security.adminAuth] }, handlers.generateEntities)
  app.post('/admin/taxonomy/entities/bulk', { preHandler: [security.adminAuth] }, handlers.bulkSaveEntities)

  return app
}

describe('admin security and validation', () => {
  let adminUser: any
  let adminToken: string
  let regularUser: any
  let regularToken: string

  beforeAll(async () => {
    const now = Date.now()

    adminUser = await db.user.create({
      data: {
        email: `admin-${now}@example.com`,
        passwordHash: 'hash',
        role: 'ADMIN',
        profile: {
          create: {
            username: `admin-${now}`,
            displayName: 'Admin User',
            birthdate: new Date('1990-01-01T00:00:00.000Z'),
          },
        },
      },
      include: { profile: true },
    })

    regularUser = await db.user.create({
      data: {
        email: `user-${now}@example.com`,
        passwordHash: 'hash',
        role: 'USER',
        profile: {
          create: {
            username: `user-${now}`,
            displayName: 'Regular User',
            birthdate: new Date('1995-01-01T00:00:00.000Z'),
          },
        },
      },
      include: { profile: true },
    })

    const adminSession = await db.session.create({
      data: {
        userId: adminUser.id,
        token: `admin-test-token-${now}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const regularSession = await db.session.create({
      data: {
        userId: regularUser.id,
        token: `user-test-token-${now}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })

    adminToken = adminSession.token
    regularToken = regularSession.token
  })

  afterAll(async () => {
    await db.adminAuditEvent.deleteMany({ where: { actorUserId: { in: [adminUser.id, regularUser.id] } } })
    await db.session.deleteMany({ where: { userId: { in: [adminUser.id, regularUser.id] } } })
    await db.profile.deleteMany({ where: { userId: { in: [adminUser.id, regularUser.id] } } })
    await db.user.deleteMany({ where: { id: { in: [adminUser.id, regularUser.id] } } })
  })

  it('rejects the removed magic token bypass', async () => {
    const app = await buildAdminApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: 'Bearer ADMIN_TOKEN_HERE' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('rejects unauthenticated users', async () => {
    const app = await buildAdminApp()
    const res = await app.inject({ method: 'GET', url: '/admin/users' })

    expect(res.statusCode).toBe(401)
  })

  it('rejects authenticated non-admin callers', async () => {
    const app = await buildAdminApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users',
      headers: { authorization: `Bearer ${regularToken}` },
    })

    expect(res.statusCode).toBe(403)
  })

  it('allows authenticated admins to read users', async () => {
    const app = await buildAdminApp()
    const res = await app.inject({
      method: 'GET',
      url: '/admin/users?limit=10',
      headers: { authorization: `Bearer ${adminToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().users).toBeDefined()
  })

  it('rejects malformed admin mutations with 4xx', async () => {
    const app = await buildAdminApp()

    const verifyBad = await app.inject({
      method: 'POST',
      url: '/admin/users/verify',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: '', verify: 'yes' },
    })
    expect(verifyBad.statusCode).toBeGreaterThanOrEqual(400)
    expect(verifyBad.statusCode).toBeLessThan(500)

    const planBad = await app.inject({
      method: 'POST',
      url: '/admin/plans/update',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { planId: 'bad', priceCents: -1 },
    })
    expect(planBad.statusCode).toBeGreaterThanOrEqual(400)
    expect(planBad.statusCode).toBeLessThan(500)

    const bulkBad = await app.inject({
      method: 'POST',
      url: '/admin/taxonomy/entities/bulk',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { entityTypeId: 'missing-type', entities: ['   ', '  '] },
    })
    expect(bulkBad.statusCode).toBeGreaterThanOrEqual(400)
    expect(bulkBad.statusCode).toBeLessThan(500)
  })

  it('records admin audit events for privileged actions', async () => {
    const app = await buildAdminApp()

    const before = await db.user.count({ where: { id: regularUser.id, isVerified: false } })
    const res = await app.inject({
      method: 'POST',
      url: '/admin/users/verify',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { userId: regularUser.id, verify: true },
    })

    expect(res.statusCode).toBe(200)
    expect(before).toBe(1)
    const audit = await db.adminAuditEvent.findFirst({ where: { action: 'verify_user', targetId: regularUser.id }, orderBy: { createdAt: 'desc' } })
    expect(audit).toBeTruthy()
    expect(audit?.actorUserId).toBe(adminUser.id)
  })
})
