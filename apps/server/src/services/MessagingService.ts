import { db, Prisma } from '@project/db'
import { decodeCursor, encodeCursor, normalizeLimit, olderThanCursor } from '../lib/pagination'
import { PROFILE_FULL_SELECT, serializeProfile } from '../lib/serializers'
import { enforceLimit, resolveEntitlements, Entitlements, startOfUtcDay } from '../lib/entitlements'
import { isBlockedEitherWay } from '../lib/blocks'
import { toSystemData } from '../lib/systemData'

// serializeProfile (below) always reads genderIdentity/bio/seekingGenders/
// isA/lookingFor/locationLabel/onboardingStep/photos — PROFILE_SUMMARY_SELECT omits most of
// these, so those fields serialize as `undefined`, and the OpenAPI Profile
// schema marks them required (nullable is fine, missing isn't): every
// /conversations response 500'd on this before the fix. A conversation only
// ever has 2 participants, so there's no real cost to using the full select here.
export const CONVERSATION_INCLUDE = {
  participants: {
    select: {
      lastReadAt: true,
      profile: {
        select: PROFILE_FULL_SELECT,
      },
    },
  },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
}

export function serializeConversation(conversation: any, viewerProfileId: string, entitlements: Entitlements) {
  const lastMessage = conversation.messages[0]
  const participants: ReturnType<typeof serializeProfile>[] = []
  const participantReadState: { profileId: string; lastReadAt: Date | null }[] = []
  let viewerParticipant: { lastReadAt: Date | null } | null = null

  for (const participant of conversation.participants) {
    const profile = participant.profile
    if (profile.id === viewerProfileId) viewerParticipant = participant
    participants.push(serializeProfile(profile, {
      revealPhoto: profile.id === viewerProfileId || entitlements['profile.fullPhotoAccess'],
    }))
    participantReadState.push({ profileId: profile.id, lastReadAt: participant.lastReadAt ?? null })
  }

  let lastMessageBody = null
  let hasUnread = false
  if (lastMessage) {
    const isSystem = conversation.type === 'SYSTEM' || !!lastMessage.systemMessageType
    const isOwn = lastMessage.senderId === viewerProfileId
    const locked = !isSystem && !isOwn && !entitlements['messaging.readIncoming']
    lastMessageBody = locked ? '🔒 New message' : lastMessage.body
    if (!isOwn && viewerParticipant) {
      const shouldNotify = !isSystem || (lastMessage.attachments as any)?.notify !== false
      hasUnread = shouldNotify && (!viewerParticipant.lastReadAt || lastMessage.createdAt > viewerParticipant.lastReadAt)
    }
  }

  return {
    id: conversation.id,
    type: conversation.type,
    status: conversation.status,
    initiatedById: conversation.initiatedById,
    participants,
    participantReadState,
    lastMessageAt: lastMessage?.createdAt ?? null,
    lastMessageBody,
    hasUnread,
  }
}

function serializeMessage(message: any, viewerProfileId: string, entitlements: Entitlements) {
  const isSystem = !!message.systemMessageType
  const isOwn = message.senderId === viewerProfileId
  const locked = !isSystem && !isOwn && !entitlements['messaging.readIncoming']
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId ?? null,
    systemMessageType: message.systemMessageType ?? null,
    body: locked ? null : message.body,
    attachments: locked || isSystem || !Array.isArray(message.attachments) ? null : message.attachments,
    systemData: isSystem ? toSystemData(message.attachments) : null,
    locked,
    createdAt: message.createdAt,
  }
}

type SystemActivityInput =
  | { type: 'PROFILE_LIKED'; eventKey: string; displayName: string; profileId: string; notify?: boolean }
  | { type: 'PROFILE_LIKED_YOU'; eventKey: string; displayName: string; profileId: string; notify?: boolean }
  | { type: 'MATCH'; eventKey: string; displayName: string; profileId: string; conversationId: string; notify?: boolean }
  | { type: 'LIST_COMPLETED'; eventKey: string; title: string; categoryId: string; categorySlug: string; listId: string; notify?: boolean }

