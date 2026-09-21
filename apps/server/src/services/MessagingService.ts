import { db, Prisma } from '@project/db'
import { decodeCursor, encodeCursor, normalizeLimit } from '../lib/pagination'
import { PROFILE_FULL_SELECT, serializeProfile } from '../lib/serializers'
import { enforceLimit, resolveEntitlements, Entitlements, startOfUtcDay } from '../lib/entitlements'
import { isBlockedEitherWay } from '../lib/blocks'

// serializeProfile (below) always reads genderIdentity/bio/seekingGenders/
// locationLabel/onboardingStep/photos — PROFILE_SUMMARY_SELECT omits most of
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
  let lastMessageBody = null
  let hasUnread = false

  const viewerParticipant = conversation.participants.find((p: any) => p.profile.id === viewerProfileId)

  if (lastMessage) {
    const isOwn = lastMessage.senderId === viewerProfileId
    const locked = !isOwn && !entitlements['messaging.readIncoming']
    lastMessageBody = locked ? '🔒 New message' : lastMessage.body

    if (!isOwn && viewerParticipant) {
      hasUnread = !viewerParticipant.lastReadAt || new Date(lastMessage.createdAt) > new Date(viewerParticipant.lastReadAt)
    }
  }

  return {
    id: conversation.id,
    status: conversation.status,
    initiatedById: conversation.initiatedById,
    participants: conversation.participants.map((p: any) => {
      const revealPhoto = p.profile.id === viewerProfileId || entitlements['profile.fullPhotoAccess']
      return serializeProfile(p.profile, { revealPhoto })
    }),
    participantReadState: conversation.participants.map((p: any) => ({
      profileId: p.profile.id,
      lastReadAt: p.lastReadAt ?? null,
    })),
    lastMessageAt: lastMessage?.createdAt ?? null,
    lastMessageBody,
    hasUnread,
  }
}

function serializeMessage(message: any, viewerProfileId: string, entitlements: Entitlements) {
  const isOwn = message.senderId === viewerProfileId
  const locked = !isOwn && !entitlements['messaging.readIncoming']
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    body: locked ? null : message.body,
    attachments: locked ? null : message.attachments,
    locked,
    createdAt: message.createdAt,
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
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: CONVERSATION_INCLUDE,
    })

    const hasMore = conversations.length > limit
    const page = hasMore ? conversations.slice(0, limit) : conversations
    const last = page[page.length - 1]
    const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null

    return { data: page.map((c) => serializeConversation(c, viewerProfileId, entitlements)), meta: { hasMore, nextCursor } }
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
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
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
        attachments: attachments ?? Prisma.JsonNull
      } 
    })

    if (otherParticipant) {
      await db.jobQueue.create({
        data: {
          type: 'SEND_PUSH_NOTIFICATION',
          payload: {
            recipientProfileId: otherParticipant.profileId,
            title: 'New Match Message',
            body: 'You received a new message.',
            data: { conversationId }
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
