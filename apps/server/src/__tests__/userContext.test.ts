import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import openapiGlue from 'fastify-openapi-glue'
import { resolve } from 'path'
import bcrypt from 'bcryptjs'
import { db } from '@project/db'
import * as handlers from '../handlers'
import * as security from '../plugins/security'
import { ENTITLEMENT_DEFAULTS, enforceLimit } from '../lib/entitlements'

// Real sessions, database, OpenAPI response serializers and native admin hook.
describe('user foundation — login to bootstrap to protected operations', () => {
  const app = Fastify()
  const ids: string[] = []
  let user: any, other: any, noProfile: any, plan: any, conversation: any
  let token: string, cookieHeader: string
  const password = 'foundation-password-123'
  const stamp = Date.now()
  beforeAll(async () => {
    await app.register(cookie)
    await app.register(openapiGlue, {
      specification: resolve(__dirname, '../../../../packages/api-spec/openapi.yaml'),
      serviceHandlers: handlers, securityHandlers: security, noAdditional: true,
    } as any)
    app.get('/foundation/admin', { preHandler: security.adminAuth }, async () => ({ ok: true }))
    app.get('/foundation/principal', { preHandler: security.bearerAuth }, async request => request.user)
    for (const label of ['viewer', 'other', 'missing']) {
      const created = await db.user.create({ data: {
        email: `foundation-${label}-${stamp}@example.com`, passwordHash: await bcrypt.hash(password, 4),
        ...(label === 'missing' ? {} : { profile: { create: {
          username: `foundation-${label}-${stamp}`, displayName: label, birthdate: new Date('1990-01-01'),
          avatarUrl: 'https://example.com/protected-avatar.jpg',
          photos: { create: { url: 'https://example.com/protected-photo.jpg', sortOrder: 0 } },
        } } }),
      }, include: { profile: true } })
      ids.push(created.id)
      if (label === 'viewer') user = created
      else if (label === 'other') other = created
      else noProfile = created
    }
    plan = await db.plan.create({ data: { slug: `foundation-${stamp}`, label: 'Archived', interval: 'MONTHLY', priceCents: 100, isActive: false } })
    conversation = await db.conversation.create({ data: {
      initiatedById: user.profile.id,
      participants: { create: [{ profileId: user.profile.id }, { profileId: other.profile.id }] },
      messages: { create: { senderId: other.profile.id, body: 'protected incoming text', attachments: [{ type: 'image', url: 'https://example.com/secret.jpg' }] } },
    } })
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: user.email, password } })
    expect(login.statusCode).toBe(200)
    token = login.json().token
    cookieHeader = login.cookies.map(c => `${c.name}=${c.value}`).join('; ')
  })
  afterAll(async () => {
    await app.close()
    if (conversation) await db.conversation.deleteMany({ where: { id: conversation.id } })
    await db.subscription.deleteMany({ where: { userId: { in: ids } } })
    if (plan) await db.plan.delete({ where: { id: plan.id } })
    await db.session.deleteMany({ where: { userId: { in: ids } } })
    await db.profile.deleteMany({ where: { userId: { in: ids } } })
    await db.user.deleteMany({ where: { id: { in: ids } } })
  })
  const get = (url: string) => app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } })

  it('bootstraps identical cookie/Bearer identity, role, account, membership and entitlements without secrets', async () => {
    const bearer = await get('/auth/me')
    const browser = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie: cookieHeader } })
    expect(bearer.statusCode).toBe(200)
    expect(browser.json()).toEqual(bearer.json())
    expect(bearer.json().data).toMatchObject({ id: user.id, role: 'USER', isVerified: false,
      profile: { id: user.profile.id }, account: { suspended: false, deleted: false },
      membership: { state: 'FREE', sources: [] }, entitlements: ENTITLEMENT_DEFAULTS.FREE })
    expect(bearer.body).not.toContain('passwordHash')
    const principal = (await get('/foundation/principal')).json()
    expect(principal.profileId).toBe(user.profile.id)
    expect(principal).not.toHaveProperty('profile')
    expect(principal).not.toHaveProperty('subscriptions')
    expect(principal).not.toHaveProperty('passwordHash')
  })

  it('uses profile IDs on protected operations and redacts free photo/message payloads', async () => {
    const profile = await get(`/profiles/${other.profile.id}`)
    expect(profile.statusCode).toBe(200)
    expect(profile.json().data.photos).toEqual([])
    expect(profile.json().data.avatarUrl).toBeNull()
    const messages = await get(`/conversations/${conversation.id}/messages`)
    expect(messages.statusCode).toBe(200)
    expect(messages.json().data[0]).toMatchObject({ locked: true, body: null, attachments: null })
    expect(messages.body).not.toContain('secret.jpg')
    const conversations = await get('/conversations')
    expect(conversations.statusCode).toBe(200)
    expect(conversations.json().data[0].hasUnread).toBe(true)
    expect((await get('/foundation/admin')).statusCode).toBe(403)
    await db.message.createMany({ data: Array.from({ length: 3 }, () => ({ conversationId: conversation.id, senderId: user.profile.id, body: 'own message' })) })
    const capped = await app.inject({ method: 'POST', url: `/conversations/${conversation.id}/messages`, headers: { authorization: `Bearer ${token}` }, payload: { body: 'fourth' } })
    expect(capped.statusCode).toBe(403)
    expect(await db.message.count({ where: { conversationId: conversation.id, senderId: user.profile.id } })).toBe(3)
    await db.message.deleteMany({ where: { conversationId: conversation.id, senderId: user.profile.id } })
  })

  it('resolves overlapping subscriptions, archived plans and expiry without making billing identity', async () => {
    const sub = await db.subscription.create({ data: { userId: user.id, planId: plan.id, provider: 'MANUAL', providerSubscriptionId: `foundation-manual-${stamp}`, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 60_000) } })
    const paid = await db.subscription.create({ data: { userId: user.id, planId: plan.id, provider: 'STRIPE', providerSubscriptionId: `foundation-paid-${stamp}`, status: 'TRIALING', currentPeriodEnd: new Date(Date.now() + 60_000) } })
    let me = (await get('/auth/me')).json().data
    expect(me.membership.state).toBe('MEMBER')
    expect(me.membership.sources).toHaveLength(2)
    expect(me.entitlements).toEqual(ENTITLEMENT_DEFAULTS.MEMBER)
    expect((await get(`/profiles/${other.profile.id}`)).json().data.photos).toHaveLength(1)
    expect((await get(`/conversations/${conversation.id}/messages`)).json().data[0]).toMatchObject({ locked: false, body: 'protected incoming text' })
    await db.block.create({ data: { blockerProfileId: other.profile.id, blockedProfileId: user.profile.id } })
    expect((await get(`/profiles/${other.profile.id}`)).statusCode).toBe(404)
    const blocked = await app.inject({ method: 'POST', url: `/conversations/${conversation.id}/messages`, headers: { authorization: `Bearer ${token}` }, payload: { body: 'blocked member' } })
    expect(blocked.statusCode).toBe(403)
    await db.block.deleteMany({ where: { blockerProfileId: other.profile.id, blockedProfileId: user.profile.id } })
    await db.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELED' } })
    expect((await get('/auth/me')).json().data.membership.state).toBe('MEMBER')
    await db.subscription.update({ where: { id: paid.id }, data: { currentPeriodEnd: new Date(0) } })
    expect((await get('/auth/me')).json().data.membership.state).toBe('FREE')
  })

  it('reads role and suspension changes from the database, not stale session claims', async () => {
    await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
    expect((await get('/foundation/admin')).statusCode).toBe(200)
    expect((await get('/auth/me')).json().data.role).toBe('ADMIN')
    await db.user.update({ where: { id: user.id }, data: { suspendedAt: new Date() } })
    expect((await get('/auth/me')).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: user.email, password } })).statusCode).toBe(403)
    await db.user.update({ where: { id: user.id }, data: { suspendedAt: null, role: 'USER' } })
  })

  it('handles missing profiles deliberately and rejects expired/malformed/revoked sessions', async () => {
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: noProfile.email, password } })
    expect(login.statusCode).toBe(200)
    const missingToken = login.json().token
    expect((await app.inject({ method: 'GET', url: '/conversations', headers: { authorization: `Bearer ${missingToken}` } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: token } })).statusCode).toBe(401)
    await db.session.update({ where: { token: missingToken }, data: { expiresAt: new Date(0) } })
    expect((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${missingToken}` } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'POST', url: '/auth/logout', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200)
    expect((await get('/auth/me')).statusCode).toBe(401)
  })

  it('enforces centralized product limits at the boundary', () => {
    expect(() => enforceLimit(3, 2, 'limit')).not.toThrow()
    expect(() => enforceLimit(3, 3, 'limit')).toThrow()
    expect(() => enforceLimit('UNLIMITED', 100, 'limit')).not.toThrow()
  })
})
