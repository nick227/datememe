import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@project/db'
import { ContentFeedService } from '../services/ContentFeedService'
import { QuickPickService } from '../services/QuickPickService'

/**
 * ContentFeedService coverage for the two things this session's work
 * actually touched: the winnerId-based taste-graph join (getDiscoverFeed's
 * "similar-taste" rail + getTasteGraphEntityIds — both previously broken by
 * a QuickPickSignal schema change that renamed winnerEntityId to winnerId),
 * and real termination/no-duplication for both infinite feeds.
 */
describe('ContentFeedService', () => {
  const feedService = new ContentFeedService()
  const createdUserIds: string[] = []
  const createdScoreIds: string[] = []

  async function makeProfile(label: string) {
    const now = Date.now() + Math.random()
    const user = await db.user.create({
      data: {
        email: `feed-${label}-${now}@example.com`,
        passwordHash: 'hash',
        profile: { create: { username: `feed-${label}-${now}`, displayName: label, birthdate: new Date('1993-01-01T00:00:00.000Z') } },
      },
      include: { profile: true },
    })
    createdUserIds.push(user.id)
    return user
  }

  async function linkScore(profileIdA: string, profileIdB: string, score = 50) {
    const row = await db.compatibilityScore.create({
      data: { profileIdA, profileIdB, score, sharedItemsCount: 0, sharedFavorites: [], insights: [] },
    })
    createdScoreIds.push(row.id)
  }

  describe('taste graph (winnerId)', () => {
    let entityType: any
    let entityA: any
    let entityB: any
    let entityC: any
    let group: any
    let category: any
    let viewerUser: any
    let candidateUser: any

    beforeAll(async () => {
      const now = Date.now()
      entityType = await db.entityType.create({ data: { slug: `feed-type-${now}`, label: 'Feed Type', pluralLabel: 'Feed Types' } })
      entityA = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Feed Entity A', slug: `feed-entity-a-${now}`, status: 'APPROVED' } })
      entityB = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Feed Entity B', slug: `feed-entity-b-${now}`, status: 'APPROVED' } })
      entityC = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Feed Entity C', slug: `feed-entity-c-${now}`, status: 'APPROVED' } })
      group = await db.categoryGroup.create({ data: { slug: `feed-group-${now}`, label: 'Feed Group' } })
      category = await db.category.create({
        data: { groupId: group.id, entityTypeId: entityType.id, slug: `feed-category-${now}`, prompt: 'p', shortLabel: 's', isActive: true },
      })

      viewerUser = await makeProfile('viewer')
      candidateUser = await makeProfile('candidate')

      // Viewer and candidate both *win* entityA, but against different
      // losers (B vs C) — this is deliberate: a fixture where winner and
      // loser always matched together (e.g. both "A beats B") would still
      // "work" even if the join were wrongly keyed on loserId instead of
      // winnerId, since the shared value would coincidentally be identical
      // either way. Divergent losers make winnerId the *only* field under
      // which these two share anything, so this actually tests the
      // `winnerId`-keyed join (the exact thing the schema rename broke),
      // not just that a join of some kind exists.
      await QuickPickService.submitChoice(viewerUser.profile!.id, 'CATEGORY', category.id, entityA.id, entityB.id)
      await QuickPickService.submitChoice(candidateUser.profile!.id, 'CATEGORY', category.id, entityA.id, entityC.id)
      await linkScore(viewerUser.profile!.id, candidateUser.profile!.id, 80)
    })

    afterAll(async () => {
      await db.quickPickSignal.deleteMany({ where: { contextId: category.id } })
      await db.category.delete({ where: { id: category.id } })
      await db.categoryGroup.delete({ where: { id: group.id } })
      await db.entity.deleteMany({ where: { id: { in: [entityA.id, entityB.id, entityC.id] } } })
      await db.entityType.delete({ where: { id: entityType.id } })
    })

    it('surfaces a candidate who shares a Quick-Picks-won entity with the viewer in a "similar-taste" rail', async () => {
      const result = await feedService.getDiscoverFeed(viewerUser.id, viewerUser.profile!.id, { limit: 20 })
      const similarTasteModule = result.data.find((m: any) => m.id.startsWith('similar-taste'))
      expect(similarTasteModule).toBeTruthy()
      const ids = similarTasteModule.items.map((i: any) => i.id)
      expect(ids).toContain(candidateUser.profile!.id)
      const filtered = await feedService.getDiscoverFeed(viewerUser.id, viewerUser.profile!.id, { groupSlugs: ['does-not-exist'] })
      expect(filtered.data.some((m: any) => m.id.startsWith('people-grid'))).toBe(false)
      const near = await feedService.getDiscoverFeed(viewerUser.id, viewerUser.profile!.id, { nearMe: true })
      expect(near.filterNotice).toContain('Add your location')
    })
  })

  describe('infinite feed termination', () => {
    it('getListsFeed paginates through every real category-group beat exactly once and terminates', async () => {
      const viewerUser = await makeProfile('lists-pager')
      const seenIds: string[] = []
      const categoryIds: string[] = []
      let cursor: string | undefined
      let iterations = 0
      while (true) {
        const page: any = await feedService.getListsFeed(viewerUser.profile!.id, { cursor, limit: 4 })
        seenIds.push(...page.data.map((m: any) => m.id))
        // Site Picks modules (id 'site-picks-*') deliberately re-surface
        // categories that also appear in their normal topic-group module —
        // same category, reused rather than duplicated, per
        // ContentFeedService.getListsFeed's Site Picks section — so they're
        // excluded here just like 'your-lists' already is.
        categoryIds.push(...page.data.filter((m: any) => m.type === 'lists' && m.id !== 'your-lists' && !m.id.startsWith('site-picks-')).flatMap((m: any) => m.items.map((i: any) => i.id)))
        if (!page.meta.hasMore) break
        cursor = page.meta.nextCursor
        iterations++
        if (iterations > 50) throw new Error('getListsFeed did not terminate within 50 pages')
      }
      const dupes = seenIds.filter((id, i) => seenIds.indexOf(id) !== i)
      expect(dupes).toEqual([])
      expect(seenIds.length).toBeGreaterThan(0)
      const active = await db.category.findMany({ where: { isActive: true }, select: { slug: true } })
      expect(categoryIds.sort()).toEqual(active.map((c) => c.slug).sort())
    })

    it('getDiscoverFeed never repeats a candidate in the people-grid backbone across pages, and terminates', async () => {
      const viewerUser = await makeProfile('discover-pager')
      const candidates = await Promise.all([0, 1, 2, 3, 4].map((i) => makeProfile(`discover-pager-candidate-${i}`)))
      await Promise.all(candidates.map((c, i) => linkScore(viewerUser.profile!.id, c.profile!.id, 90 - i)))

      const gridIdsPerPage: string[][] = []
      const moduleIds: string[] = []
      let cursor: string | undefined
      let iterations = 0
      while (true) {
        const page: any = await feedService.getDiscoverFeed(viewerUser.id, viewerUser.profile!.id, { cursor, limit: 2 })
        moduleIds.push(...page.data.map((m: any) => m.id))
        const gridModule = page.data.find((m: any) => m.id.startsWith('people-grid'))
        gridIdsPerPage.push((gridModule?.items ?? []).map((i: any) => i.id))
        if (!page.meta.hasMore) break
        cursor = page.meta.nextCursor
        iterations++
        if (iterations > 50) throw new Error('getDiscoverFeed did not terminate within 50 pages')
      }
      const flat = gridIdsPerPage.flat()
      const dupes = flat.filter((id, i) => flat.indexOf(id) !== i)
      expect(dupes).toEqual([])
      expect(flat.length).toBe(candidates.length)
      expect(new Set(moduleIds).size).toBe(moduleIds.length)
    })
  })

  afterAll(async () => {
    await db.compatibilityScore.deleteMany({ where: { id: { in: createdScoreIds } } })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })
})
