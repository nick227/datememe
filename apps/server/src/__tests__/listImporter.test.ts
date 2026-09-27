import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@project/db'
import { ListImporterService, type ListSeedInput } from '../services/ListImporterService'
import { key } from '../lib/identityKey'

const importer = new ListImporterService()
const prefix = `importer-${Date.now()}`
let group: any, type: any
const values = (...names: string[]) => [...names, ...Array.from({ length: 8 - names.length }, (_, i) => `${prefix} Filler ${i}`)]
const list = (over: Partial<ListSeedInput> = {}): ListSeedInput => ({
  schemaVersion: 1, groupSlug: group.slug, entityTypeSlug: type.slug, title: `${prefix} Snacks`, prompt: 'Which snacks?',
  axes: ['food'], values: values(), isAbstract: false, ...over,
})

describe('ListImporterService', () => {
  beforeAll(async () => {
    group = await db.categoryGroup.create({ data: { slug: prefix, label: 'Importer' } })
    type = await db.entityType.create({ data: { slug: prefix, label: 'Snack', pluralLabel: 'Snacks' } })
  })
  afterAll(async () => {
    const types = await db.entityType.findMany({ where: { slug: { startsWith: prefix } } })
    const categories = await db.category.findMany({ where: { groupId: group.id } })
    await db.sitePickItem.deleteMany({ where: { categoryId: { in: categories.map((c) => c.id) } } })
    await db.categoryEntity.deleteMany({ where: { categoryId: { in: categories.map((c) => c.id) } } })
    await db.category.deleteMany({ where: { groupId: group.id } })
    await db.entity.deleteMany({ where: { entityTypeId: { in: types.map((t) => t.id) } } })
    await db.entityType.deleteMany({ where: { id: { in: types.map((t) => t.id) } } })
    await db.categoryGroup.delete({ where: { id: group.id } })
  })

  it('derives Unicode-aware keys in code and is idempotent', async () => {
    const input = list({ values: values(`${prefix} Pelé`, { name: `${prefix} Jokić` } as any) })
    const first = await importer.importList(input)
    expect(first.status).toBe('SUCCESS')
    expect(first.categoryCreated).toBe(true)
    expect(await db.entity.findFirst({ where: { entityTypeId: type.id, canonicalName: `${prefix} Pelé` } })).toMatchObject({ slug: key(`${prefix} Pelé`) })
    const second = await importer.importList(input)
    expect(second).toMatchObject({ status: 'SUCCESS', categoryCreated: false, entitiesCreated: [] })
    expect(second.entitiesReused).toHaveLength(8)
  })

  it('reuses entities by legacy ASCII slug and by alias', async () => {
    await db.entity.create({ data: { entityTypeId: type.id, canonicalName: `${prefix} Old Beyoncé`, slug: `${prefix}-old-beyonc` } })
    await db.entity.create({ data: { entityTypeId: type.id, canonicalName: `${prefix} Doritos Nacho`, slug: `${prefix}-doritos-nacho`, aliases: { create: { alias: `${prefix} Doritos` } } } })
    const report = await importer.importList(list({ title: `${prefix} Reuse`, values: values(`${prefix} Old Beyoncé`, `${prefix} Doritos`) }))
    expect(report.entitiesReused).toEqual(expect.arrayContaining([`${prefix} Old Beyoncé`, `${prefix} Doritos`]))
    expect(await db.entity.count({ where: { entityTypeId: type.id, canonicalName: `${prefix} Doritos` } })).toBe(0)
  })

  it('rejects duplicates, unknown types and bad groups without writing', async () => {
    const dup = await importer.importList(list({ title: `${prefix} Dup`, values: values(`${prefix} Chips`, `${prefix}  chips`) }))
    expect(dup.status).toBe('ERROR')
    expect(dup.errors.join()).toMatch(/Duplicate value/)
    const unknownType = await importer.importList(list({ title: `${prefix} Typo`, entityTypeSlug: `${prefix}-snakc` }))
    expect(unknownType.errors.join()).toMatch(/not found; add createEntityType/)
    const badGroup = await importer.importList(list({ title: `${prefix} Group`, groupSlug: `${prefix}-nope` }))
    expect(badGroup.status).toBe('ERROR')
    expect(await db.category.count({ where: { slug: { in: [key(`${prefix} Dup`), key(`${prefix} Typo`), key(`${prefix} Group`)] } } })).toBe(0)
    expect(await db.entityType.count({ where: { slug: `${prefix}-snakc` } })).toBe(0)
  })

  it("scopes a list's choices to its values by default, and adds new values on re-import", async () => {
    const input = list({ title: `${prefix} Curated`, values: values(`${prefix} Salsa`, `${prefix} Hummus`) })
    await importer.importList(input)
    const category = await db.category.findFirstOrThrow({ where: { slug: key(`${prefix} Curated`) }, include: { curatedEntities: { include: { entity: true }, orderBy: { sortOrder: 'asc' } } } })
    expect(category.poolMode).toBe('CURATED')
    expect(category.curatedEntities.map((c) => c.entity.canonicalName)).toEqual(values(`${prefix} Salsa`, `${prefix} Hummus`))
    const again = await importer.importList({ ...input, values: [...values(`${prefix} Salsa`, `${prefix} Hummus`), `${prefix} Guac`] })
    expect(again).toMatchObject({ status: 'SUCCESS', choicesAdded: 1, entitiesCreated: [`${prefix} Guac`] })
    expect(await db.categoryEntity.count({ where: { categoryId: category.id } })).toBe(9)
  })

  it("offers the whole type only when the list opts in with pool: 'entity-type'", async () => {
    await importer.importList(list({ title: `${prefix} Broad`, pool: 'entity-type' }))
    const category = await db.category.findFirstOrThrow({ where: { slug: key(`${prefix} Broad`) }, include: { _count: { select: { curatedEntities: true } } } })
    expect(category.poolMode).toBe('FILTERED')
    expect(category._count.curatedEntities).toBe(0)
  })

  it('refuses a title that matches an existing category of another type', async () => {
    const other = await db.entityType.create({ data: { slug: `${prefix}-other`, label: 'Other', pluralLabel: 'Others' } })
    const report = await importer.importList(list({ title: `${prefix} Curated`, entityTypeSlug: other.slug }))
    expect(report.status).toBe('ERROR')
    expect(report.errors.join()).toMatch(/matches existing category .* of type/)
    expect(await db.entity.count({ where: { entityTypeId: other.id } })).toBe(0)
  })

  it('creates a new entity type only when declared', async () => {
    const report = await importer.importList(list({ title: `${prefix} New Type`, entityTypeSlug: `${prefix}-candy`, createEntityType: { label: 'Candy', pluralLabel: 'Candies' } }))
    expect(report.status).toBe('SUCCESS')
    expect(await db.entityType.findUnique({ where: { slug: `${prefix}-candy` } })).toMatchObject({ label: 'Candy', pluralLabel: 'Candies' })
  })
})
