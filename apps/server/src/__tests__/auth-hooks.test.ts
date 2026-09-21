import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { db } from '@project/db'
import * as security from '../plugins/security'

/**
 * Regression guard for FST_ERR_HOOK_INVALID_ASYNC_HANDLER: Fastify's
 * async-hook arity detection treats any 3-declared-param async function used
 * as a native `preHandler` as legacy callback-style (`(request, reply, done)`)
 * and throws at *route-registration* time — a full server-startup crash, not
 * a request-time error. This bug has recurred twice in this codebase: once on
 * `adminAuth`, once on `bearerAuth` (wired directly for `/quick-picks/generate`
 * and `/quick-picks/submit` in index.ts). Both functions are still called via
 * fastify-openapi-glue's `securityHandlers` convention elsewhere, which always
 * invokes with 3 args regardless of declared arity — so the fix is "declare
 * at most 2 params", never "never take a 3rd argument".
 */
describe('auth hooks — native preHandler registration', () => {
  it('bearerAuth and adminAuth are declared with at most 2 params', () => {
    // The exact invariant that broke, asserted directly — independent of
    // which route happens to trip it, and independent of Fastify's own
    // internal error message wording.
    expect(security.bearerAuth.length).toBeLessThanOrEqual(2)
    expect(security.adminAuth.length).toBeLessThanOrEqual(2)
  })

  it('registers routes using bearerAuth and adminAuth as native preHandlers without throwing at startup', async () => {
    const app = Fastify({ logger: false })
    expect(() => {
      app.get('/hooktest/protected', { preHandler: [security.bearerAuth] }, async () => ({ ok: true }))
      app.get('/hooktest/admin-only', { preHandler: [security.adminAuth] }, async () => ({ ok: true }))
    }).not.toThrow()
    // Route/hook compilation (where the real FST_ERR_HOOK_INVALID_ASYNC_HANDLER
    // crash actually happened) is lazy until first dispatch — .inject() forces
    // it without needing a real listening socket (app.ready() alone hits an
    // unrelated Fastify/undici quirk reading server.address() pre-listen).
    const res = await app.inject({ method: 'GET', url: '/hooktest/protected' })
    expect(res.statusCode).not.toBe(500)
    await app.close()
  })

  describe('bearerAuth behavior', () => {
    let user: any
    let token: string
    let suspendedUser: any
    let suspendedToken: string

    beforeAll(async () => {
      const now = Date.now()
      user = await db.user.create({
        data: {
          email: `hooktest-${now}@example.com`,
          passwordHash: 'hash',
          profile: { create: { username: `hooktest-${now}`, displayName: 'Hook Test', birthdate: new Date('1990-01-01T00:00:00.000Z') } },
        },
      })
      const session = await db.session.create({
        data: { userId: user.id, token: `hooktest-token-${now}`, expiresAt: new Date(Date.now() + 60_000) },
      })
      token = session.token

      suspendedUser = await db.user.create({
        data: {
          email: `hooktest-suspended-${now}@example.com`,
          passwordHash: 'hash',
          suspendedAt: new Date(),
          profile: { create: { username: `hooktest-susp-${now}`, displayName: 'Suspended', birthdate: new Date('1990-01-01T00:00:00.000Z') } },
        },
      })
      const suspendedSession = await db.session.create({
        data: { userId: suspendedUser.id, token: `hooktest-susp-token-${now}`, expiresAt: new Date(Date.now() + 60_000) },
      })
      suspendedToken = suspendedSession.token
    })

    afterAll(async () => {
      const userIds = [user.id, suspendedUser.id]
      await db.session.deleteMany({ where: { userId: { in: userIds } } })
      await db.profile.deleteMany({ where: { userId: { in: userIds } } })
      await db.user.deleteMany({ where: { id: { in: userIds } } })
    })

    function buildApp() {
      const app = Fastify({ logger: false })
      app.get('/hooktest/protected', { preHandler: [security.bearerAuth] }, async (request: any) => ({ userId: request.user.id }))
      return app
    }

    it('rejects requests with no token', async () => {
      const res = await buildApp().inject({ method: 'GET', url: '/hooktest/protected' })
      expect(res.statusCode).toBe(401)
    })

    it('rejects an unknown token', async () => {
      const res = await buildApp().inject({
        method: 'GET',
        url: '/hooktest/protected',
        headers: { authorization: 'Bearer not-a-real-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('rejects a suspended account even with a valid session', async () => {
      const res = await buildApp().inject({
        method: 'GET',
        url: '/hooktest/protected',
        headers: { authorization: `Bearer ${suspendedToken}` },
      })
      expect(res.statusCode).toBe(403)
    })

    it('accepts a valid Bearer token and populates request.user', async () => {
      const res = await buildApp().inject({
        method: 'GET',
        url: '/hooktest/protected',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().userId).toBe(user.id)
    })
  })
})
