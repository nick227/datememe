import { db } from '@project/db'
import { PROFILE_FULL_SELECT, serializeProfile } from '../lib/serializers'

export class SafetyService {
  /** Idempotent — blocking twice is a no-op, not an error. */
  async blockProfile(blockerProfileId: string, blockedProfileId: string) {
    if (blockerProfileId === blockedProfileId) {
      throw { statusCode: 400, message: 'Cannot block yourself' }
    }
    const target = await db.profile.findUnique({ where: { id: blockedProfileId } })
    if (!target) throw { statusCode: 404, message: 'Profile not found' }

    await db.block.upsert({
      where: { blockerProfileId_blockedProfileId: { blockerProfileId, blockedProfileId } },
      update: {},
      create: { blockerProfileId, blockedProfileId },
    })
  }

  async unblockProfile(blockerProfileId: string, blockedProfileId: string) {
    await db.block.deleteMany({ where: { blockerProfileId, blockedProfileId } })
  }

  async listBlockedProfiles(blockerProfileId: string) {
    const blocks = await db.block.findMany({
      where: { blockerProfileId },
      include: { blocked: { select: PROFILE_FULL_SELECT } },
      orderBy: { createdAt: 'desc' },
    })
    // Their photo doesn't matter on a "manage blocked users" screen — never reveal it here.
    return blocks.map((b) => serializeProfile(b.blocked, { revealPhoto: false }))
  }

  async submitReport(
    reporterProfileId: string,
    input: {
      targetType: 'PROFILE' | 'MESSAGE'
      targetProfileId?: string
      targetMessageId?: string
      reason: string
      details?: string | null
    },
  ) {
    if (input.targetType === 'PROFILE') {
      if (!input.targetProfileId) {
        throw { statusCode: 400, message: 'targetProfileId is required for a PROFILE report' }
      }
      const target = await db.profile.findUnique({ where: { id: input.targetProfileId } })
      if (!target) throw { statusCode: 404, message: 'Profile not found' }
    } else {
      if (!input.targetMessageId) {
        throw { statusCode: 400, message: 'targetMessageId is required for a MESSAGE report' }
      }
      const target = await db.message.findUnique({ where: { id: input.targetMessageId } })
      if (!target) throw { statusCode: 404, message: 'Message not found' }
    }

    const report = await db.report.create({
      data: {
        reporterProfileId,
        targetType: input.targetType,
        targetProfileId: input.targetType === 'PROFILE' ? input.targetProfileId : null,
        targetMessageId: input.targetType === 'MESSAGE' ? input.targetMessageId : null,
        reason: input.reason,
        details: input.details ?? null,
      },
    })
    return { id: report.id, status: report.status }
  }
}
