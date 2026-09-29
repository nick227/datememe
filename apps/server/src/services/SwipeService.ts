import { db } from '@project/db'
import { MessagingService } from './MessagingService'
import { isBlockedEitherWay } from '../lib/blocks'

const messagingService = new MessagingService()

/**
 * See docs/data-schema-proposal.md §7: a Match is derived (two opposite-direction
 * `Swipe` rows both LIKE), never stored as its own fact. The only place a
 * `Conversation` gets created is right here, the moment the second LIKE lands.
 */
export class SwipeService {
  async submitSwipe(
    actorUserId: string,
    actorProfileId: string,
    targetProfileId: string,
    action: 'LIKE' | 'PASS',
  ) {
    if (actorProfileId === targetProfileId) {
      throw { statusCode: 400, message: 'Cannot swipe on yourself' }
    }

    const [actor, target, previous] = await Promise.all([
      db.profile.findUnique({ where: { id: actorProfileId }, select: { id: true, displayName: true } }),
      db.profile.findUnique({ where: { id: targetProfileId }, select: { id: true, displayName: true } }),
      db.swipe.findUnique({ where: { actorProfileId_targetProfileId: { actorProfileId, targetProfileId } } }),
    ])
    if (!actor || !target) throw { statusCode: 404, message: 'Profile not found' }

    // Discovery already excludes blocked pairs, but guard the write path directly too
    // (defense in depth against a client hitting this with a stale/cached profile id).
    if (await isBlockedEitherWay(actorProfileId, targetProfileId)) {
      throw { statusCode: 404, message: 'Profile not found' }
    }

    await db.swipe.upsert({
      where: { actorProfileId_targetProfileId: { actorProfileId, targetProfileId } },
      update: { action },
      create: { actorProfileId, targetProfileId, action },
    })

    if (action === 'PASS') return { matched: false as const }

    const becameLike = previous?.action !== 'LIKE'
    if (becameLike) {
      await Promise.all([
        messagingService.recordSystemActivity(actorProfileId, {
          type: 'PROFILE_LIKED',
          eventKey: `profile-liked:${actorProfileId}:${targetProfileId}`,
          displayName: target.displayName,
          profileId: targetProfileId,
          notify: false,
        }),
        messagingService.recordSystemActivity(targetProfileId, {
          type: 'PROFILE_LIKED_YOU',
          eventKey: `profile-liked-you:${targetProfileId}:${actorProfileId}`,
          displayName: actor.displayName,
          profileId: actorProfileId,
          notify: true,
        }),
      ])
    }

    const mirror = await db.swipe.findUnique({
      where: { actorProfileId_targetProfileId: { actorProfileId: targetProfileId, targetProfileId: actorProfileId } },
    })
    if (!mirror || mirror.action !== 'LIKE') return { matched: false as const }

    const conversation = await messagingService.getOrCreateConversation(actorUserId, actorProfileId, targetProfileId)

    // Only the transition into LIKE can create a new match. Retries and an
    // already-liked profile do not append duplicate activity rows.
    if (becameLike) {
      await Promise.all([
        messagingService.recordSystemActivity(actorProfileId, {
          type: 'MATCH',
          eventKey: `match:${actorProfileId}:${targetProfileId}`,
          displayName: target.displayName,
          profileId: targetProfileId,
          conversationId: conversation.id,
          notify: true,
        }),
        messagingService.recordSystemActivity(targetProfileId, {
          type: 'MATCH',
          eventKey: `match:${targetProfileId}:${actorProfileId}`,
          displayName: actor.displayName,
          profileId: actorProfileId,
          conversationId: conversation.id,
          notify: true,
        }),
      ])
    }

    return { matched: true as const, conversation }
  }
}
