import { db } from '@project/db'
import { MessagingService } from './MessagingService'
import { SystemActivityService } from './SystemActivityService'
import { isBlockedEitherWay } from '../lib/blocks'

const messagingService = new MessagingService()
const systemActivity = new SystemActivityService()

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

    const [actor, target] = await Promise.all([
      db.profile.findUnique({ where: { id: actorProfileId }, select: { id: true, displayName: true } }),
      db.profile.findUnique({ where: { id: targetProfileId }, select: { id: true, displayName: true } }),
    ])
    if (!actor) throw { statusCode: 404, message: 'Profile not found' }
    if (!target) throw { statusCode: 404, message: 'Profile not found' }

    // Discovery already excludes blocked pairs, but guard the write path directly too
    // (defense in depth against a client hitting this with a stale/cached profile id).
    if (await isBlockedEitherWay(actorProfileId, targetProfileId)) {
      throw { statusCode: 404, message: 'Profile not found' }
    }

    const swipe = await db.swipe.upsert({
      where: { actorProfileId_targetProfileId: { actorProfileId, targetProfileId } },
      update: { action },
      create: { actorProfileId, targetProfileId, action },
    })

    if (action === 'PASS') return { matched: false as const }

    // A Like is also a durable activity record for the person who made it.
    // The swipe id is stable across request retries but changes after an
    // unmatch deletes the old swipe, so legitimate later re-likes survive.
    await systemActivity.recordProfileLiked(actorProfileId, target, swipe.id)

    const mirror = await db.swipe.findUnique({
      where: { actorProfileId_targetProfileId: { actorProfileId: targetProfileId, targetProfileId: actorProfileId } },
    })

    if (!mirror || mirror.action !== 'LIKE') {
      // Keep the existing "someone liked you" behavior, but do not add this
      // extra row when the Like immediately becomes a match (the match event is clearer).
      await systemActivity.recordProfileLikedYou(targetProfileId, actor, swipe.id)
      return { matched: false as const }
    }

    const conversation = await messagingService.getOrCreateConversation(actorUserId, actorProfileId, targetProfileId)
    await Promise.all([
      systemActivity.recordMatch(actorProfileId, target, conversation.id),
      systemActivity.recordMatch(targetProfileId, actor, conversation.id),
    ])

    return { matched: true as const, conversation }
  }
}