function activityContent(input: SystemActivityInput) {
  if (input.type === 'MATCH') {
    return {
      systemMessageType: 'MATCH' as const,
      body: `You matched with ${input.displayName}`,
      event: { type: input.type, profileId: input.profileId, conversationId: input.conversationId },
      cta: { label: 'Open conversation', route: 'Conversation', params: { conversationId: input.conversationId, displayName: input.displayName } },
    }
  }
  if (input.type === 'LIST_COMPLETED') {
    return {
      systemMessageType: 'ACTIVITY_DIGEST' as const,
      body: `You ranked ${input.title}`,
      event: { type: input.type, categoryId: input.categoryId, categorySlug: input.categorySlug, listId: input.listId },
      cta: { label: 'View answers', route: 'ListBuilder', params: { categorySlug: input.categorySlug } },
    }
  }
  return {
    systemMessageType: 'LIKE' as const,
    body: input.type === 'PROFILE_LIKED' ? `You liked ${input.displayName}` : `${input.displayName} liked you`,
    event: { type: input.type, profileId: input.profileId },
    cta: { label: 'View profile', route: 'ProfileDetail', params: { profileId: input.profileId, displayName: input.displayName } },
  }
}

export class MessagingService {
  async listConversations(viewerUserId: string, viewerProfileId: string, opts: { cursor?: string; limit?: number }) {
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const entitlements = await resolveEntitlements(viewerUserId)

    const conversations = await db.conversation.findMany({
      where: {
        participants: { some: { profileId: viewerProfileId } },
        ...olderThanCursor(cursor, 'updatedAt'),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: CONVERSATION_INCLUDE,
    })

    const hasMore = conversations.length > limit
    const page = hasMore ? conversations.slice(0, limit) : conversations
    const last = page[page.length - 1]
    // Pagination helpers call the timestamp `createdAt`, but inbox ordering is by
    // conversation activity. Store updatedAt in that cursor slot intentionally.
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.updatedAt.toISOString(), id: last.id }) : null

