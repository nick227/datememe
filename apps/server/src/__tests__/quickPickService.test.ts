import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@project/db'
import { QuickPickService } from '../services/QuickPickService'

/**
 * QuickPickService tests generic
 * QuickPickSignal schema (contextType/contextId/entity1Id/entity2Id/
 * winnerId/loserId, no unique constraint — a `findFirst`-then-`create`
 * replaces the old upsert keyed on a now-deleted
 * profileId_categoryId_winnerEntityId_loserEntityId constraint). These tests
 * pin the new persistence shape and behavior directly against the real DB,
 * so a regression back to the old flat fields (categoryId, winnerEntityId,
 * loserEntityId) or back to `upsert` fails loudly rather than silently.
 */
describe('QuickPickService — new QuickPickSignal schema', () => {
  let entityType: any
  let entityA: any
  let entityB: any
  let group: any
  let category: any
  let viewerProfile: any
  let otherProfileA: any
  let otherProfileB: any
  const createdUserIds: string[] = []

  async function makeProfile(label: string) {
    const now = Date.now() + Math.random()
    const user = await db.user.create({
      data: {
        email: `qp-${label}-${now}@example.com`,
        passwordHash: 'hash',
        profile: { create: { username: `qp-${label}-${now}`, displayName: label, birthdate: new Date('1992-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    createdUserIds.push(user.id)
    return user.profile!
  }

  beforeAll(async () => {
    const now = Date.now()
    entityType = await db.entityType.create({
      data: { slug: `qp-type-${now}`, label: 'QP Type', pluralLabel: 'QP Types' },
    })
    entityA = await db.entity.create({
      data: { entityTypeId: entityType.id, canonicalName: 'Entity A', slug: `qp-entity-a-${now}`, status: 'APPROVED' },
    })
    entityB = await db.entity.create({
      data: { entityTypeId: entityType.id, canonicalName: 'Entity B', slug: `qp-entity-b-${now}`, status: 'APPROVED' },
    })
    group = await db.categoryGroup.create({ data: { slug: `qp-group-${now}`, label: 'QP Group' } })
    category = await db.category.create({
      data: {
        groupId: group.id,
        entityTypeId: entityType.id,
        slug: `qp-category-${now}`,
        prompt: 'Which do you prefer?',
        shortLabel: 'QP Category',
        isActive: true,
      },
    })

    viewerProfile = await makeProfile('viewer')
    otherProfileA = await makeProfile('other-a')
    otherProfileB = await makeProfile('other-b')
  })

  afterAll(async () => {
    await db.quickPickSignal.deleteMany({ where: { contextId: category.id } })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
    await db.category.delete({ where: { id: category.id } })
    await db.categoryGroup.delete({ where: { id: group.id } })
    await db.entity.deleteMany({ where: { id: { in: [entityA.id, entityB.id] } } })
    await db.entityType.delete({ where: { id: entityType.id } })
  })

  it('persists a submitted choice using the generic contextType/contextId/entity1Id/entity2Id/winnerId/loserId shape', async () => {
    await QuickPickService.submitChoice(viewerProfile.id, 'CATEGORY', category.id, entityA.id, entityB.id)

    const row = await db.quickPickSignal.findFirst({ where: { profileId: viewerProfile.id, contextId: category.id } })
    expect(row).toBeTruthy()
    expect(row!.contextType).toBe('CATEGORY')
    expect(row!.contextId).toBe(category.id)
    expect(row!.winnerId).toBe(entityA.id)
    expect(row!.loserId).toBe(entityB.id)
    // entity1Id/entity2Id are the canonical (order-independent) pair identity,
    // sorted lexicographically — not "winner first".
    const [expected1, expected2] = [entityA.id, entityB.id].sort()
    expect(row!.entity1Id).toBe(expected1)
    expect(row!.entity2Id).toBe(expected2)
  })

  it('does not duplicate a row when the same viewer resubmits the same pair (no unique constraint — findFirst-then-create)', async () => {
    const before = await db.quickPickSignal.count({ where: { profileId: otherProfileA.id, contextId: category.id } })
    expect(before).toBe(0)

    await QuickPickService.submitChoice(otherProfileA.id, 'CATEGORY', category.id, entityA.id, entityB.id)
    await QuickPickService.submitChoice(otherProfileA.id, 'CATEGORY', category.id, entityA.id, entityB.id)
    // A resubmission of the *same pair* with the opposite winner is still the
    // same (profile, context, pair) identity — findFirst matches on pair
    // identity, not on who won, so this also must not create a second row.
    await QuickPickService.submitChoice(otherProfileA.id, 'CATEGORY', category.id, entityB.id, entityA.id)

    const after = await db.quickPickSignal.count({ where: { profileId: otherProfileA.id, contextId: category.id } })
    expect(after).toBe(1)
  })

  it('rejects a submission where winner and loser are the same entity', async () => {
    await expect(QuickPickService.submitChoice(viewerProfile.id, 'CATEGORY', category.id, entityA.id, entityA.id)).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('computes winner/loser split and overall win rate across multiple profiles voting the same pair', async () => {
    // viewerProfile and otherProfileA already voted A over B (from earlier
    // tests); add a vote for B to make the split non-trivial.
    const result = await QuickPickService.submitChoice(otherProfileB.id, 'CATEGORY', category.id, entityB.id, entityA.id)

    expect(result.totalComparisons).toBeGreaterThanOrEqual(3)
    expect(result.winnerPercent + result.loserPercent).toBe(100)
    expect(result.winnerOverallWinRate).not.toBeNull()
    expect(result.loserOverallWinRate).not.toBeNull()
  })
})
