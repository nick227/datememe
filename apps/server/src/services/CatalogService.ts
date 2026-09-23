import { db, Prisma } from '@project/db'
import { createHash } from 'crypto'
import { OpenAIService } from './OpenAIService'
import { renderCatalogPrompts } from './CatalogPrompts'
import { catalogConfig, GenerationKind, facetVocabulary, generationTimeoutMs } from '../prompts/catalog/config'

export function fail(message: string, statusCode = 400): never { throw { statusCode, message } }
export function text(value: unknown, label: string, max = 250): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${label} is required (max ${max} characters)`)
  return value.trim()
}
export function key(value: string) { return value.normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const rulesFor = (v: any) => {
  if (!v || !Number.isInteger(v.minItems) || !Number.isInteger(v.maxItems) || v.minItems < 1 || v.maxItems < v.minItems || v.maxItems > 10 || !['RANKED', 'UNRANKED'].includes(v.orderingMode)) fail('Rules require 1 ≤ minItems ≤ maxItems ≤ 10 and a valid ordering mode')
  return { minItems: v.minItems as number, maxItems: v.maxItems as number, orderingMode: v.orderingMode as 'RANKED' | 'UNRANKED' }
}
const snapshot = (d: any) => hash([d.title, d.prompt, d.entityTypeId, d.groupId, d.rules, d.approvalState])
const facetValid = (f: any) => Object.hasOwn(facetVocabulary, f.axis) && (facetVocabulary[f.axis as keyof typeof facetVocabulary] as readonly string[]).includes(f.value)
const writable = () => {
  // This V1 publishes into a local catalog only. Production promotion is a separate workflow.
  const url = new URL(process.env.DATABASE_URL || 'mysql://invalid')
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) fail('Content factory V1 is enabled only on a local development database', 403)
}

export class CatalogService {
  async state(conceptId?: string, draftId?: string, offset = 0) {
    const [concepts, conceptCount, drafts, draftCount, operations, recentOperations, types, groups, draft] = await Promise.all([
      db.concept.findMany({ orderBy: { label: 'asc' }, skip: offset, take: 100, include: { _count: { select: { drafts: true } } } }),
      db.concept.count(),
      db.categoryDraft.findMany({ where: conceptId ? { conceptId } : {}, orderBy: { createdAt: 'desc' }, skip: offset, take: 100, include: { concept: true, _count: { select: { candidates: true } } } }),
      db.categoryDraft.count({ where: conceptId ? { conceptId } : {} }),
      db.generationOperation.findMany({ where: { status: { in: ['PENDING', 'RUNNING', 'FAILED'] } }, orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, kind: true, targetId: true, status: true, error: true, createdAt: true, startedAt: true } }),
      db.generationOperation.findMany({ where: { status: { in: ['SUCCEEDED', 'CANCELED'] } }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, kind: true, targetId: true, status: true, error: true, createdAt: true, startedAt: true } }),
      db.entityType.findMany({ where: { isActive: true }, select: { id: true, label: true }, orderBy: { label: 'asc' } }),
      db.categoryGroup.findMany({ select: { id: true, label: true }, orderBy: { label: 'asc' } }),
      draftId ? db.categoryDraft.findUnique({ where: { id: draftId }, include: { candidates: { include: { entity: { include: { facets: true } } }, orderBy: { createdAt: 'asc' } } } }) : null,
    ])
    return { concepts, conceptCount, drafts, draftCount, operations: [...operations, ...recentOperations], types, groups, draft, localOnly: true }
  }

  async context(kind: GenerationKind, targetId: string | null, brief: string, count: number) {
    const input: Record<string, any> = { count, brief }
    if (kind === 'CONCEPTS') input.existingConceptKeys = (await db.concept.findMany({ select: { key: true }, take: 2000 })).map(c => c.key)
    if (kind === 'LIST_IDEAS') {
      const concept = await db.concept.findUnique({ where: { id: targetId! }, include: { drafts: { select: { title: true } } } })
      if (!concept || concept.status !== 'USE') fail('Select a concept marked Use')
      input.conceptLabel = concept.label
      input.existingListTitles = [...concept.drafts.map(d => d.title), ...(await db.category.findMany({ select: { shortLabel: true }, take: 1000 })).map(c => c.shortLabel)]
    }
    if (kind === 'VALUES') {
      const d = await db.categoryDraft.findUnique({ where: { id: targetId! }, include: { entityType: true, candidates: true, publishedCategory: { include: { curatedEntities: { include: { entity: true } } } } } })
      if (!d || d.approvalState !== 'APPROVED' || !d.entityType?.isActive || !d.groupId) fail('Approve and assign a group and value type before generating values')
      input.listTitle = d.title; input.listPrompt = d.prompt; input.entityType = d.entityType.label; input.rules = rulesFor(d.rules)
      input.existingValues = [...d.candidates.map(c => c.name), ...(d.publishedCategory?.curatedEntities.map(c => c.entity.canonicalName) ?? [])]
      input.rejectedValues = d.candidates.filter(c => c.reviewState === 'REJECTED').map(c => c.name)
      input.draftHash = snapshot(d)
    }
    if (kind === 'FACETS') {
      const entity = await db.entity.findUnique({ where: { id: targetId! } })
      if (!entity || entity.status !== 'APPROVED' || entity.mergedIntoId) fail('Select an approved entity')
      input.entityName = entity.canonicalName; input.verifiedFacts = entity.metadata || {}; input.allowedFacets = facetVocabulary
    }
    return input
  }

  async enqueue(actor: string, body: any) {
    writable()
    const kind = body.kind as GenerationKind
    if (!Object.hasOwn(catalogConfig, kind)) fail('Unknown generation kind')
    const config = catalogConfig[kind]
    const count = body.count ?? config.count
    if (!Number.isInteger(count) || count < 1 || count > config.max) fail(`Count must be 1–${config.max}`)
    const brief = body.brief === undefined ? '' : text(body.brief, 'Brief', 2000)
    const ids: (string | null)[] = kind === 'CONCEPTS' ? [null] : this.ids(body.ids)
    // Validate all targets before creating any jobs in the batch.
    const data = []
    for (const targetId of ids) {
      const input = await this.context(kind, targetId, brief, count)
      data.push({ kind, targetId, input, ...renderCatalogPrompts(kind, input), requestedByUserId: actor })
    }
    return db.$transaction(data.map(data => db.generationOperation.create({ data })))
  }
  ids(value: unknown): string[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) fail('Select 1–100 items')
    return [...new Set(value.map(v => text(v, 'ID')))]
  }

  async execute(id: string) {
    writable()
    const claimed = await db.generationOperation.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'RUNNING', startedAt: new Date() } })
    if (!claimed.count) fail('Operation already running or finished', 409)
    const op = await db.generationOperation.findUniqueOrThrow({ where: { id } })
    const kind = op.kind as GenerationKind
    try {
      const input = op.input as any
      // Validate current target before spending tokens.
      const current = await this.context(kind, op.targetId, input.brief, input.count)
      if (kind === 'VALUES' && current.draftHash !== input.draftHash) fail('Draft changed; generate a new operation', 409)
      const output = await OpenAIService.generateCatalog(kind, op)
      const items = this.validateOutput(kind, output, input.count)
      await db.$transaction(async tx => {
        // Lock the operation and conditional status transition; cancellation discards late output.
        const done = await tx.generationOperation.updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'SUCCEEDED', output: output as Prisma.InputJsonValue, completedAt: new Date() } })
        if (!done.count) fail('Operation canceled; output discarded', 409)
        if (kind === 'CONCEPTS') {
          for (const item of items) await tx.concept.upsert({ where: { key: key(item.label) }, update: {}, create: { key: key(item.label), label: item.label.trim() } })
        } else if (kind === 'LIST_IDEAS') {
          const concept = await tx.concept.findUniqueOrThrow({ where: { id: op.targetId! }, include: { drafts: true } })
          if (concept.status !== 'USE') fail('Concept is no longer marked Use')
          const existing = new Set(concept.drafts.map(d => key(d.title)))
          for (const item of items) {
            if (existing.has(key(item.title))) continue
            await tx.categoryDraft.upsert({ where: { conceptId_slug: { conceptId: concept.id, slug: key(item.title) } }, update: {}, create: { conceptId: concept.id, generationOperationId: id, title: item.title, slug: key(item.title), prompt: item.prompt, rules: rulesFor(item) } })
            existing.add(key(item.title))
          }
        } else if (kind === 'VALUES') {
          // Serialize against definition edits/publication and check the captured definition.
          await tx.$queryRaw`SELECT id FROM CategoryDraft WHERE id = ${op.targetId!} FOR UPDATE`
          const draft = await tx.categoryDraft.findUniqueOrThrow({ where: { id: op.targetId! } })
          if (snapshot(draft) !== input.draftHash) fail('Draft changed while generation was running')
          const existingNames = new Set((await tx.entityCandidate.findMany({ where: { categoryDraftId: draft.id } })).map(c => key(c.name)))
          for (const item of items) {
            if (existingNames.has(key(item.name))) continue
            await tx.entityCandidate.upsert({ where: { categoryDraftId_slug: { categoryDraftId: draft.id, slug: item.slug } }, update: {}, create: { categoryDraftId: draft.id, generationOperationId: id, name: item.name, slug: item.slug, details: item.details } })
            existingNames.add(key(item.name))
          }
        }
      }, { timeout: 15000 })
    } catch (error: any) {
      await db.generationOperation.updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'FAILED', error: String(error.message || 'Generation failed').slice(0, 2000), completedAt: new Date() } })
    }
    return db.generationOperation.findUniqueOrThrow({ where: { id } })
  }
  validateOutput(kind: GenerationKind, output: any, count: number): any[] {
    if (!output || !Array.isArray(output.items) || output.items.length > count || !output.items.length) fail('Invalid or empty generation output')
    for (const item of output.items) {
      if (kind === 'CONCEPTS') { text(item.label, 'Concept', 100); if (!key(item.label)) fail('Invalid concept key') }
      if (kind === 'LIST_IDEAS') { text(item.title, 'Title', 150); text(item.prompt, 'Prompt', 1000); rulesFor(item); if (!key(item.title)) fail('Invalid title key') }
      if (kind === 'VALUES') { text(item.name, 'Name', 180); text(item.slug, 'Slug', 180); if (key(item.slug) !== item.slug) fail('Invalid candidate slug'); if (typeof item.details !== 'string' || item.details.length > 2000) fail('Invalid details') }
      if (kind === 'FACETS' && (!facetValid(item) || typeof item.reason !== 'string')) fail('Unknown facet')
    }
    return output.items
  }

  async updateDraft(id: string, body: any) {
    writable()
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM CategoryDraft WHERE id = ${id} FOR UPDATE`
      const d = await tx.categoryDraft.findUniqueOrThrow({ where: { id } })
      if (d.publishedCategoryId) fail('Published definitions are locked; expand values instead')
      const approvalState = body.approvalState ?? 'DRAFT'
      if (!['DRAFT', 'APPROVED', 'REJECTED'].includes(approvalState)) fail('Invalid approval state')
      const entityTypeId = body.entityTypeId === undefined ? d.entityTypeId : body.entityTypeId || null
      const groupId = body.groupId === undefined ? d.groupId : body.groupId || null
      if (entityTypeId && !await tx.entityType.findFirst({ where: { id: entityTypeId, isActive: true } })) fail('Unknown value type')
      if (groupId && !await tx.categoryGroup.findUnique({ where: { id: groupId } })) fail('Unknown group')
      const rules = rulesFor(body.rules ?? d.rules)
      const title = text(body.title ?? d.title, 'Title', 150), prompt = text(body.prompt ?? d.prompt, 'Prompt', 1000)
      const slug = text(body.slug ?? d.slug, 'Slug', 180)
      if (key(slug) !== slug) fail('Invalid slug')
      const changed = entityTypeId !== d.entityTypeId || title !== d.title || prompt !== d.prompt || JSON.stringify(rules) !== JSON.stringify(d.rules)
      if (changed) await tx.entityCandidate.updateMany({ where: { categoryDraftId: id }, data: { reviewState: 'PENDING', resolutionState: 'UNRESOLVED', resolvedEntityId: null } })
      return tx.categoryDraft.update({ where: { id }, data: { title, slug, prompt, entityTypeId, groupId, rules, approvalState } })
    })
  }

  async matches(candidateId: string, query?: string) {
    const candidate = await db.entityCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { draft: true } })
    if (!candidate.draft.entityTypeId) fail('Assign the value type first')
    const name = query?.trim() || candidate.name
    return db.entity.findMany({ where: { entityTypeId: candidate.draft.entityTypeId, status: 'APPROVED', mergedIntoId: null, OR: [{ canonicalName: { contains: name } }, { slug: candidate.slug }, { aliases: { some: { alias: { contains: name } } } }] }, select: { id: true, canonicalName: true, slug: true, metadata: true }, take: 30 })
  }
  async reviewCandidate(id: string, body: any) {
    writable()
    return db.$transaction(async tx => {
      const c = await tx.entityCandidate.findUniqueOrThrow({ where: { id } })
      await tx.$queryRaw`SELECT id FROM CategoryDraft WHERE id = ${c.categoryDraftId} FOR UPDATE`
      const d = await tx.categoryDraft.findUniqueOrThrow({ where: { id: c.categoryDraftId } })
      const reviewState = body.reviewState
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(reviewState)) fail('Invalid review decision')
      const name = text(body.name ?? c.name, 'Name', 180), slug = text(body.slug ?? c.slug, 'Slug', 180)
      if (key(slug) !== slug) fail('Invalid slug')
      let resolutionState = 'UNRESOLVED', resolvedEntityId: string | null = null
      if (reviewState === 'APPROVED') {
        if (!d.entityTypeId || d.approvalState !== 'APPROVED') fail('Approve and assign the List first')
        if (body.resolvedEntityId) {
          const e = await tx.entity.findFirst({ where: { id: body.resolvedEntityId, entityTypeId: d.entityTypeId, status: 'APPROVED', mergedIntoId: null } })
          if (!e) fail('Entity does not belong to this value type or is not approved')
          resolutionState = 'EXISTING'; resolvedEntityId = e.id
        } else {
          if (body.resolutionState !== 'NEW') fail('Choose an existing entity or explicitly approve a new identity')
          const collision = await tx.entity.findFirst({ where: { entityTypeId: d.entityTypeId, OR: [{ slug }, { canonicalName: name }] } })
          if (collision) fail('An entity with this name/key exists; use it or disambiguate the new name and key', 409)
          resolutionState = 'NEW'
        }
      }
      return tx.entityCandidate.update({ where: { id }, data: { name, slug, reviewState, resolutionState, resolvedEntityId } })
    })
  }

  async publish(id: string) {
    writable()
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM CategoryDraft WHERE id = ${id} FOR UPDATE`
      const d = await tx.categoryDraft.findUniqueOrThrow({ where: { id }, include: { candidates: { where: { reviewState: 'APPROVED' } } } })
      if (d.approvalState !== 'APPROVED' || !d.entityTypeId || !d.groupId) fail('Approve and assign the List first')
      if (!await tx.entityType.findFirst({ where: { id: d.entityTypeId, isActive: true } })) fail('Value type is inactive')
      const rules = rulesFor(d.rules)
      let category = d.publishedCategoryId ? await tx.category.findUniqueOrThrow({ where: { id: d.publishedCategoryId } }) : null
      if (category && (category.entityTypeId !== d.entityTypeId || category.poolMode !== 'CURATED')) fail('Published category changed; review its configuration first', 409)
      const entityIds = new Set<string>()
      for (const c of d.candidates) {
        let entity = c.resolvedEntityId ? await tx.entity.findUnique({ where: { id: c.resolvedEntityId } }) : null
        if (!entity) {
          if (c.resolutionState !== 'NEW') fail(`Resolve ${c.name} before publication`)
          entity = await tx.entity.findFirst({ where: { entityTypeId: d.entityTypeId, OR: [{ slug: c.slug }, { canonicalName: c.name }] } })
          // Even exact-key matches require explicit resolution; a different draft may have published it.
          if (entity) fail(`${c.name} now exists; resolve it to the shared entity and retry`, 409)
          entity = await tx.entity.create({ data: { entityTypeId: d.entityTypeId, canonicalName: c.name, slug: c.slug, sourceType: 'AI_GENERATED', status: 'APPROVED' } })
        }
        if (entity.entityTypeId !== d.entityTypeId || entity.status !== 'APPROVED' || entity.mergedIntoId) fail(`Invalid entity: ${c.name}`)
        entityIds.add(entity.id)
        await tx.entityCandidate.update({ where: { id: c.id }, data: { resolvedEntityId: entity.id, resolutionState: 'EXISTING' } })
      }
      if (!category && entityIds.size < rules.maxItems) fail(`Approve at least ${rules.maxItems} distinct choices before publishing`)
      if (!category) {
        category = await tx.category.create({ data: { groupId: d.groupId, entityTypeId: d.entityTypeId, slug: d.slug, shortLabel: d.title, prompt: d.prompt, ...rules, poolMode: 'CURATED' } })
        await tx.categoryDraft.update({ where: { id }, data: { publishedCategoryId: category.id } })
      }
      let added = 0
      let order = (await tx.categoryEntity.aggregate({ where: { categoryId: category.id }, _max: { sortOrder: true } }))._max.sortOrder ?? -1
      for (const entityId of entityIds) {
        const result = await tx.categoryEntity.createMany({ data: [{ categoryId: category.id, entityId, sortOrder: ++order }], skipDuplicates: true })
        added += result.count
      }
      return { categoryId: category.id, added }
    }, { timeout: 15000 })
  }

  async command(actor: string, b: any): Promise<any> {
    writable()
    const id = () => text(b.id, 'ID')
    switch (b.action) {
      case 'concept': {
        const label = text(b.label, 'Concept', 100), normalized = key(label)
        if (!normalized) fail('Concept needs letters or numbers')
        return db.concept.upsert({ where: { key: normalized }, update: {}, create: { key: normalized, label } })
      }
      case 'concept-status': {
        if (!['NEW', 'USE', 'SKIP'].includes(b.status)) fail('Invalid concept status')
        return db.concept.updateMany({ where: { id: { in: this.ids(b.ids) } }, data: { status: b.status } })
      }
      case 'enqueue': return this.enqueue(actor, b)
      case 'execute': return this.execute(id())
      case 'operation': return db.generationOperation.findUniqueOrThrow({ where: { id: id() } })
      case 'cancel': return db.generationOperation.updateMany({ where: { id: { in: this.ids(b.ids) }, status: { in: ['PENDING', 'RUNNING'] } }, data: { status: 'CANCELED', completedAt: new Date() } })
      case 'retry': {
        const op = await db.generationOperation.findUniqueOrThrow({ where: { id: id() } })
        if (op.status === 'RUNNING' && op.startedAt && Date.now() - op.startedAt.getTime() < generationTimeoutMs + 30000) fail('Operation is still running', 409)
        if (!['FAILED', 'CANCELED', 'RUNNING'].includes(op.status)) fail('Only failed, canceled, or stale operations can be retried')
        await db.generationOperation.updateMany({ where: { id: op.id, status: 'RUNNING' }, data: { status: 'FAILED', error: 'Interrupted operation', completedAt: new Date() } })
        return this.enqueue(actor, { kind: op.kind, ids: [op.targetId], count: (op.input as any).count, brief: (op.input as any).brief || undefined })
      }
      case 'draft': return this.updateDraft(id(), b)
      case 'matches': return this.matches(id(), b.query)
      case 'candidate': return this.reviewCandidate(id(), b)
      case 'resolve-existing': {
        let approved = 0
        for (const candidateId of this.ids(b.ids)) {
          const c = await db.entityCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { draft: true } })
          if (!c.draft.entityTypeId) continue
          const matches = await db.entity.findMany({ where: { entityTypeId: c.draft.entityTypeId, canonicalName: c.name, slug: c.slug, status: 'APPROVED', mergedIntoId: null } })
          if (matches.length === 1) {
            await this.reviewCandidate(c.id, { reviewState: 'APPROVED', resolvedEntityId: matches[0]!.id }); approved++
          }
        }
        return { approved }
      }
      case 'publish': return this.publish(id())
      case 'facet-accept': {
        const op = await db.generationOperation.findUniqueOrThrow({ where: { id: id() } })
        if (op.kind !== 'FACETS' || op.status !== 'SUCCEEDED' || !op.targetId) fail('No completed facet suggestions')
        if (!Array.isArray(b.indices) || !b.indices.length || b.indices.length > 10) fail('Select facets')
        const items = (op.output as any).items
        const selected = b.indices.map((i: any) => { if (!Number.isInteger(i) || !items[i] || !facetValid(items[i])) fail('Invalid facet selection'); return items[i] })
        return db.$transaction(selected.map((f: any) => db.entityFacet.upsert({ where: { entityId_axis_value: { entityId: op.targetId!, axis: f.axis, value: f.value } }, update: {}, create: { entityId: op.targetId!, axis: f.axis, value: f.value, source: 'AI', generationOperationId: op.id } })))
      }
      case 'facet-remove': return db.entityFacet.delete({ where: { id: id() } })
      default: fail('Unknown content action')
    }
  }
}
