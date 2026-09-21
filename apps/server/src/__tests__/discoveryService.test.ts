import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@project/db'
import { DiscoveryService } from '../services/DiscoveryService'
import { ageRangeForPreference, haversineKm } from '../lib/geo'
import { DISCOVERY_POLICY } from '../lib/discoveryPolicy'

/**
 * DiscoveryService boundary/eligibility coverage. Each describe block uses
 * its own fresh viewer + candidates (real DB rows, real CompatibilityScore
 * rows — DiscoveryService's candidate pool starts from CompatibilityScore,
 * not a raw Profile scan) so tests never see each other's fixtures via score
 * ordering/pagination.
 */
describe('DiscoveryService', () => {
  const service = new DiscoveryService()
  const createdUserIds: string[] = []
  const createdScoreIds: string[] = []

  async function makeProfile(opts: {
    label: string
    birthdate?: Date
    genderIdentity?: string
    seeking?: string[]
    locationLat?: number | null
    locationLng?: number | null
    preferredMinAge?: number
    preferredMaxAge?: number
    isDiscoverable?: boolean
  }) {
    const now = Date.now() + Math.random()
    const user = await db.user.create({
      data: {
        email: `disco-${opts.label}-${now}@example.com`,
        passwordHash: 'hash',
        profile: {
          create: {
            username: `disco-${opts.label}-${now}`,
            displayName: opts.label,
            birthdate: opts.birthdate ?? new Date('1995-01-01T00:00:00.000Z'),
            genderIdentity: opts.genderIdentity,
            locationLat: opts.locationLat,
            locationLng: opts.locationLng,
            preferredMinAge: opts.preferredMinAge ?? 18,
            preferredMaxAge: opts.preferredMaxAge ?? 99,
            isDiscoverable: opts.isDiscoverable ?? true,
            seekingGenders: opts.seeking ? { create: opts.seeking.map((gender) => ({ gender })) } : undefined,
          },
        },
      },
      include: { profile: true },
    })
    createdUserIds.push(user.id)
    return { user, profile: user.profile! }
  }

  async function linkScore(profileIdA: string, profileIdB: string, score = 50) {
    const row = await db.compatibilityScore.create({
      data: { profileIdA, profileIdB, score, sharedItemsCount: 0, sharedFavorites: [], insights: [] },
    })
    createdScoreIds.push(row.id)
    return row
  }

  afterAll(async () => {
    await db.compatibilityScore.deleteMany({ where: { id: { in: createdScoreIds } } })
    await db.session.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.profileSeekingGender.deleteMany({ where: { profile: { userId: { in: createdUserIds } } } })
    await db.profile.deleteMany({ where: { userId: { in: createdUserIds } } })
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } })
  })

  describe('age eligibility boundaries', () => {
    it('includes candidates exactly at the min/max age boundary and excludes those one day outside it', async () => {
      const { user: viewerUser, profile: viewer } = await makeProfile({
        label: 'age-viewer',
        preferredMinAge: 25,
        preferredMaxAge: 35,
      })
      // Same range the service itself will compute — deriving fixtures from
      // the real function under real "now" avoids off-by-one drift between
      // test setup and the code being tested.
      const { gte: oldestAllowedBirthdate, lte: youngestAllowedBirthdate } = ageRangeForPreference(25, 35)

      const atYoungBoundary = await makeProfile({ label: 'age-at-young-boundary', birthdate: youngestAllowedBirthdate, genderIdentity: 'FEMALE' })
      const justTooYoung = await makeProfile({
        label: 'age-too-young',
        birthdate: new Date(youngestAllowedBirthdate.getTime() + 24 * 60 * 60 * 1000),
        genderIdentity: 'FEMALE',
      })
      const atOldBoundary = await makeProfile({ label: 'age-at-old-boundary', birthdate: oldestAllowedBirthdate, genderIdentity: 'FEMALE' })
      const justTooOld = await makeProfile({
        label: 'age-too-old',
        birthdate: new Date(oldestAllowedBirthdate.getTime() - 24 * 60 * 60 * 1000),
        genderIdentity: 'FEMALE',
      })

      for (const c of [atYoungBoundary, atOldBoundary, justTooYoung, justTooOld]) {
        await linkScore(viewer.id, c.profile.id)
      }

      const result = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20 })
      const ids = result.data.map((d: any) => d.profile.id)

      expect(ids).toContain(atYoungBoundary.profile.id)
      expect(ids).toContain(atOldBoundary.profile.id)
      expect(ids).not.toContain(justTooYoung.profile.id)
      expect(ids).not.toContain(justTooOld.profile.id)
    })
  })

  describe('near me / distance', () => {
    it('includes a candidate exactly at the configured radius and excludes one clearly beyond it; is honest (empty + notice) with no viewer location', async () => {
      const viewerLat = 40
      const viewerLng = -74
      const radiusKm = DISCOVERY_POLICY.nearMeRadiusKm
      // Pure-latitude offset reduces haversine's great-circle formula to a
      // `distance = R * dLat(radians)` relationship — but reconstructing it
      // forward through degrees/radians accumulates float noise on the order
      // of 1e-13 km, occasionally landing a hair *above* the target distance.
      // The service's own filter is a strict `<=` with no tolerance, so an
      // "exact" boundary point is float-noise-flaky; sit fractionally inside
      // the radius instead — still a real boundary test (well within one
      // meter of the configured limit), just not bit-exact.
      function latAtDistanceKm(km: number) {
        return viewerLat + (km / 6371) * (180 / Math.PI)
      }
      const atRadiusLat = latAtDistanceKm(radiusKm - 0.0001)
      const beyondRadiusLat = latAtDistanceKm(radiusKm + 5)

      // Sanity-check our own fixture math against the exact function the
      // service uses, so a future change to haversineKm's constants can't
      // silently invert what this test is actually asserting.
      expect(haversineKm(viewerLat, viewerLng, atRadiusLat, viewerLng)).toBeLessThan(radiusKm)
      expect(haversineKm(viewerLat, viewerLng, beyondRadiusLat, viewerLng)).toBeGreaterThan(radiusKm)

      const { user: viewerUser, profile: viewer } = await makeProfile({ label: 'near-viewer', locationLat: viewerLat, locationLng: viewerLng })
      const atRadius = await makeProfile({ label: 'near-at-radius', genderIdentity: 'FEMALE', locationLat: atRadiusLat, locationLng: viewerLng })
      const beyondRadius = await makeProfile({ label: 'near-beyond-radius', genderIdentity: 'FEMALE', locationLat: beyondRadiusLat, locationLng: viewerLng })
      await linkScore(viewer.id, atRadius.profile.id)
      await linkScore(viewer.id, beyondRadius.profile.id)

      const result = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20, nearMe: true })
      const ids = result.data.map((d: any) => d.profile.id)
      expect(ids).toContain(atRadius.profile.id)
      expect(ids).not.toContain(beyondRadius.profile.id)
      expect(result.filterNotice).toBeUndefined()

      // A viewer with no location gets an honest empty result — never a
      // silent fallback to "All" — plus a notice explaining why.
      const { user: noLocUser, profile: noLocViewer } = await makeProfile({ label: 'near-no-location' })
      await linkScore(noLocViewer.id, atRadius.profile.id)
      const emptyResult = await service.getDiscoveryFeed(noLocUser.id, noLocViewer.id, { limit: 20, nearMe: true })
      expect(emptyResult.data).toEqual([])
      expect(emptyResult.filterNotice).toBeTruthy()
    })
  })

  describe('mutual gender compatibility', () => {
    it('only includes candidates whose orientation is mutual with the viewer, not just one-directional', async () => {
      const { user: viewerUser, profile: viewer } = await makeProfile({
        label: 'gender-viewer',
        genderIdentity: 'MALE',
        seeking: ['FEMALE'],
      })
      const mutualMatch = await makeProfile({ label: 'gender-mutual', genderIdentity: 'FEMALE', seeking: ['MALE'] })
      // Viewer would show up in *her* seeking list (MALE), but she's not in
      // *his* — orientation must be mutual, not just "viewer likes their gender".
      const oneDirectionalOnly = await makeProfile({ label: 'gender-one-directional', genderIdentity: 'FEMALE', seeking: ['FEMALE'] })

      await linkScore(viewer.id, mutualMatch.profile.id)
      await linkScore(viewer.id, oneDirectionalOnly.profile.id)

      const result = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20 })
      const ids = result.data.map((d: any) => d.profile.id)
      expect(ids).toContain(mutualMatch.profile.id)
      expect(ids).not.toContain(oneDirectionalOnly.profile.id)
    })
  })

  describe('taxonomy engagement (taste facet)', () => {
    it('includes only candidates with real List engagement in the requested group, excluding unrelated candidates', async () => {
      const now = Date.now()
      const entityType = await db.entityType.create({ data: { slug: `disco-type-${now}`, label: 'Disco Type', pluralLabel: 'Disco Types' } })
      const entity = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Disco Entity', slug: `disco-entity-${now}`, status: 'APPROVED' } })
      const group = await db.categoryGroup.create({ data: { slug: `disco-taste-group-${now}`, label: 'Disco Taste Group' } })
      const category = await db.category.create({
        data: { groupId: group.id, entityTypeId: entityType.id, slug: `disco-taste-category-${now}`, prompt: 'p', shortLabel: 's', isActive: true },
      })

      const { user: viewerUser, profile: viewer } = await makeProfile({ label: 'taste-viewer' })
      const engaged = await makeProfile({ label: 'taste-engaged', genderIdentity: 'FEMALE' })
      const unengaged = await makeProfile({ label: 'taste-unengaged', genderIdentity: 'FEMALE' })

      const list = await db.list.create({ data: { profileId: engaged.profile.id, categoryId: category.id } })
      await db.listItem.create({ data: { listId: list.id, entityId: entity.id, rank: 1 } })

      await linkScore(viewer.id, engaged.profile.id)
      await linkScore(viewer.id, unengaged.profile.id)

      const result = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20, taste: `group:${group.slug}` })
      const ids = result.data.map((d: any) => d.profile.id)
      expect(ids).toContain(engaged.profile.id)
      expect(ids).not.toContain(unengaged.profile.id)

      // Zero-result state: a taste facet nobody has engaged with short-circuits
      // to an honest empty page rather than falling back to "no filter".
      const emptyGroup = await db.categoryGroup.create({ data: { slug: `disco-empty-group-${now}`, label: 'Empty Group' } })
      const zeroResult = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20, taste: `group:${emptyGroup.slug}` })
      expect(zeroResult).toEqual({ data: [], meta: { hasMore: false, nextCursor: null } })

      await db.listItem.deleteMany({ where: { listId: list.id } })
      await db.list.delete({ where: { id: list.id } })
      await db.category.delete({ where: { id: category.id } })
      await db.categoryGroup.deleteMany({ where: { id: { in: [group.id, emptyGroup.id] } } })
      await db.entity.delete({ where: { id: entity.id } })
      await db.entityType.delete({ where: { id: entityType.id } })
    })
  })

  describe('pagination under filters', () => {
    it('fills pages past ineligible scores and does not skip unseen people after a swipe', async () => {
      const { user, profile: viewer } = await makeProfile({ label: 'changing-pool' })
      const hidden = await makeProfile({ label: 'hidden', isDiscoverable: false })
      await linkScore(viewer.id, hidden.profile.id, 100)
      const people = await Promise.all([0, 1, 2, 3, 4].map((i) => makeProfile({ label: `tied-${i}` })))
      for (const person of people) await linkScore(viewer.id, person.profile.id, 80)
      const first = await service.getDiscoveryFeed(user.id, viewer.id, { limit: 2 })
      expect(first.data).toHaveLength(2)
      await db.swipe.create({ data: { actorProfileId: viewer.id, targetProfileId: first.data[0]!.profile.id, action: 'PASS' } })
      const seen = first.data.map((p) => p.profile.id)
      let cursor = first.meta.nextCursor
      while (cursor) {
        const page = await service.getDiscoveryFeed(user.id, viewer.id, { limit: 2, cursor })
        seen.push(...page.data.map((p) => p.profile.id))
        cursor = page.meta.nextCursor
      }
      expect(seen.sort()).toEqual(people.map((p) => p.profile.id).sort())
      await db.swipe.deleteMany({ where: { actorProfileId: viewer.id } })
    })

    it('paginates a filtered pool correctly and terminates once exhausted', async () => {
      const { user: viewerUser, profile: viewer } = await makeProfile({ label: 'page-viewer' })
      const candidates = await Promise.all(
        [0, 1, 2].map((i) => makeProfile({ label: `page-candidate-${i}`, genderIdentity: 'FEMALE' })),
      )
      // Distinct scores so ordering (and therefore paging) is deterministic.
      await Promise.all(candidates.map((c, i) => linkScore(viewer.id, c.profile.id, 90 - i)))

      const page1 = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 2 })
      expect(page1.data).toHaveLength(2)
      expect(page1.meta.hasMore).toBe(true)
      expect(page1.meta.nextCursor).toBeTruthy()

      const page2 = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 2, cursor: page1.meta.nextCursor! })
      expect(page2.data).toHaveLength(1)
      expect(page2.meta.hasMore).toBe(false)
      expect(page2.meta.nextCursor).toBeNull()

      const page1Ids = page1.data.map((d: any) => d.profile.id)
      const page2Ids = page2.data.map((d: any) => d.profile.id)
      expect(page1Ids.filter((id: string) => page2Ids.includes(id))).toHaveLength(0)
    })
  })

  describe('filter composability', () => {
    it('applies nearMe + taste + ageBucket together, not just whichever one the UI currently exposes as a chip', async () => {
      // The chip bar is single-select today, but DiscoveryFilters and this
      // service take all three independently — nothing about the query
      // shape assumes only one filter is ever active at a time. A candidate
      // must satisfy *all* active filters, not just the ones a single-select
      // UI happens to be able to express yet.
      const now = Date.now()
      const entityType = await db.entityType.create({ data: { slug: `combo-type-${now}`, label: 'Combo Type', pluralLabel: 'Combo Types' } })
      const entity = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Combo Entity', slug: `combo-entity-${now}`, status: 'APPROVED' } })
      const group = await db.categoryGroup.create({ data: { slug: `combo-group-${now}`, label: 'Combo Group' } })
      const category = await db.category.create({
        data: { groupId: group.id, entityTypeId: entityType.id, slug: `combo-category-${now}`, prompt: 'p', shortLabel: 's', isActive: true },
      })
      async function engage(profileId: string) {
        const list = await db.list.create({ data: { profileId, categoryId: category.id } })
        await db.listItem.create({ data: { listId: list.id, entityId: entity.id, rank: 1 } })
      }

      const viewerLat = 10
      const viewerLng = 10
      const { user: viewerUser, profile: viewer } = await makeProfile({ label: 'combo-viewer', locationLat: viewerLat, locationLng: viewerLng })
      // A birthdate safely inside the '20s' bucket (20-30 years old today) —
      // the viewer's own preferredMinAge/MaxAge stay at the default 18-99,
      // so the age bucket is the only age-related narrowing under test here.
      const in20sBirthdate = new Date(new Date().getFullYear() - 25, 0, 1)

      // Satisfies all three: near, taste-engaged, in their 20s.
      const meetsEverything = await makeProfile({ label: 'combo-all', genderIdentity: 'FEMALE', locationLat: viewerLat, locationLng: viewerLng, birthdate: in20sBirthdate })
      await engage(meetsEverything.profile.id)
      // Near + right age, but never engaged with the taste facet.
      const missingTaste = await makeProfile({ label: 'combo-no-taste', genderIdentity: 'FEMALE', locationLat: viewerLat, locationLng: viewerLng, birthdate: in20sBirthdate })
      // Taste-engaged + right age, but far away.
      const missingLocation = await makeProfile({ label: 'combo-no-location', genderIdentity: 'FEMALE', locationLat: viewerLat + 50, locationLng: viewerLng, birthdate: in20sBirthdate })
      await engage(missingLocation.profile.id)
      // Near + taste-engaged, but outside the 20s bucket.
      const missingAge = await makeProfile({ label: 'combo-wrong-age', genderIdentity: 'FEMALE', locationLat: viewerLat, locationLng: viewerLng, birthdate: new Date(1950, 0, 1) })
      await engage(missingAge.profile.id)

      for (const c of [meetsEverything, missingTaste, missingLocation, missingAge]) {
        await linkScore(viewer.id, c.profile.id)
      }

      const result = await service.getDiscoveryFeed(viewerUser.id, viewer.id, {
        limit: 20,
        nearMe: true,
        taste: `group:${group.slug}`,
        ageBucket: '20s',
      })
      const ids = result.data.map((d: any) => d.profile.id)
      expect(ids).toContain(meetsEverything.profile.id)
      expect(ids).not.toContain(missingTaste.profile.id)
      expect(ids).not.toContain(missingLocation.profile.id)
      expect(ids).not.toContain(missingAge.profile.id)

      await db.listItem.deleteMany({ where: { list: { categoryId: category.id } } })
      await db.list.deleteMany({ where: { categoryId: category.id } })
      await db.category.delete({ where: { id: category.id } })
      await db.categoryGroup.delete({ where: { id: group.id } })
      await db.entity.delete({ where: { id: entity.id } })
      await db.entityType.delete({ where: { id: entityType.id } })
    })

    it('gives independent, freshly-paginated results per filter combination — a filter change is a new query, not a continuation', async () => {
      const { user: viewerUser, profile: viewer } = await makeProfile({ label: 'independence-viewer' })
      const now = Date.now()
      const group = await db.categoryGroup.create({ data: { slug: `indep-group-${now}`, label: 'Indep Group' } })
      const entityType = await db.entityType.create({ data: { slug: `indep-type-${now}`, label: 'Indep Type', pluralLabel: 'Indep Types' } })
      const entity = await db.entity.create({ data: { entityTypeId: entityType.id, canonicalName: 'Indep Entity', slug: `indep-entity-${now}`, status: 'APPROVED' } })
      const category = await db.category.create({
        data: { groupId: group.id, entityTypeId: entityType.id, slug: `indep-category-${now}`, prompt: 'p', shortLabel: 's', isActive: true },
      })

      const engaged = await makeProfile({ label: 'indep-engaged', genderIdentity: 'FEMALE' })
      const unrelated = await makeProfile({ label: 'indep-unrelated', genderIdentity: 'FEMALE' })
      const list = await db.list.create({ data: { profileId: engaged.profile.id, categoryId: category.id } })
      await db.listItem.create({ data: { listId: list.id, entityId: entity.id, rank: 1 } })
      await linkScore(viewer.id, engaged.profile.id, 90)
      await linkScore(viewer.id, unrelated.profile.id, 80)

      // Same viewer, same limit, no cursor — different filter each time.
      // Switching from "All" to a taste chip must re-derive the pool from
      // scratch, not resume mid-list from wherever the unfiltered scan left off.
      const unfiltered = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20 })
      const filtered = await service.getDiscoveryFeed(viewerUser.id, viewer.id, { limit: 20, taste: `group:${group.slug}` })

      expect(unfiltered.data.map((d: any) => d.profile.id).sort()).toEqual([engaged.profile.id, unrelated.profile.id].sort())
      expect(filtered.data.map((d: any) => d.profile.id)).toEqual([engaged.profile.id])

      await db.listItem.deleteMany({ where: { listId: list.id } })
      await db.list.delete({ where: { id: list.id } })
      await db.category.delete({ where: { id: category.id } })
      await db.categoryGroup.delete({ where: { id: group.id } })
      await db.entity.delete({ where: { id: entity.id } })
      await db.entityType.delete({ where: { id: entityType.id } })
    })
  })
})
