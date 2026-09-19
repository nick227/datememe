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
    const target = await db.profile.findUnique({ where: { id: targetProfileId } })
    if (!target) throw { statusCode: 404, message: 'Profile not found' }

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

    const mirror = await db.swipe.findUnique({
      where: { actorProfileId_targetProfileId: { actorProfileId: targetProfileId, targetProfileId: actorProfileId } },
    })
    if (!mirror || mirror.action !== 'LIKE') return { matched: false as const }

    const conversation = await messagingService.getOrCreateConversation(actorUserId, actorProfileId, targetProfileId)
    return { matched: true as const, conversation }
  }
}
