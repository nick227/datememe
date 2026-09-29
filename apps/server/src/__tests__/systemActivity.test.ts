import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@project/db'
import { MessagingService } from '../services/MessagingService'
import { SystemActivityService } from '../services/SystemActivityService'

/** Regression coverage for the SYSTEM conversation as durable user activity. */
describe('SystemActivityService', () => {
  const activity = new SystemActivityService()
  const messaging = new MessagingService()
  const createdUserIds: string[] = []

  async function makeProfile(label: string) {
    const nonce = `${Date.now()}-${Math.random()}`
    const user = await db.user.create({
      data: {
        email: `activity-${label}-${nonce}@example.com`,
        passwordHash: 'hash',
        profile: {
          create: {
            username: `activity-${label}-${nonce}`,
            displayName: label,
            birthdate: new Date('1993-01-01T00:00:00.000Z'),
          },
        },
      },
      include: { profile: true },
    })
    createdUserIds.push(user.id)
    return user
  }

  afterAll(async () => {
    const profiles = await db.profile.findMany({ where: { userId: { in: createdUserIds } }, select: { id: true } })
    const profileIds = profiles.map((p) => p.id)
    const participantRows = await db.conversationParticipant.findMany({
      where: { profileId: { in: profileIds } },
      select: { conversationId: true },
    })
    await db.conversation.deleteMany({ where: { id: { in: participantRows.map((p) => p.conversationId) } } })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  it('keeps one persistent SYSTEM thread and deduplicates concurrent retries', async () => {
    const actor = await makeProfile('activity-actor')
    const target = await makeProfile('activity-target')

    await Promise.all([
      activity.recordProfileLiked(actor.profile!.id, target.profile!, 'swipe-retry-test'),
      activity.recordProfileLiked(actor.profile!.id, target.profile!, 'swipe-retry-test'),
    ])

    const systemConversations = await db.conversation.findMany({
      where: { type: 'SYSTEM', participants: { some: { profileId: actor.profile!.id } } },
      include: { messages: true },
    })
    expect(systemConversations).toHaveLength(1)
    expect(systemConversations[0]!.messages).toHaveLength(1)
    expect(systemConversations[0]!.messages[0]!.body).toBe(`You liked ${target.profile!.displayName}`)
    expect(systemConversations[0]!.messages[0]!.attachments).toMatchObject({
      eventType: 'PROFILE_LIKED',
      profileId: target.profile!.id,
      swipeId: 'swipe-retry-test',
    })
  })

  it('serializes SYSTEM activity as readable product history, not a gated incoming message', async () => {
    const actor = await makeProfile('activity-readable')
    const target = await makeProfile('activity-readable-target')
    await activity.recordProfileLiked(actor.profile!.id, target.profile!, 'swipe-readable-test')

    const inbox = await messaging.listConversations(actor.id, actor.profile!.id, {})
    const system = inbox.data.find((c: any) => c.type === 'SYSTEM')
    expect(system).toBeTruthy()
    expect(system!.lastMessageBody).toBe(`You liked ${target.profile!.displayName}`)
    expect(system!.hasUnread).toBe(false)

    const history = await messaging.listMessages(actor.id, actor.profile!.id, system!.id, {})
    expect(history.data[0]!.locked).toBe(false)
    expect(history.data[0]!.body).toBe(`You liked ${target.profile!.displayName}`)
    expect(history.data[0]!.attachments).toMatchObject({ eventType: 'PROFILE_LIKED' })
  })

  it('advances the SYSTEM conversation activity clock when a new event is appended', async () => {
    const actor = await makeProfile('activity-clock')
    const targetA = await makeProfile('activity-clock-a')
    const targetB = await makeProfile('activity-clock-b')

    await activity.recordProfileLiked(actor.profile!.id, targetA.profile!, 'swipe-clock-a')
    const first = await db.conversation.findFirstOrThrow({
      where: { type: 'SYSTEM', participants: { some: { profileId: actor.profile!.id } } },
    })

    // Make the assertion deterministic even on databases whose timestamps only
    // expose millisecond precision.
    await db.conversation.update({ where: { id: first.id }, data: { updatedAt: new Date('2000-01-01T00:00:00.000Z') } })
    await activity.recordProfileLiked(actor.profile!.id, targetB.profile!, 'swipe-clock-b')

    const second = await db.conversation.findUniqueOrThrow({ where: { id: first.id } })
    expect(second.updatedAt.getTime()).toBeGreaterThan(new Date('2000-01-01T00:00:00.000Z').getTime())
    expect(await db.message.count({ where: { conversationId: first.id } })).toBe(2)
  })

  it('stores completed-list activity with a reusable ListBuilder deep link', async () => {
    const actor = await makeProfile('activity-list')
    await activity.recordListCompleted(actor.profile!.id, {
      id: 'category-test-id',
      slug: 'favorite-test-things',
      shortLabel: 'Favorite Test Things',
      orderingMode: 'RANKED',
    })

    const message = await db.message.findFirstOrThrow({
      where: {
        conversation: { type: 'SYSTEM', participants: { some: { profileId: actor.profile!.id } } },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(message.body).toBe('You ranked Favorite Test Things')
    expect(message.attachments).toMatchObject({
      eventType: 'LIST_COMPLETED',
      categorySlug: 'favorite-test-things',
      cta: {
        label: 'View answers',
        route: 'ListBuilder',
        params: { categorySlug: 'favorite-test-things', shortLabel: 'Favorite Test Things' },
      },
    })
  })
})