import { db } from '@project/db'

type ProfileRef = { id: string; displayName: string }
type ListRef = { id: string; slug: string; shortLabel: string; orderingMode: 'RANKED' | 'UNRANKED' }

type RecordInput = {
  recipientProfileId: string
  systemMessageType: 'LIKE' | 'MATCH' | 'ACTIVITY_DIGEST'
  eventKey: string
  eventType: 'PROFILE_LIKED' | 'PROFILE_LIKED_YOU' | 'MATCH' | 'LIST_COMPLETED'
  body: string
  data: Record<string, unknown>
  cta?: { label: string; route: 'ProfileDetail' | 'Conversation' | 'ListBuilder'; params: Record<string, unknown> }
}

/**
 * Appends durable, structured activity records to the one SYSTEM conversation
 * owned by a profile. The human-readable body is only the snapshot shown in
 * the inbox; navigation and identity live in attachments so clients never
 * have to parse prose.
 */
export class SystemActivityService {
  private async getOrCreateSystemConversation(profileId: string) {
    const existing = await db.conversation.findFirst({
      where: { type: 'SYSTEM', participants: { some: { profileId } } },
    })
    if (existing) return existing

    return db.conversation.create({
      data: {
        type: 'SYSTEM',
        participants: { create: [{ profileId }] },
      },
    })
  }

  private async record(input: RecordInput) {
    const conversation = await this.getOrCreateSystemConversation(input.recipientProfileId)

    const existing = await db.message.findFirst({
      where: {
        conversationId: conversation.id,
        attachments: { string_contains: input.eventKey },
      },
    })
    if (existing) return existing

    const now = new Date()
    return db.$transaction(async (tx) => {
      // Retry-safe: API retries and repeated saves must not duplicate history.
      const duplicate = await tx.message.findFirst({
        where: {
          conversationId: conversation.id,
          attachments: { string_contains: input.eventKey },
        },
      })
      if (duplicate) return duplicate

      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          systemMessageType: input.systemMessageType,
          body: input.body,
          attachments: {
            eventKey: input.eventKey,
            eventType: input.eventType,
            ...input.data,
            ...(input.cta ? { cta: input.cta } : {}),
          } as any,
        },
      })

      // Conversation.updatedAt is the inbox activity clock. Relation writes do
      // not touch it automatically, so every system event advances it here.
      await tx.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } })
      return message
    })
  }

  recordProfileLiked(actorProfileId: string, target: ProfileRef) {
    return this.record({
      recipientProfileId: actorProfileId,
      systemMessageType: 'LIKE',
      eventKey: `profile-liked:${actorProfileId}:${target.id}`,
      eventType: 'PROFILE_LIKED',
      body: `You liked ${target.displayName}`,
      data: { profileId: target.id, displayName: target.displayName },
      cta: { label: 'View profile', route: 'ProfileDetail', params: { profileId: target.id, displayName: target.displayName } },
    })
  }

  recordProfileLikedYou(recipientProfileId: string, actor: ProfileRef) {
    return this.record({
      recipientProfileId,
      systemMessageType: 'LIKE',
      eventKey: `profile-liked-you:${recipientProfileId}:${actor.id}`,
      eventType: 'PROFILE_LIKED_YOU',
      body: `${actor.displayName} liked your profile`,
      data: { profileId: actor.id, displayName: actor.displayName },
      cta: { label: 'View profile', route: 'ProfileDetail', params: { profileId: actor.id, displayName: actor.displayName } },
    })
  }

  recordMatch(recipientProfileId: string, other: ProfileRef, conversationId: string) {
    return this.record({
      recipientProfileId,
      systemMessageType: 'MATCH',
      eventKey: `match:${recipientProfileId}:${other.id}`,
      eventType: 'MATCH',
      body: `You matched with ${other.displayName}`,
      data: { profileId: other.id, displayName: other.displayName, conversationId },
      cta: { label: 'Open conversation', route: 'Conversation', params: { conversationId, displayName: other.displayName } },
    })
  }

  recordListCompleted(profileId: string, list: ListRef) {
    const verb = list.orderingMode === 'RANKED' ? 'ranked' : 'answered'
    return this.record({
      recipientProfileId: profileId,
      systemMessageType: 'ACTIVITY_DIGEST',
      eventKey: `list-completed:${profileId}:${list.id}`,
      eventType: 'LIST_COMPLETED',
      body: `You ${verb} ${list.shortLabel}`,
      data: { categoryId: list.id, categorySlug: list.slug, shortLabel: list.shortLabel },
      cta: { label: 'View answers', route: 'ListBuilder', params: { categorySlug: list.slug, shortLabel: list.shortLabel } },
    })
  }
}
