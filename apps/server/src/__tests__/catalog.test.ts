import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'
import openapiGlue from 'fastify-openapi-glue'
import { resolve } from 'path'
import { db } from '@project/db'
import { CatalogService } from '../services/CatalogService'
import { OpenAIService } from '../services/OpenAIService'
import { renderCatalogPrompts } from '../services/CatalogPrompts'
import { ListService } from '../services/ListService'
import { TaxonomyService } from '../services/TaxonomyService'
import { QuickPickService } from '../services/QuickPickService'
import * as handlers from '../handlers'
import * as security from '../plugins/security'

const service = new CatalogService()
const prefix = `factory-${Date.now()}`
let admin: any, user: any, type: any, group: any, concept: any, draft: any, entity: any, outsider: any
const opIds: string[] = []
const conceptIds: string[] = []
const mockOutput = (items: any[]) => vi.spyOn(OpenAIService, 'generateCatalog').mockResolvedValue({ items })
async function queue(kind: string, ids?: string[], count = 3) {
  const ops = await service.enqueue(admin.id, { kind, ids, count })
  opIds.push(...ops.map(o => o.id)); return ops[0]!
}
async function values(items: any[], target = draft.id) {
  mockOutput(items)
  const op = await queue('VALUES', [target])
  expect((await service.execute(op.id))?.status).toBe('SUCCEEDED')
  vi.restoreAllMocks()
  return db.entityCandidate.findMany({ where: { generationOperationId: op.id }, orderBy: { createdAt: 'asc' } })
}
describe('local admin content factory', () => {
  beforeAll(async () => {
    admin = await db.user.create({ data: { email: `${prefix}-admin@example.com`, role: 'ADMIN', sessions: { create: { token: `${prefix}-admin`, expiresAt: new Date(Date.now() + 3600000) } } } })
    user = await db.user.create({ data: { email: `${prefix}-user@example.com`, profile: { create: { username: prefix, birthdate: new Date('1990-01-01'), displayName: 'Factory Test' } }, sessions: { create: { token: `${prefix}-user`, expiresAt: new Date(Date.now() + 3600000) } } }, include: { profile: true } })
    type = await db.entityType.create({ data: { slug: prefix, label: 'Factory Film', pluralLabel: 'Factory Films' } })
    group = await db.categoryGroup.create({ data: { slug: prefix, label: 'Factory' } })
    concept = await service.command(admin.id, { action: 'concept', label: prefix }); conceptIds.push(concept.id)
    await service.command(admin.id, { action: 'concept-status', ids: [concept.id], status: 'USE' })
    entity = await db.entity.create({ data: { entityTypeId: type.id, canonicalName: `${prefix} Alien (1979)`, slug: `${prefix}-alien-1979` } })
    outsider = await db.entity.create({ data: { entityTypeId: type.id, canonicalName: `${prefix} Outside`, slug: `${prefix}-outside` } })
  })
  afterEach(() => vi.restoreAllMocks())
  afterAll(async () => {
    const drafts = await db.categoryDraft.findMany({ where: { conceptId: { in: conceptIds } } })
    await db.entityCandidate.deleteMany({ where: { categoryDraftId: { in: drafts.map(d => d.id) } } })
    await db.categoryDraft.deleteMany({ where: { id: { in: drafts.map(d => d.id) } } })
    const categories = drafts.flatMap(d => d.publishedCategoryId ? [d.publishedCategoryId] : [])
    await db.list.deleteMany({ where: { categoryId: { in: categories } } })
    await db.quickPickSignal.deleteMany({ where: { contextId: { in: categories } } })
    await db.category.deleteMany({ where: { id: { in: categories } } })
    await db.entityFacet.deleteMany({ where: { entity: { entityTypeId: type.id } } })
    await db.entity.deleteMany({ where: { entityTypeId: type.id } })
    await db.entityType.delete({ where: { id: type.id } })
    await db.categoryGroup.delete({ where: { id: group.id } })
    await db.generationOperation.deleteMany({ where: { requestedByUserId: admin.id } })
    await db.concept.deleteMany({ where: { id: { in: conceptIds } } })
    await db.user.deleteMany({ where: { id: { in: [admin.id, user.id] } } })
  })
  it('generates concepts without taxonomy and preserves previous use/skip decisions', async () => {
    mockOutput([{ label: prefix }, { label: `${prefix} space` }])
    const op = await queue('CONCEPTS')
    expect((await service.execute(op.id))?.status).toBe('SUCCEEDED')
    expect((await db.concept.findUniqueOrThrow({ where: { id: concept.id } })).status).toBe('USE')
    const second = await db.concept.findUniqueOrThrow({ where: { key: `${prefix}-space` } }); conceptIds.push(second.id)
    expect(second.status).toBe('NEW')
    expect((await db.generationOperation.findUniqueOrThrow({ where: { id: op.id } })).userPrompt).toContain(prefix)
  })
  it('creates unassigned private drafts; approval and taxonomy assignment are separate', async () => {
    mockOutput([{ title: `${prefix} Space films`, prompt: 'Which films do you love?', minItems: 1, maxItems: 2, orderingMode: 'RANKED' }])
    const op = await queue('LIST_IDEAS', [concept.id])
    await service.execute(op.id)
    draft = await db.categoryDraft.findFirstOrThrow({ where: { generationOperationId: op.id } })
    expect(draft.entityTypeId).toBeNull()
    expect(await db.category.findUnique({ where: { slug: draft.slug } })).toBeNull()
    await expect(queue('VALUES', [draft.id])).rejects.toMatchObject({ statusCode: 400 })
    await service.updateDraft(draft.id, { approvalState: 'APPROVED' })
    await expect(queue('VALUES', [draft.id])).rejects.toMatchObject({ statusCode: 400 })
    draft = await service.updateDraft(draft.id, { approvalState: 'APPROVED', groupId: group.id, entityTypeId: type.id })
  })
  it('publishes one shared entity and one new identity atomically; replay is a no-op', async () => {
    const candidates = await values([{ name: entity.canonicalName, slug: entity.slug, details: '1979 film' }, { name: `${prefix} New film`, slug: `${prefix}-new-film`, details: 'Reviewed fixture' }])
    await expect(service.reviewCandidate(candidates[0]!.id, { reviewState: 'APPROVED', resolutionState: 'NEW' })).rejects.toMatchObject({ statusCode: 409 })
    await service.reviewCandidate(candidates[0]!.id, { reviewState: 'APPROVED', resolvedEntityId: entity.id })
    await service.reviewCandidate(candidates[1]!.id, { reviewState: 'APPROVED', resolutionState: 'NEW' })
    const result = await service.publish(draft.id)
    expect(result.added).toBe(2)
    expect((await service.publish(draft.id)).added).toBe(0)
    draft = await db.categoryDraft.findUniqueOrThrow({ where: { id: draft.id } })
    expect(await db.entity.count({ where: { entityTypeId: type.id, slug: entity.slug } })).toBe(1)
    expect(await db.list.count({ where: { categoryId: result.categoryId } })).toBe(0)
  })
  it('enforces the published allowlist in autocomplete, list writes and both Quick Pick write paths', async () => {
    const search = await new TaxonomyService().searchCategoryEntities(draft.slug, user.profile.id, {})
    expect(search.data.map((e: any) => e.id)).toContain(entity.id)
    expect(search.data.map((e: any) => e.id)).not.toContain(outsider.id)
    await expect(new ListService().upsertMyList(user.profile.id, draft.slug, { items: [{ entityId: outsider.id, rank: 1 }] })).rejects.toMatchObject({ statusCode: 400 })
    const pairs = await QuickPickService.generatePairs({ profileId: user.profile.id, context: { type: 'CATEGORY', id: draft.publishedCategoryId }, limit: 3 })
    expect(pairs.pairs.length).toBe(1)
    expect(pairs.pairs.some(p => p.entityA.id === outsider.id || p.entityB.id === outsider.id)).toBe(false)
    await expect(QuickPickService.submitChoice(user.profile.id, 'CATEGORY', draft.publishedCategoryId, entity.id, outsider.id)).rejects.toMatchObject({ statusCode: 400 })
    await expect(QuickPickService.recordSignal(user.profile.id, 'CATEGORY', draft.publishedCategoryId, entity.id, outsider.id)).rejects.toMatchObject({ statusCode: 400 })
  })
  it('expands without replacing existing relationships or inventing new entities for shared values', async () => {
    const before = await db.categoryEntity.findMany({ where: { categoryId: draft.publishedCategoryId } })
    const [candidate] = await values([{ name: outsider.canonicalName, slug: outsider.slug, details: 'Existing identity' }])
    const result = await service.command(admin.id, { action: 'resolve-existing', ids: [candidate!.id] })
    expect(result.approved).toBe(1)
    expect((await service.publish(draft.id)).added).toBe(1)
    const after = await db.categoryEntity.findMany({ where: { categoryId: draft.publishedCategoryId } })
    expect(after).toEqual(expect.arrayContaining(before))
    expect(await db.list.count({ where: { categoryId: draft.publishedCategoryId } })).toBe(0)
  })
  it('rejects duplicate execution and discards canceled in-flight output', async () => {
    let complete!: (value: any) => void
    vi.spyOn(OpenAIService, 'generateCatalog').mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const op = await queue('CONCEPTS')
    const run = service.execute(op.id)
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'))
    await expect(service.execute(op.id)).rejects.toMatchObject({ statusCode: 409 })
    await service.command(admin.id, { action: 'cancel', ids: [op.id] })
    complete({ items: [{ label: `${prefix} canceled` }] })
    expect((await run)?.status).toBe('CANCELED')
    expect(await db.concept.findUnique({ where: { key: `${prefix}-canceled` } })).toBeNull()
  })
  it('records provider failures and retries as a new inspectable operation', async () => {
    vi.spyOn(OpenAIService, 'generateCatalog').mockRejectedValue(new Error('Provider unavailable'))
    const op = await queue('CONCEPTS')
    expect((await service.execute(op.id))?.error).toBe('Provider unavailable')
    const [retry] = await service.command(admin.id, { action: 'retry', id: op.id })
    expect(retry.id).not.toBe(op.id); expect(retry.status).toBe('PENDING')
    expect((await db.generationOperation.findUniqueOrThrow({ where: { id: op.id } })).status).toBe('FAILED')
  })
  it('keeps facet suggestions private until acceptance and reuses one facet per entity', async () => {
    mockOutput([{ axis: 'tone', value: 'dark', reason: 'Reviewed example' }])
    const op = await queue('FACETS', [entity.id])
    await service.execute(op.id)
    expect(await db.entityFacet.count({ where: { entityId: entity.id } })).toBe(0)
    await service.command(admin.id, { action: 'facet-accept', id: op.id, indices: [0] })
    await service.command(admin.id, { action: 'facet-accept', id: op.id, indices: [0] })
    expect(await db.entityFacet.count({ where: { entityId: entity.id } })).toBe(1)
  })
  it('rolls back new entities when publication cannot meet the required pool size', async () => {
    mockOutput([{ title: `${prefix} Rollback`, prompt: 'Top five?', minItems: 1, maxItems: 5, orderingMode: 'RANKED' }])
    const op = await queue('LIST_IDEAS', [concept.id]); await service.execute(op.id); vi.restoreAllMocks()
    const d = await db.categoryDraft.findFirstOrThrow({ where: { generationOperationId: op.id } })
    await service.updateDraft(d.id, { approvalState: 'APPROVED', groupId: group.id, entityTypeId: type.id })
    const [c] = await values([{ name: `${prefix} Rolled back`, slug: `${prefix}-rolled-back`, details: 'fixture' }], d.id)
    await service.reviewCandidate(c!.id, { reviewState: 'APPROVED', resolutionState: 'NEW' })
    await expect(service.publish(d.id)).rejects.toMatchObject({ statusCode: 400 })
    expect(await db.entity.findUnique({ where: { entityTypeId_slug: { entityTypeId: type.id, slug: c!.slug } } })).toBeNull()
    expect((await db.categoryDraft.findUniqueOrThrow({ where: { id: d.id } })).publishedCategoryId).toBeNull()
  })
  it('rejects stale outputs after the approved List changes', async () => {
    const d = await db.categoryDraft.findFirstOrThrow({ where: { conceptId: concept.id, publishedCategoryId: null } })
    const op = await queue('VALUES', [d.id])
    await service.updateDraft(d.id, { title: 'Changed title', entityTypeId: type.id, groupId: group.id, approvalState: 'APPROVED' })
    const spy = mockOutput([{ name: 'Never saved', slug: 'never-saved', details: '' }])
    expect((await service.execute(op.id))?.status).toBe('FAILED')
    expect(spy).not.toHaveBeenCalled()
  })
  it('keeps templated input literal and supports offline prompt inspection', () => {
    const rendered = renderCatalogPrompts('LIST_IDEAS', { count: 10, brief: '{{count}}', conceptLabel: 'space', existingListTitles: [] })
    expect(rendered.userPrompt).toContain('Brief: {{count}}')
    expect(rendered.userPrompt).toContain('10 distinct polls inspired by space')
  })
  it('uses the actual OpenAPI admin security and preserves result JSON on the wire', async () => {
    const app = Fastify()
    await app.register(openapiGlue, { specification: resolve(__dirname, '../../../../packages/api-spec/openapi.yaml'), serviceHandlers: handlers, securityHandlers: security, noAdditional: true } as any)
    const anonymous = await app.inject({ method: 'POST', url: '/admin/catalog', payload: { action: 'concept', label: 'nope' } })
    expect(anonymous.statusCode).toBe(401)
    const forbidden = await app.inject({ method: 'GET', url: '/admin/catalog', headers: { authorization: `Bearer ${prefix}-user` } })
    expect(forbidden.statusCode).toBe(403)
    const read = await app.inject({ method: 'GET', url: `/admin/catalog?draftId=${draft.id}`, headers: { authorization: `Bearer ${prefix}-admin` } })
    expect(read.statusCode).toBe(200); expect(read.json().draft.candidates.length).toBe(3)
    const write = await app.inject({ method: 'POST', url: '/admin/catalog', headers: { authorization: `Bearer ${prefix}-admin` }, payload: { action: 'publish', id: draft.id } })
    expect(write.statusCode).toBe(200); expect(write.json().result.added).toBe(0)
    const invalid = await app.inject({ method: 'POST', url: '/admin/catalog', headers: { authorization: `Bearer ${prefix}-admin` }, payload: { action: 'enqueue', kind: 'CONCEPTS', count: -1 } })
    expect(invalid.statusCode).toBe(400)
    await app.close()
  })
})
