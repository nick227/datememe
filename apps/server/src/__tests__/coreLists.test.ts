import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@project/db'
import { ContentFeedService } from '../services/ContentFeedService'
import { CORE_GROUP_SLUG } from '../lib/coreLists'

// The core set (catalog/core-lists.json → the `core` SitePickGroup): pinned first on
// Lists with the viewer's progress, and leading Discover's improve-matches rail.
describe('core lists in the feeds', () => {
  const feed = new ContentFeedService()
  const stamp = Date.now()
  let groupId: string, typeId: string, pickGroupId: string
  let categoryIds: string[] = []
  const userIds: string[] = []
  let viewer: { userId: string; profileId: string }
  let existingCore: { id: string } | null = null

  const makeProfile = async (label: string) => {
    const u = await db.user.create({
      data: { email: `core-${label}-${stamp}@example.com`, passwordHash: 'x', profile: { create: { username: `core-${label}-${stamp}`, displayName: label, birthdate: new Date('1992-01-01') } } },
      include: { profile: true },
    })
    userIds.push(u.id)
    return { userId: u.id, profileId: u.profile!.id }
  }

  beforeAll(async () => {
    // The dev database may hold a real core group; park it for the test and restore it after.
    existingCore = await db.sitePickGroup.findUnique({ where: { slug: CORE_GROUP_SLUG }, select: { id: true } })
    if (existingCore) await db.sitePickGroup.update({ where: { id: existingCore.id }, data: { slug: `${CORE_GROUP_SLUG}-parked-${stamp}` } })

    typeId = (await db.entityType.create({ data: { slug: `core-type-${stamp}`, label: 'Core Type', pluralLabel: 'Core Types' } })).id
    groupId = (await db.categoryGroup.create({ data: { slug: `core-group-${stamp}`, label: 'Core Group' } })).id
    const entity = await db.entity.create({ data: { entityTypeId: typeId, canonicalName: 'Core Value', slug: `core-value-${stamp}`, status: 'APPROVED' } })
    for (const n of [1, 2, 3]) {
      const c = await db.category.create({
        data: { groupId, entityTypeId: typeId, slug: `core-list-${n}-${stamp}`, prompt: 'p', shortLabel: `Core ${n}`, minItems: 1, curatedEntities: { create: { entityId: entity.id } } },
      })
      categoryIds.push(c.id)
    }
    pickGroupId = (await db.sitePickGroup.create({
      data: { slug: CORE_GROUP_SLUG, label: 'Core lists', sortOrder: -1, items: { create: categoryIds.map((categoryId, sortOrder) => ({ categoryId, sortOrder })) } },
    })).id
    viewer = await makeProfile('viewer')
    await makeProfile('other')
    // The viewer finished the first core list.
    await db.list.create({ data: { profileId: viewer.profileId, categoryId: categoryIds[0]!, isComplete: true, items: { create: { entityId: entity.id, rank: 1 } } } })
  })

  afterAll(async () => {
    await db.sitePickGroup.delete({ where: { id: pickGroupId } })
    if (existingCore) await db.sitePickGroup.update({ where: { id: existingCore.id }, data: { slug: CORE_GROUP_SLUG } })
    await db.list.deleteMany({ where: { categoryId: { in: categoryIds } } })
    await db.category.deleteMany({ where: { id: { in: categoryIds } } })
    await db.entity.deleteMany({ where: { entityTypeId: typeId } })
    await db.categoryGroup.delete({ where: { id: groupId } })
    await db.entityType.delete({ where: { id: typeId } })
    await db.profile.deleteMany({ where: { userId: { in: userIds } } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  })

  it('Lists: the core module leads Explore, unanswered first, with progress in its title', async () => {
    const page: any = await feed.getListsFeed(viewer.profileId, { limit: 20 })
    const siteModules = page.data.filter((m: any) => m.id?.startsWith('site-picks-'))
    expect(siteModules[0].id).toBe(`site-picks-${CORE_GROUP_SLUG}`)
    expect(siteModules[0].title).toBe('Core lists · 1 of 3 done')
    expect(siteModules[0].items.map((i: any) => i.title)).toEqual(['Core 2', 'Core 3', 'Core 1'])
  })

  it('Discover: improve-matches leads with the unanswered core lists and shows progress', async () => {
    const page: any = await feed.getDiscoverFeed(viewer.userId, viewer.profileId, { limit: 20 })
    const improve = page.data.find((m: any) => m.id === 'improve-matches')
    expect(improve).toBeTruthy()
    expect(improve.title).toMatch(/Core lists · 1 of 3 done$/)
    expect(improve.items.slice(0, 2).map((i: any) => i.title)).toEqual(['Core 2', 'Core 3'])
    expect(improve.context).toMatchObject({ coreCompleted: 1, coreTotal: 3 })
  })
})
