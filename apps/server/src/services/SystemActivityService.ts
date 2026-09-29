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
  private async record(input: RecordInput) {
    return db.$transaction(async (tx) => {
      // Serialize system-activity writes for this recipient. This protects both
      // the one-SYSTEM-thread invariant and event idempotency when the same API
      // request is retried concurrently; relation/JSON fields have no useful
      // unique constraint for either invariant today.
      await tx.$queryRaw`SELECT id FROM Profile WHERE id = ${input.recipientProfileId} FOR UPDATE`

      let conversation = await tx.conversation.findFirst({
        where: { type: 'SYSTEM', participants: { some: { profileId: input.recipientProfileId } } },
      })
      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            type: 'SYSTEM',
            participants: { create: [{ profileId: input.recipientProfileId }] },
          },
        })
      }

      // Prisma/MySQL `string_contains` is not reliable for matching a value
      // nested inside a JSON object. Read this user's system-message metadata
      // and compare the structured key exactly instead.
      const prior = await tx.message.findMany({
        where: { conversationId: conversation.id, systemMessageType: input.systemMessageType },
        select: { id: true, attachments: true },
      })
      const duplicateId = prior.find((m) => (m.attachments as any)?.eventKey === input.eventKey)?.id
      if (duplicateId) {
        return tx.message.findUniqueOrThrow({ where: { id: duplicateId } })
      }

      const now = new Date()
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

  recordProfileLiked(actorProfileId: string, target: ProfileRef, swipeId: string) {
    return this.record({
      recipientProfileId: actorProfileId,
      systemMessageType: 'LIKE',
      // Swipe ids survive retries but change after an unmatch deletes the old
      // swipe, so a genuine later re-like becomes a new piece of history.
      eventKey: `profile-liked:${actorProfileId}:${swipeId}`,
      eventType: 'PROFILE_LIKED',
      body: `You liked ${target.displayName}`,
      data: { profileId: target.id, displayName: target.displayName, swipeId },
      cta: { label: 'View profile', route: 'ProfileDetail', params: { profileId: target.id, displayName: target.displayName } },
    })
  }

  recordProfileLikedYou(recipientProfileId: string, actor: ProfileRef, swipeId: string) {
    return this.record({
      recipientProfileId,
      systemMessageType: 'LIKE',
      eventKey: `profile-liked-you:${recipientProfileId}:${swipeId}`,
      eventType: 'PROFILE_LIKED_YOU',
      body: `${actor.displayName} liked your profile`,
      data: { profileId: actor.id, displayName: actor.displayName, swipeId },
      cta: { label: 'View profile', route: 'ProfileDetail', params: { profileId: actor.id, displayName: actor.displayName } },
    })
  }

  recordMatch(recipientProfileId: string, other: ProfileRef, conversationId: string) {
    return this.record({
      recipientProfileId,
      systemMessageType: 'MATCH',
      // A new match after an unmatch creates a new USER conversation, making
      // this key retry-safe without erasing legitimate later match history.
      eventKey: `match:${recipientProfileId}:${conversationId}`,
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
      // A user's list is one persistent answer set, so subsequent edits do not
      // create new history rows for the same category.
      eventKey: `list-completed:${profileId}:${list.id}`,
      eventType: 'LIST_COMPLETED',
      body: `You ${verb} ${list.shortLabel}`,
      data: { categoryId: list.id, categorySlug: list.slug, shortLabel: list.shortLabel },
      cta: { label: 'View answers', route: 'ListBuilder', params: { categorySlug: list.slug, shortLabel: list.shortLabel } },
    })
  }
}