    return { data: page.map((c) => serializeConversation(c, viewerProfileId, entitlements)), meta: { hasMore, nextCursor } }
  }

  /**
   * Append a durable event to the viewer's one-person SYSTEM conversation.
   * `eventKey` makes retries idempotent without requiring another schema field;
   * structured navigation data lives in attachments instead of being parsed from copy.
   */
  async recordSystemActivity(profileId: string, input: SystemActivityInput) {
    let conversation = await db.conversation.findFirst({
      where: { type: 'SYSTEM', participants: { some: { profileId } } },
      select: { id: true },
    })

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          type: 'SYSTEM',
          initiatedById: null,
          participants: { create: [{ profileId }] },
        },
        select: { id: true },
      })
    }

    const duplicate = await db.message.findFirst({
      where: {
        conversationId: conversation.id,
        attachments: { path: '$.eventKey', equals: input.eventKey },
      },
      select: { id: true },
    })
    if (duplicate) return { created: false as const, conversationId: conversation.id }

    const { systemMessageType, body, event, cta } = activityContent(input)

    const now = new Date()
    await db.$transaction([
      db.message.create({
        data: {
          conversationId: conversation.id,
          senderId: null,
          systemMessageType,
          body,
          attachments: { eventKey: input.eventKey, event, cta, notify: input.notify !== false },
        },
      }),
      // Message inserts do not touch Conversation.updatedAt; bump it so the
      // system thread naturally falls into inbox chronology with human threads.
      db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: now } }),
    ])

    return { created: true as const, conversationId: conversation.id }
  }

  /**
   * Internal — not exposed as its own route. The only caller is SwipeService, at the
   * moment a mutual Like is detected (docs §7/§8: matching is the only door into a
   * conversation). `initiatorUserId` is only needed to resolve the photo gate on the
   * returned participant list.
   */
  async getOrCreateConversation(initiatorUserId: string, initiatorProfileId: string, otherProfileId: string) {
    const entitlements = await resolveEntitlements(initiatorUserId)

    const existing = await db.conversation.findFirst({
      where: {
        type: 'USER',
        AND: [
          { participants: { some: { profileId: initiatorProfileId } } },
          { participants: { some: { profileId: otherProfileId } } },
        ],
      },
      include: CONVERSATION_INCLUDE,
    })
    if (existing) return serializeConversation(existing, initiatorProfileId, entitlements)

    const created = await db.conversation.create({
      data: {
        type: 'USER',
        initiatedById: initiatorProfileId,
        participants: { create: [{ profileId: initiatorProfileId }, { profileId: otherProfileId }] },
      },
      include: CONVERSATION_INCLUDE,
    })
    return serializeConversation(created, initiatorProfileId, entitlements)
  }

  async listMessages(
    viewerUserId: string,
    viewerProfileId: string,
    conversationId: string,
    opts: { cursor?: string; limit?: number },
  ) {
    await this._assertParticipant(viewerProfileId, conversationId)
    const limit = normalizeLimit(opts.limit)
    const cursor = decodeCursor(opts.cursor)
    const entitlements = await resolveEntitlements(viewerUserId)

    const messages = await db.message.findMany({
      where: {
        conversationId,
        ...olderThanCursor(cursor, 'createdAt'),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })

    const hasMore = messages.length > limit
    const page = hasMore ? messages.slice(0, limit) : messages
    const last = page[page.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null

    return {
      data: page.map((m) => serializeMessage(m, viewerProfileId, entitlements)),
      meta: { hasMore, nextCursor },
    }
  }

  /**
   * Enforces the messaging gates from docs §8 (free-tier daily send cap; receiving is
   * gated at read time in listMessages) plus the block gate — blocking either party
   * disables further sends in both directions, but existing history stays readable.
   */
  async sendMessage(viewerUserId: string, viewerProfileId: string, conversationId: string, body?: string, attachments?: any[]) {
    await this._assertParticipant(viewerProfileId, conversationId)

    const conversation = await db.conversation.findUnique({ where: { id: conversationId }, select: { type: true } })
    if (conversation?.type === 'SYSTEM') {
      throw { statusCode: 403, message: 'System activity is read-only' }
    }

    const otherParticipant = await db.conversationParticipant.findFirst({
      where: { conversationId, profileId: { not: viewerProfileId } },
    })
    if (otherParticipant && (await isBlockedEitherWay(viewerProfileId, otherParticipant.profileId))) {
      throw { statusCode: 403, message: 'Cannot message this conversation' }
    }

    const entitlements = await resolveEntitlements(viewerUserId)
    const limit = entitlements['messaging.dailySendLimit']
    if (limit !== 'UNLIMITED') {
      const sentToday = await db.message.count({
        where: { senderId: viewerProfileId, createdAt: { gte: startOfUtcDay() } },
      })
      enforceLimit(limit, sentToday, `Free members can send up to ${limit} messages per day`)
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: viewerProfileId,
        body: body || null,
        attachments: attachments ?? Prisma.JsonNull,
      },
    })
    await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })

    if (otherParticipant) {
      await db.jobQueue.create({
        data: {
          type: 'SEND_PUSH_NOTIFICATION',
          payload: {
            recipientProfileId: otherParticipant.profileId,
            title: 'New Match Message',
            body: 'You received a new message.',
            data: { conversationId },
          },
        },
      })
    }

    return serializeMessage(message, viewerProfileId, entitlements)
  }

  /**
   * Undoes the match entirely — deletes the Swipe rows in both directions
   * (so the two profiles become eligible for Discover again, unlike a Block)
   * and deletes the Conversation itself (cascades to its Messages).
   */
  async unmatchConversation(viewerProfileId: string, conversationId: string) {
    await this._assertParticipant(viewerProfileId, conversationId)
    const conversation = await db.conversation.findUnique({ where: { id: conversationId }, select: { type: true } })
    if (conversation?.type === 'SYSTEM') throw { statusCode: 400, message: 'System activity cannot be unmatched' }

    const otherParticipant = await db.conversationParticipant.findFirst({
      where: { conversationId, profileId: { not: viewerProfileId } },
    })

    await db.$transaction([
      ...(otherParticipant
        ? [
            db.swipe.deleteMany({
              where: {
                OR: [
                  { actorProfileId: viewerProfileId, targetProfileId: otherParticipant.profileId },
                  { actorProfileId: otherParticipant.profileId, targetProfileId: viewerProfileId },
                ],
              },
            }),
          ]
        : []),
      db.conversation.delete({ where: { id: conversationId } }),
    ])

    return { success: true }
  }

  async markAsRead(viewerProfileId: string, conversationId: string) {
    await this._assertParticipant(viewerProfileId, conversationId)
    await db.conversationParticipant.update({
      where: { conversationId_profileId: { conversationId, profileId: viewerProfileId } },
      data: { lastReadAt: new Date() },
    })
    return { success: true }
  }

  private async _assertParticipant(profileId: string, conversationId: string) {
    const participant = await db.conversationParticipant.findUnique({
      where: { conversationId_profileId: { conversationId, profileId } },
    })
    if (!participant) throw { statusCode: 404, message: 'Conversation not found' }
  }
}
