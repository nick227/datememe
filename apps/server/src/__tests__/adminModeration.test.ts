import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { db } from '@project/db'
import * as adminModerationHandlers from '../handlers/adminModeration'
import * as security from '../plugins/security'

/**
 * Regression coverage for the moderation queues (EntitySubmission review +
 * Report review) — these had a filing/creation path (the growth pipeline,
 * `submitReport`) but zero reviewer-facing endpoint at all until this pass.
 * Confirmed live against real pre-existing data: a real pending submission
 * and a real pending report from earlier sessions had been sitting
 * unreviewable since they were created.
 */
async function buildApp() {
  const app = Fastify({ logger: false })
  app.get('/admin/moderation/submissions', { preHandler: [security.adminAuth] }, adminModerationHandlers.getEntitySubmissions)
  app.post('/admin/moderation/submissions/:id/review', { preHandler: [security.adminAuth] }, adminModerationHandlers.reviewEntitySubmission)
  app.get('/admin/moderation/reports', { preHandler: [security.adminAuth] }, adminModerationHandlers.getReports)
  app.post('/admin/moderation/reports/:id/review', { preHandler: [security.adminAuth] }, adminModerationHandlers.reviewReport)
  return app
}

describe('admin moderation', () => {
  let adminUser: any
  let adminToken: string
  let regularUser: any
  let regularToken: string
  let regularProfile: any
  let entityType: any

  beforeAll(async () => {
    const now = Date.now()
    adminUser = await db.user.create({
      data: {
        email: `mod-admin-${now}@example.com`,
        passwordHash: 'hash',
        role: 'ADMIN',
        profile: { create: { username: `mod-admin-${now}`, displayName: 'Mod Admin', birthdate: new Date('1990-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    regularUser = await db.user.create({
      data: {
        email: `mod-user-${now}@example.com`,
        passwordHash: 'hash',
        profile: { create: { username: `mod-user-${now}`, displayName: 'Mod User', birthdate: new Date('1995-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    regularProfile = regularUser.profile

    const adminSession = await db.session.create({ data: { userId: adminUser.id, token: `mod-admin-token-${now}`, expiresAt: new Date(Date.now() + 60_000) } })
    const regularSession = await db.session.create({ data: { userId: regularUser.id, token: `mod-user-token-${now}`, expiresAt: new Date(Date.now() + 60_000) } })
    adminToken = adminSession.token
    regularToken = regularSession.token

    entityType = await db.entityType.create({ data: { slug: `mod-type-${now}`, label: 'Mod Type', pluralLabel: 'Mod Types' } })
  })

  afterAll(async () => {
    await db.entitySubmission.deleteMany({ where: { entityTypeId: entityType.id } })
    await db.entity.deleteMany({ where: { entityTypeId: entityType.id } })
    await db.entityType.delete({ where: { id: entityType.id } })
    await db.adminAuditEvent.deleteMany({ where: { actorUserId: { in: [adminUser.id, regularUser.id] } } })
    await db.report.deleteMany({ where: { reporterProfileId: regularProfile.id } })
    await db.session.deleteMany({ where: { userId: { in: [adminUser.id, regularUser.id] } } })
    await db.profile.deleteMany({ where: { userId: { in: [adminUser.id, regularUser.id] } } })
    await db.user.deleteMany({ where: { id: { in: [adminUser.id, regularUser.id] } } })
  })

  async function makeSubmission(label: string) {
    const submittedEntity = await db.entity.create({
      data: { entityTypeId: entityType.id, canonicalName: label, slug: `${label}-${Date.now()}-${Math.random()}`, status: 'PENDING', sourceType: 'USER_SUBMITTED', submittedByProfileId: regularProfile.id },
    })
    const submission = await db.entitySubmission.create({
      data: { entityTypeId: entityType.id, rawText: label, submittedByProfileId: regularProfile.id, submittedEntityId: submittedEntity.id, status: 'PENDING' },
    })
    return { submission, submittedEntity }
  }

  it('rejects non-admin callers', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/moderation/submissions', headers: { authorization: `Bearer ${regularToken}` } })
    expect(res.statusCode).toBe(403)
  })

  it('rejects unauthenticated callers', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/admin/moderation/submissions' })
    expect(res.statusCode).toBe(401)
  })

  it('lists pending submissions and approving one flips the underlying Entity to APPROVED', async () => {
    const app = await buildApp()
    const { submission, submittedEntity } = await makeSubmission('Approve Me')

    const list = await app.inject({ method: 'GET', url: '/admin/moderation/submissions', headers: { authorization: `Bearer ${adminToken}` } })
    expect(list.statusCode).toBe(200)
    expect(list.json().submissions.some((s: any) => s.id === submission.id)).toBe(true)

    const review = await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVE', reviewNotes: 'looks good' },
    })
    expect(review.statusCode).toBe(200)
    expect(review.json().submission.status).toBe('APPROVED')
    expect(review.json().submission.resolvedEntityId).toBe(submittedEntity.id)

    const entity = await db.entity.findUnique({ where: { id: submittedEntity.id } })
    expect(entity?.status).toBe('APPROVED')

    const audit = await db.adminAuditEvent.findFirst({ where: { action: 'review_entity_submission', targetId: submission.id } })
    expect(audit).toBeTruthy()
    expect(audit?.actorUserId).toBe(adminUser.id)
  })

  it('rejecting a submission flips the underlying Entity to REJECTED', async () => {
    const app = await buildApp()
    const { submission, submittedEntity } = await makeSubmission('Reject Me')

    const review = await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'REJECT' },
    })
    expect(review.statusCode).toBe(200)
    expect(review.json().submission.status).toBe('REJECTED')

    const entity = await db.entity.findUnique({ where: { id: submittedEntity.id } })
    expect(entity?.status).toBe('REJECTED')
  })

  it('merging a submission sets mergedIntoId and rejects the duplicate entity, without touching the target', async () => {
    const app = await buildApp()
    const { submission, submittedEntity } = await makeSubmission('Duplicate Name')
    const canonical = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Duplicate Name', slug: `canonical-${Date.now()}`, status: 'APPROVED' } })

    const review = await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'MERGE', mergeIntoEntityId: canonical.id },
    })
    expect(review.statusCode).toBe(200)
    expect(review.json().submission.status).toBe('MERGED')
    expect(review.json().submission.resolvedEntityId).toBe(canonical.id)

    const duplicateEntity = await db.entity.findUnique({ where: { id: submittedEntity.id } })
    expect(duplicateEntity?.status).toBe('REJECTED')
    expect(duplicateEntity?.mergedIntoId).toBe(canonical.id)

    const target = await db.entity.findUnique({ where: { id: canonical.id } })
    expect(target?.status).toBe('APPROVED')
  })

  it('rejects reviewing a submission twice', async () => {
    const app = await buildApp()
    const { submission } = await makeSubmission('Once Only')
    await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'APPROVE' },
    })
    const second = await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'REJECT' },
    })
    expect(second.statusCode).toBe(400)
  })

  it('lists pending reports and reviewing one persists status, notes, and the reviewer', async () => {
    const app = await buildApp()
    const report = await db.report.create({
      data: { reporterProfileId: regularProfile.id, targetType: 'PROFILE', targetProfileId: regularProfile.id, reason: 'Test reason' },
    })

    const list = await app.inject({ method: 'GET', url: '/admin/moderation/reports', headers: { authorization: `Bearer ${adminToken}` } })
    expect(list.statusCode).toBe(200)
    expect(list.json().reports.some((r: any) => r.id === report.id)).toBe(true)

    const review = await app.inject({
      method: 'POST',
      url: `/admin/moderation/reports/${report.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'ACTIONED', reviewNotes: 'handled' },
    })
    expect(review.statusCode).toBe(200)
    expect(review.json().report.status).toBe('ACTIONED')
    expect(review.json().report.reviewNotes).toBe('handled')
    expect(review.json().report.reviewedByUserId).toBe(adminUser.id)

    // Reviewed reports drop out of the default (PENDING) listing.
    const listAfter = await app.inject({ method: 'GET', url: '/admin/moderation/reports', headers: { authorization: `Bearer ${adminToken}` } })
    expect(listAfter.json().reports.some((r: any) => r.id === report.id)).toBe(false)
  })

  it('rejects an invalid review action/status', async () => {
    const app = await buildApp()
    const { submission } = await makeSubmission('Bad Action')
    const res = await app.inject({
      method: 'POST',
      url: `/admin/moderation/submissions/${submission.id}/review`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'DELETE_EVERYTHING' },
    })
    expect(res.statusCode).toBe(400)
  })
})
