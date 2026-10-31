import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db, publishCategoryRanking, LIST_SCORE_SET, refreshPendingCategoryRankings } from '@project/db'
import { RankingsService } from '../services/RankingsService'
import { ListService } from '../services/ListService'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import openapiGlue from 'fastify-openapi-glue'
import { resolve } from 'path'
import * as handlers from '../handlers'
import * as security from '../plugins/security'

// Real MariaDB: exercise commits, outbox coalescing, row locks and publication.
describe('versioned category publication', () => {
  const slug = `published-results-${Date.now()}`
  const rankings = new RankingsService()
  const lists = new ListService()
  const userIds: string[] = []
  const profiles: string[] = []
  let categoryId: string
  let groupId: string
  let typeId: string
  let first: string
  let second: string
  const vote = (entityId: string) => ({ items: [{ entityId, rank: 1 }], isComplete: true })
  const detail = () => rankings.getCategoryRankings(profiles[0]!, slug)

  beforeAll(async () => {
    vi.stubEnv('RANKINGS_MIN_TAKES', '3')
    typeId = (await db.entityType.create({ data: { slug, label: 'Publication', pluralLabel: 'Publications' } })).id
    groupId = (await db.categoryGroup.create({ data: { slug, label: 'Publication' } })).id
    categoryId = (await db.category.create({ data: { slug, groupId, entityTypeId: typeId, prompt: 'Pick', shortLabel: 'Publication', maxItems: 5, orderingMode: 'RANKED' } })).id
    first = (await db.entity.create({ data: { slug: `${slug}-a`, entityTypeId: typeId, canonicalName: 'A', status: 'APPROVED' } })).id
    second = (await db.entity.create({ data: { slug: `${slug}-b`, entityTypeId: typeId, canonicalName: 'B', status: 'APPROVED' } })).id
    await db.categoryEntity.createMany({ data: [first, second].map(entityId => ({ categoryId, entityId })) })
    for (let i = 0; i < 3; i++) {
      const user = await db.user.create({ data: { email: `${slug}-${i}@example.com`, profile: { create: { username: `${slug}-${i}`, displayName: 'Publication', birthdate: new Date('1990-01-01') } } }, include: { profile: true } })
      userIds.push(user.id)
      profiles.push(user.profile!.id)
    }
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    if (categoryId) {
      await db.jobQueue.deleteMany({ where: { OR: [
        { payload: { path: '$.categoryId', equals: categoryId } },
        ...profiles.map(profileId => ({ payload: { path: '$.profileId', equals: profileId } })),
      ] } })
      await db.resultSet.deleteMany({ where: { ...LIST_SCORE_SET, scopeValue: categoryId } })
      await db.list.deleteMany({ where: { categoryId } })
      await db.category.delete({ where: { id: categoryId } })
    }
    if (typeId) {
      await db.entity.deleteMany({ where: { entityTypeId: typeId } })
      await db.entityType.delete({ where: { id: typeId } })
    }
    if (groupId) await db.categoryGroup.delete({ where: { id: groupId } })
    // System conversations have no FK owner; remove the test-only threads too.
    await db.conversation.deleteMany({ where: { type: 'SYSTEM', participants: { some: { profileId: { in: profiles } } } } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  })

  it('commits the answer, revision and durable request together', async () => {
    const saved = await lists.upsertMyList(profiles[0]!, slug, vote(first))
    expect(saved.answerRevision).toBe(1)
    expect(await db.categoryRankingRefresh.count({ where: { categoryId } })).toBe(1)
    expect(await detail()).toMatchObject({ answerRevision: 1, resultsRevision: 0, isUpdating: true, isPublished: false })
  })

  it('publishes the first vote on detail, feed and previews, separately from featuring', async () => {
    const start = Date.now()
    await publishCategoryRanking(categoryId, true)
    expect(Date.now() - start).toBeLessThan(3000)
    const result = await detail()
    expect(result).toMatchObject({ answerRevision: 1, resultsRevision: 1, isUpdating: false, isPublished: true, isFeatureEligible: false, takeCount: 1 })
    expect(result.entries[0]).toMatchObject({ rank: 1, score: 5, pickCount: 1, pickPercent: 100, entity: { id: first } })
    expect(result.category).toMatchObject({ popularityCount: 1, rankingRevision: 1, topPick: { id: first } })
    const feed = await rankings.getRankingsFeed(profiles[0]!, { groupSlugs: [slug] })
    const preview = (feed.data as any[]).find(m => m.id === `rankings-top-${slug}`)
    expect(preview.context.takeCount).toBe(1)
    expect(preview.items[0]).toMatchObject({ rank: 1, entity: { id: first }, subtitle: '100% picked it' })
    expect(await db.categoryRankingRefresh.count({ where: { categoryId } })).toBe(0)
  })

  it('coalesces repeated edits and publishes only the latest contribution', async () => {
    await lists.upsertMyList(profiles[0]!, slug, { items: [{ entityId: first, rank: 1 }, { entityId: second, rank: 2 }], isComplete: true })
    const saved = await lists.upsertMyList(profiles[0]!, slug, vote(second))
    expect(saved.answerRevision).toBe(3)
    expect(await db.categoryRankingRefresh.count({ where: { categoryId } })).toBe(1)
    const stale = await detail()
    expect(stale).toMatchObject({ answerRevision: 3, resultsRevision: 1, isUpdating: true })
    expect(stale.entries[0]?.entity.id).toBe(first)
    await publishCategoryRanking(categoryId, true)
    const result = await detail()
    expect(result).toMatchObject({ resultsRevision: 3, takeCount: 1, isUpdating: false })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({ score: 5, entity: { id: second } })
    // A duplicate/late worker observes an already-consumed request.
    expect(await publishCategoryRanking(categoryId, true)).toBeNull()
  })

  it('publishes removal of the last vote as an acknowledged empty snapshot', async () => {
    const saved = await lists.upsertMyList(profiles[0]!, slug, { items: [], isComplete: true })
    expect(saved.isComplete).toBe(false)
    await publishCategoryRanking(categoryId, true)
    expect(await detail()).toMatchObject({ resultsRevision: saved.answerRevision, isUpdating: false, isPublished: false, takeCount: 0, entries: [], category: { popularityCount: 0, topPick: null } })
  })

  it('rolls back the revision and outbox when a vote transaction fails', async () => {
    const before = await detail()
    await expect(lists.upsertMyList('nonexistent-profile', slug, vote(first))).rejects.toThrow()
    expect((await detail()).answerRevision).toBe(before.answerRevision)
    expect(await db.categoryRankingRefresh.count({ where: { categoryId } })).toBe(0)
  })

  it('concurrent publishers and a new vote cannot regress the snapshot', async () => {
    await lists.upsertMyList(profiles[0]!, slug, vote(first))
    const [, saved] = await Promise.all([
      publishCategoryRanking(categoryId, true),
      lists.upsertMyList(profiles[1]!, slug, vote(second)),
      publishCategoryRanking(categoryId, true),
    ])
    await publishCategoryRanking(categoryId, true)
    const result = await detail()
    expect(result).toMatchObject({ resultsRevision: saved.answerRevision, answerRevision: saved.answerRevision, isUpdating: false, takeCount: 2 })
    expect(result.entries.map(e => e.score)).toEqual([5, 5])
    expect(result.entries.map(e => e.pickCount)).toEqual([1, 1])
  })

  it('reconciliation repairs bypass writes with the same publisher', async () => {
    await db.user.update({ where: { id: userIds[1]! }, data: { suspendedAt: new Date() } })
    await publishCategoryRanking(categoryId)
    expect(await detail()).toMatchObject({ isUpdating: false, takeCount: 1, entries: [{ entity: { id: first }, score: 5 }] })
  })
  it('retains failed work and wakes it immediately when another vote arrives', async () => {
    await lists.upsertMyList(profiles[0]!, slug, vote(second))
    const pending = await db.categoryRankingRefresh.findUniqueOrThrow({ where: { categoryId } })
    const select = vi.spyOn(db.categoryRankingRefresh, 'findMany').mockResolvedValueOnce([pending])
    const transaction = vi.spyOn(db, '$transaction').mockRejectedValueOnce(new Error('temporary database outage'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { await refreshPendingCategoryRankings() }
    finally { select.mockRestore(); transaction.mockRestore(); log.mockRestore() }
    const failed = await db.categoryRankingRefresh.findUniqueOrThrow({ where: { categoryId } })
    expect(failed).toMatchObject({ attempts: 1, lastError: 'temporary database outage' })
    expect(failed.availableAt.getTime()).toBeGreaterThan(pending.availableAt.getTime())
    expect((await detail()).isUpdating).toBe(true)
    await lists.upsertMyList(profiles[0]!, slug, vote(first))
    expect(await db.categoryRankingRefresh.findUniqueOrThrow({ where: { categoryId } })).toMatchObject({ attempts: 0, lastError: null })
    await publishCategoryRanking(categoryId, true)
    expect((await detail()).isUpdating).toBe(false)
  })

  it('returns revisions and publication state through real HTTP serialization', async () => {
    const token = `${slug}-token`
    await db.session.create({ data: { userId: userIds[0]!, token, expiresAt: new Date(Date.now() + 60000) } })
    const app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(openapiGlue, {
      specification: resolve(__dirname, '../../../../packages/api-spec/openapi.yaml'),
      service: handlers, securityHandlers: security, noAdditional: true,
    } as any)
    const headers = { authorization: `Bearer ${token}` }
    try {
      const save = await app.inject({ method: 'PUT', url: `/lists/${slug}`, headers, payload: vote(second) })
      expect(save.statusCode, save.body).toBe(200)
      const target = save.json().data.answerRevision
      expect(target).toBeGreaterThan(0)
      const before = await app.inject({ method: 'GET', url: `/categories/${slug}/rankings`, headers })
      expect(before.json().data).toMatchObject({ answerRevision: target, isUpdating: true })
      await publishCategoryRanking(categoryId, true)
      const after = await app.inject({ method: 'GET', url: `/categories/${slug}/rankings`, headers })
      expect(after.json().data).toMatchObject({ answerRevision: target, resultsRevision: target, isUpdating: false, isPublished: true, isFeatureEligible: false })
      expect(after.json().data.category.rankingRevision).toBe(target)
    } finally { await app.close() }
  })

})
