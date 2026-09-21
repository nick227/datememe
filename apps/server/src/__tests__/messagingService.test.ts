import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@project/db'
import { MessagingService } from '../services/MessagingService'

/**
 * Regression coverage for the `/conversations` 500 (CONVERSATION_INCLUDE's
 * participant select omitted fields serializeProfile always reads, so
 * fast-json-stringify rejected the response as missing a required field —
 * confirmed live during the Conversations UX audit) and the new real
 * Unmatch endpoint (previously a UI stub with no backing capability at all).
 */
describe('MessagingService', () => {
  const service = new MessagingService()
  const createdUserIds: string[] = []

  async function makeProfile(label: string) {
    const now = Date.now() + Math.random()
    const user = await db.user.create({
      data: {
        email: `msg-${label}-${now}@example.com`,
        passwordHash: 'hash',
        profile: { create: { username: `msg-${label}-${now}`, displayName: label, birthdate: new Date('1993-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    createdUserIds.push(user.id)
    return user
  }

  afterAll(async () => {
    // Conversation.initiator is onDelete: Restrict — any conversation this
    // suite's own profiles still initiated (e.g. the rejected-unmatch guard
    // test, which must leave its conversation intact) has to go first.
    const profiles = await db.profile.findMany({ where: { userId: { in: createdUserIds } }, select: { id: true } })
    await db.conversation.deleteMany({ where: { initiatedById: { in: profiles.map((p) => p.id) } } })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('listConversations serializes real participant profiles without throwing (regression: fields omitted from CONVERSATION_INCLUDE)', async () => {
    const a = await makeProfile('list-a')
    const b = await makeProfile('list-b')
    await service.getOrCreateConversation(a.id, a.profile!.id, b.profile!.id)

    const result = await service.listConversations(a.id, a.profile!.id, {})
    expect(result.data).toHaveLength(1)
    const participantIds = result.data[0]!.participants.map((p: any) => p.id).sort()
    expect(participantIds).toEqual([a.profile!.id, b.profile!.id].sort())
    // The exact fields serializeProfile always reads — undefined (missing
    // from the Prisma select) is what broke response serialization; explicit
    // presence (even as null) is the actual regression guard.
    for (const p of result.data[0]!.participants) {
      expect(p).toHaveProperty('genderIdentity')
      expect(p).toHaveProperty('bio')
      expect(p).toHaveProperty('seekingGenders')
      expect(p).toHaveProperty('locationLabel')
      expect(p).toHaveProperty('onboardingStep')
    }
  })

  it('unmatchConversation deletes the conversation and both directions of the underlying Swipe, making the pair rediscoverable', async () => {
    const a = await makeProfile('unmatch-a')
    const b = await makeProfile('unmatch-b')
    await db.swipe.create({ data: { actorProfileId: a.profile!.id, targetProfileId: b.profile!.id, action: 'LIKE' } })
    await db.swipe.create({ data: { actorProfileId: b.profile!.id, targetProfileId: a.profile!.id, action: 'LIKE' } })
    const conversation = await service.getOrCreateConversation(a.id, a.profile!.id, b.profile!.id)

    const result = await service.unmatchConversation(a.profile!.id, conversation.id)
    expect(result.success).toBe(true)

    const remainingConversation = await db.conversation.findUnique({ where: { id: conversation.id } })
    expect(remainingConversation).toBeNull()
    const remainingSwipes = await db.swipe.findMany({
      where: { OR: [{ actorProfileId: a.profile!.id, targetProfileId: b.profile!.id }, { actorProfileId: b.profile!.id, targetProfileId: a.profile!.id }] },
    })
    expect(remainingSwipes).toHaveLength(0)
  })

  it('listConversations exposes participantReadState so the client can derive "Seen" without a per-message read model', async () => {
    const a = await makeProfile('seen-a')
    const b = await makeProfile('seen-b')
    const conversation = await service.getOrCreateConversation(a.id, a.profile!.id, b.profile!.id)
    await service.sendMessage(a.id, a.profile!.id, conversation.id, 'hi')
    await service.markAsRead(b.profile!.id, conversation.id)

    const result = await service.listConversations(a.id, a.profile!.id, {})
    const readState = result.data[0]!.participantReadState
    expect(readState).toHaveLength(2)
    const bState = readState.find((p: any) => p.profileId === b.profile!.id)
    const aState = readState.find((p: any) => p.profileId === a.profile!.id)
    expect(bState?.lastReadAt).not.toBeNull()
    expect(aState?.lastReadAt).toBeNull()
  })

  it('unmatchConversation rejects a caller who is not a participant', async () => {
    const a = await makeProfile('unmatch-guard-a')
    const b = await makeProfile('unmatch-guard-b')
    const outsider = await makeProfile('unmatch-guard-outsider')
    const conversation = await service.getOrCreateConversation(a.id, a.profile!.id, b.profile!.id)

    await expect(service.unmatchConversation(outsider.profile!.id, conversation.id)).rejects.toMatchObject({ statusCode: 404 })

    const stillThere = await db.conversation.findUnique({ where: { id: conversation.id } })
    expect(stillThere).not.toBeNull()
  })
})
