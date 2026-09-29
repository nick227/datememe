import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@project/db'
import { ListService } from '../services/ListService'
import { TaxonomyService } from '../services/TaxonomyService'

describe('user submissions join the list for everyone', () => {
  const stamp = Date.now()
  const lists = new ListService()
  const taxonomy = new TaxonomyService()
  const slug = `custom-anime-${stamp}`
  let profileId: string
  let otherProfileId: string
  let userIds: string[]
  let typeId: string
  let groupId: string
  let curatedId: string
  let filteredId: string
  let tagId: string
  let inPoolId: string
  let outsiderId: string

  beforeAll(async () => {
    const type = await db.entityType.create({ data: { slug, label: 'Anime', pluralLabel: 'Anime' } })
    const group = await db.categoryGroup.create({ data: { slug, label: 'Film' } })
    const tag = await db.tag.create({ data: { slug: `${slug}-90s`, label: '90s' } })
    const [user, other] = await Promise.all([
      db.user.create({
        data: { email: `${slug}@example.com`, profile: { create: { username: slug, displayName: 'Custom', birthdate: new Date('1990-01-01') } } },
        include: { profile: true },
      }),
      db.user.create({
        data: { email: `${slug}-other@example.com`, profile: { create: { username: `${slug}-other`, displayName: 'Other', birthdate: new Date('1991-01-01') } } },
        include: { profile: true },
      }),
    ])
    const curated = await db.category.create({
      data: { groupId: group.id, entityTypeId: type.id, slug, prompt: 'What are your favorite anime series?', shortLabel: 'Top Anime Series', poolMode: 'CURATED' },
    })
    const filtered = await db.category.create({
      data: {
        groupId: group.id, entityTypeId: type.id, slug: `${slug}-filtered`, prompt: 'Which 90s anime?', shortLabel: '90s Anime', poolMode: 'CURATED',
        requiredTags: { create: { tagId: tag.id } },
      },
    })
    const inPool = await db.entity.create({
      data: { entityTypeId: type.id, canonicalName: 'Death Note', slug: `${slug}-death-note`, status: 'APPROVED', tags: { create: { tagId: tag.id } } },
    })
    const outsider = await db.entity.create({
      data: { entityTypeId: type.id, canonicalName: 'Outside', slug: `${slug}-outside`, status: 'APPROVED' },
    })
    await db.categoryEntity.create({ data: { categoryId: curated.id, entityId: inPool.id, sortOrder: 0 } })
    await db.categoryEntity.create({ data: { categoryId: filtered.id, entityId: outsider.id, sortOrder: 0, isExcluded: true } })
    typeId = type.id
    groupId = group.id
    tagId = tag.id
    userIds = [user.id, other.id]
    profileId = user.profile!.id
    otherProfileId = other.profile!.id
    curatedId = curated.id
    filteredId = filtered.id
    inPoolId = inPool.id
    outsiderId = outsider.id
  })

  afterAll(async () => {
    const categoryIds = [curatedId, filteredId]
    await db.jobQueue.deleteMany({ where: { OR: categoryIds.map((categoryId) => ({ payload: { path: '$.categoryId', equals: categoryId } })) } })
    await db.list.deleteMany({ where: { categoryId: { in: categoryIds } } })
    await db.entitySubmission.deleteMany({ where: { entityTypeId: typeId } })
    await db.category.deleteMany({ where: { id: { in: categoryIds } } })
    await db.entity.deleteMany({ where: { entityTypeId: typeId } })
    await db.tag.delete({ where: { id: tagId } })
    await db.entityType.delete({ where: { id: typeId } })
    await db.categoryGroup.delete({ where: { id: groupId } })
    await db.user.deleteMany({ where: { id: { in: userIds } } })
  })

  it('publishes a new value and an existing out-of-pool value onto a curated list', async () => {
    const submitted = await taxonomy.submitEntity(profileId, slug, 'Steins Gate')
    const customId = submitted.submittedEntity.id
    expect(await db.categoryEntity.findUnique({ where: { categoryId_entityId: { categoryId: curatedId, entityId: customId } } })).toMatchObject({ isExcluded: false })

    const found = await taxonomy.searchCategoryEntities(slug, otherProfileId, { q: 'Steins' })
    expect(found.data.map((entity) => entity.id)).toContain(customId)
    await expect(lists.upsertMyList(otherProfileId, slug, { items: [{ entityId: outsiderId, rank: 1 }] })).rejects.toMatchObject({ statusCode: 400 })

    const adopted = await taxonomy.submitEntity(profileId, slug, 'Outside')
    expect(adopted.submittedEntity.id).toBe(outsiderId)
    const saved = await lists.upsertMyList(otherProfileId, slug, { items: [{ entityId: inPoolId, rank: 1 }, { entityId: customId, rank: 2 }, { entityId: outsiderId, rank: 3 }] })
    expect(saved.items.map((item) => item.entityId)).toEqual([inPoolId, customId, outsiderId])
  })

  it('offers only the values named for a list, never its whole type', async () => {
    const unnamed = await db.entity.create({ data: { entityTypeId: typeId, canonicalName: 'Never Named', slug: `${slug}-never-named`, status: 'APPROVED' } })
    for (const list of [slug, `${slug}-filtered`]) {
      const ids = (await taxonomy.searchCategoryEntities(list, otherProfileId, { limit: 100 })).data.map((entity) => entity.id)
      expect(ids).not.toContain(unnamed.id)
    }
    expect((await taxonomy.searchCategoryEntities(slug, otherProfileId, {})).data.map((entity) => entity.id)).toContain(inPoolId)
  })

  it('offers values in the admin order, not by popularity', async () => {
    const rows = await db.categoryEntity.findMany({ where: { categoryId: curatedId, isExcluded: false }, orderBy: { sortOrder: 'asc' }, select: { entityId: true } })
    const reversed = rows.map((r) => r.entityId).reverse()
    await db.entity.update({ where: { id: reversed[reversed.length - 1]! }, data: { usageCount: { increment: 1000 } } })
    try {
      for (const [sortOrder, entityId] of reversed.entries()) await db.categoryEntity.update({ where: { categoryId_entityId: { categoryId: curatedId, entityId } }, data: { sortOrder } })
      const found = await taxonomy.searchCategoryEntities(slug, profileId, { limit: 100 })
      expect(found.data.map((entity) => entity.id)).toEqual(reversed)
    } finally {
      await db.entity.update({ where: { id: reversed[reversed.length - 1]! }, data: { usageCount: { decrement: 1000 } } })
    }
  })

  it('publishes onto a tagged list and lifts an exclusion', async () => {
    const submitted = await taxonomy.submitEntity(profileId, `${slug}-filtered`, 'Cowboy Bebop')
    const customId = submitted.submittedEntity.id
    const found = await taxonomy.searchCategoryEntities(`${slug}-filtered`, otherProfileId, { q: 'Cowboy' })
    expect(found.data.map((entity) => entity.id)).toEqual([customId])

    await taxonomy.submitEntity(profileId, `${slug}-filtered`, 'Outside')
    expect(await db.categoryEntity.findUnique({ where: { categoryId_entityId: { categoryId: filteredId, entityId: outsiderId } } })).toMatchObject({ isExcluded: false })
    const saved = await lists.upsertMyList(otherProfileId, `${slug}-filtered`, { items: [{ entityId: customId, rank: 1 }, { entityId: outsiderId, rank: 2 }] })
    expect(saved.items.map((item) => item.entityId)).toEqual([customId, outsiderId])
  })
})
