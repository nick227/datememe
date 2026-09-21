import type { AuthenticatedRequest } from '../lib/userContext'
import { db } from '@project/db'
import { recordAdminAudit } from './admin'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'

function coerceStringId(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw { statusCode: 400, message: `${label} is required` }
  }
  return value.trim()
}

// ── EntitySubmission review (the growth-pipeline's other half — a submission
// created immediately as a PENDING entity, per docs, had no reviewer-facing
// counterpart at all until this) ────────────────────────────────────────
export async function getEntitySubmissions(request: AuthenticatedRequest, reply: any) {
  const { cursor, limit, status } = request.query ?? {}
  const decodedCursor = cursor ? decodeCursor(cursor) : null
  const normalizedLimit = normalizeLimit(Number(limit ?? 20), 100, 20)

  const submissions = await db.entitySubmission.findMany({
    where: { status: status && typeof status === 'string' ? (status as any) : 'PENDING' },
    include: {
      entityType: true,
      submittedEntity: true,
      suggestedMatch: true,
      resolvedEntity: true,
      submittedByProfile: { select: { id: true, username: true, displayName: true } },
      reviewedByUser: { select: { id: true, email: true } },
    },
    take: normalizedLimit + 1,
    skip: decodedCursor ? 1 : 0,
    cursor: decodedCursor ? { id: decodedCursor.id } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  const hasMore = submissions.length > normalizedLimit
  const pageItems = hasMore ? submissions.slice(0, normalizedLimit) : submissions
  const nextCursor =
    hasMore && pageItems.length > 0
      ? encodeCursor({ createdAt: pageItems[pageItems.length - 1]!.createdAt.toISOString(), id: pageItems[pageItems.length - 1]!.id })
      : null

  return reply.send({ submissions: pageItems, hasMore, nextCursor })
}

export async function reviewEntitySubmission(request: AuthenticatedRequest, reply: any) {
  const submissionId = coerceStringId(request.params.id, 'id')
  const { action, mergeIntoEntityId, reviewNotes } = request.body ?? {}
  if (!['APPROVE', 'REJECT', 'MERGE'].includes(action)) {
    throw { statusCode: 400, message: 'action must be one of APPROVE, REJECT, MERGE' }
  }

  const submission = await db.entitySubmission.findUnique({ where: { id: submissionId } })
  if (!submission) throw { statusCode: 404, message: 'Submission not found' }
  if (submission.status !== 'PENDING') throw { statusCode: 400, message: 'This submission was already reviewed' }

  const before = { status: submission.status }
  let updated

  if (action === 'APPROVE') {
    ;[updated] = await db.$transaction([
      db.entitySubmission.update({
        where: { id: submissionId },
        data: { status: 'APPROVED', resolvedEntityId: submission.submittedEntityId, reviewedByUserId: request.user.id, reviewedAt: new Date(), reviewNotes: reviewNotes ?? null },
      }),
      db.entity.update({ where: { id: submission.submittedEntityId }, data: { status: 'APPROVED' } }),
    ])
  } else if (action === 'REJECT') {
    ;[updated] = await db.$transaction([
      db.entitySubmission.update({
        where: { id: submissionId },
        data: { status: 'REJECTED', reviewedByUserId: request.user.id, reviewedAt: new Date(), reviewNotes: reviewNotes ?? null },
      }),
      db.entity.update({ where: { id: submission.submittedEntityId }, data: { status: 'REJECTED' } }),
    ])
  } else {
    const targetEntityId = coerceStringId(mergeIntoEntityId, 'mergeIntoEntityId')
    const target = await db.entity.findUnique({ where: { id: targetEntityId }, select: { id: true } })
    if (!target) throw { statusCode: 404, message: 'Merge target entity not found' }
    if (targetEntityId === submission.submittedEntityId) throw { statusCode: 400, message: 'Cannot merge an entity into itself' }
    ;[updated] = await db.$transaction([
      db.entitySubmission.update({
        where: { id: submissionId },
        data: { status: 'MERGED', resolvedEntityId: targetEntityId, reviewedByUserId: request.user.id, reviewedAt: new Date(), reviewNotes: reviewNotes ?? null },
      }),
      // REJECTED, not APPROVED — the duplicate stops being a standalone
      // usable entity; mergedIntoId is what QuickPickService and friends
      // already treat as "excluded", this keeps that consistent.
      db.entity.update({ where: { id: submission.submittedEntityId }, data: { status: 'REJECTED', mergedIntoId: targetEntityId } }),
    ])
  }

  await recordAdminAudit(request.user.id, request.user.role, 'review_entity_submission', 'entity_submission', submissionId, before, { status: updated.status }, { action })
  return reply.send({ submission: updated })
}

// ── Report review (safety reports had a real filing endpoint and zero
// reviewer-facing counterpart — every report filed so far has gone
// nowhere) ────────────────────────────────────────────────────────────
export async function getReports(request: AuthenticatedRequest, reply: any) {
  const { cursor, limit, status } = request.query ?? {}
  const decodedCursor = cursor ? decodeCursor(cursor) : null
  const normalizedLimit = normalizeLimit(Number(limit ?? 20), 100, 20)

  const reports = await db.report.findMany({
    where: { status: status && typeof status === 'string' ? (status as any) : 'PENDING' },
    include: {
      reporter: { select: { id: true, username: true, displayName: true } },
      targetProfile: { select: { id: true, username: true, displayName: true } },
      targetMessage: { select: { id: true, body: true, senderId: true, conversationId: true } },
      reviewedByUser: { select: { id: true, email: true } },
    },
    take: normalizedLimit + 1,
    skip: decodedCursor ? 1 : 0,
    cursor: decodedCursor ? { id: decodedCursor.id } : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  const hasMore = reports.length > normalizedLimit
  const pageItems = hasMore ? reports.slice(0, normalizedLimit) : reports
  const nextCursor =
    hasMore && pageItems.length > 0
      ? encodeCursor({ createdAt: pageItems[pageItems.length - 1]!.createdAt.toISOString(), id: pageItems[pageItems.length - 1]!.id })
      : null

  return reply.send({ reports: pageItems, hasMore, nextCursor })
}

export async function reviewReport(request: AuthenticatedRequest, reply: any) {
  const reportId = coerceStringId(request.params.id, 'id')
  const { status, reviewNotes } = request.body ?? {}
  if (!['REVIEWED', 'ACTIONED'].includes(status)) {
    throw { statusCode: 400, message: 'status must be one of REVIEWED, ACTIONED' }
  }

  const report = await db.report.findUnique({ where: { id: reportId } })
  if (!report) throw { statusCode: 404, message: 'Report not found' }

  const before = { status: report.status }
  const updated = await db.report.update({
    where: { id: reportId },
    data: { status, reviewedByUserId: request.user.id, reviewedAt: new Date(), reviewNotes: reviewNotes ?? null },
  })

  await recordAdminAudit(request.user.id, request.user.role, 'review_report', 'report', reportId, before, { status: updated.status }, undefined)
  return reply.send({ report: updated })
}
