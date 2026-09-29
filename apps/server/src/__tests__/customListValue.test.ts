import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@project/db'
import { ListService } from '../services/ListService'
import { TaxonomyService } from '../services/TaxonomyService'

describe('custom values on a curated list', () => {
  const stamp = Date.now()
  const lists = new ListService()
  const taxonomy = new TaxonomyService()
  let profileId: string
  let userId: string
  let typeId: string
  let groupId: string
  let categoryId: string
  let slug: string
  let inPoolId: string
  let outsiderId: string

  beforeAll(async () => {
    slug = `custom-anime-${stamp}`
    const type = await db.entityType.create({ data: { slug, label: 'Anime', pluralLabel: 'Anime' } })
    const group = await db.categoryGroup.create({ data: { slug, label: 'Film' } })
    const user = await db.user.create({
      data: {
        email: `${slug}@example.com`,
        profile: { create: { username: slug, displayName: 'Custom', birthdate: new Date('1990-01-01') } },
      },
      include: { profile: true },
    })
    const category = await db.category.create({
      data: {
        groupId: group.id,
        entityTypeId: type.id,
        slug,
        prompt: 'What are your favorite anime series?',
        shortLabel: 'Top Anime Series',
        poolMode: 'CURATED',
      },
    })
    const inPool = await db.entity.create({
      data: { entityTypeId: type.id, canonicalName: 'Death Note', slug: `${slug}-death-note`, status: 'APPROVED' },
    })
    const outsider = await db.entity.create({
      data: { entityTypeId: type.id, canonicalName: 'Outside', slug: `${slug}-outside`, status: 'APPROVED' },
    })
    await db.categoryEntity.create({ data: { categoryId: category.id, entityId: inPool.id, sortOrder: 0 } })
    typeId = type.id
    groupId = group.id
    userId = user.id
    profileId = user.profile!.id
    categoryId = category.id
    inPoolId = inPool.id
    outsiderId = outsider.id
  })

  afterAll(async () => {
    await db.jobQueue.deleteMany({ where: { payload: { path: '$.categoryId', equals: categoryId } } })
    await db.list.deleteMany({ where: { categoryId } })
    await db.entitySubmission.deleteMany({ where: { entityTypeId: typeId } })
    await db.category.delete({ where: { id: categoryId } })
    await db.entity.deleteMany({ where: { entityTypeId: typeId } })
    await db.entityType.delete({ where: { id: typeId } })
    await db.categoryGroup.delete({ where: { id: groupId } })
    await db.user.delete({ where: { id: userId } })
  })

  it('saves and finds a value the viewer just submitted, and still rejects other out-of-pool entities', async () => {
    const submitted = await taxonomy.submitEntity(profileId, typeId, 'Steins Gate')
    const customId = submitted.submittedEntity.id

    const saved = await lists.upsertMyList(profileId, slug, {
      items: [
        { entityId: inPoolId, rank: 1 },
        { entityId: customId, rank: 2 },
      ],
    })
    expect(saved.items.map((item) => item.entityId)).toEqual([inPoolId, customId])

    await expect(
      lists.upsertMyList(profileId, slug, { items: [{ entityId: outsiderId, rank: 1 }] }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'One or more entities are not valid for this category' })

    const search = await taxonomy.searchCategoryEntities(slug, profileId, { q: 'Steins' })
    expect(search.data.map((entity) => entity.id)).toContain(customId)
    expect(search.data.map((entity) => entity.id)).not.toContain(outsiderId)
  })
})
