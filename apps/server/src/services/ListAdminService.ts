import { db } from '@project/db'
import { key, legacyAsciiKey } from '../lib/identityKey'
import { similarity } from '../lib/levenshtein'
import { coverDecisionOf } from '../lib/categoryCovers'
import { isServableAsset } from '../lib/mediaIntegrity'
import { mergeRefMetadata } from '../lib/wikidataIdentity'
import { ListCoverService } from './ListCoverService'

// Admin → Lists (docs/admin-lists-roadmap.md). The admin edits what users
// see — title, question, group, values, cover, live/hidden — and the cover
// automation fills in behind it. Every save stamps metadata.adminEditedAt so
// catalog imports never overwrite admin edits.

const covers = new ListCoverService()

type Actor = { id: string; role: string }
export type ListStatusFilter = 'all' | 'live' | 'hidden' | 'attention'
export type ListSort = 'updated' | 'az' | 'takes'
type Problem = 'cover' | 'cover-failed' | 'values' | 'duplicate' | 'too-broad' | 'wrong-group' | 'weak-cover' | 'low-takes'
type QualityIssue = { code: string; detail: string; flagged: boolean }
// The worker's CATALOG_AUDIT (apps/worker/src/lib/catalogAudit.ts) writes metadata.quality;
// only flagged issues reach the admin, in this order of importance.
const QUALITY_PROBLEM: Record<string, Problem> = {
  duplicate: 'duplicate', overlap: 'duplicate', 'too-broad': 'too-broad', 'needs-values': 'values',
  'weak-cover': 'weak-cover', 'wrong-group': 'wrong-group', 'low-takes': 'low-takes',
}
const ORDER: Problem[] = ['cover', 'cover-failed', 'duplicate', 'values', 'too-broad', 'weak-cover', 'wrong-group', 'low-takes']
const flaggedIssues = (metadata: unknown) => (((metadata as any)?.quality?.issues ?? []) as QualityIssue[]).filter((i) => i.flagged)

const fail = (statusCode: number, message: string, extra: Record<string, unknown> = {}): never => { throw { statusCode, message, ...extra } }

const LIST_SELECT = {
  id: true, slug: true, shortLabel: true, prompt: true, isActive: true, isPremiumOnly: true, isMatchSignal: true, orderingMode: true,
  minItems: true, maxItems: true, popularityCount: true, metadata: true, updatedAt: true, entityTypeId: true,
  group: { select: { id: true, label: true } },
  entityType: { select: { id: true, label: true } },
  parentEntity: { select: { id: true, canonicalName: true } },
  mediaAssets: { where: { isPrimary: true }, orderBy: { createdAt: 'desc' as const }, take: 1 },
  _count: { select: { curatedEntities: { where: { isExcluded: false } } } },
}
type ListRow = Awaited<ReturnType<typeof loadLists>>[number]
const loadLists = (where: object = {}) => db.category.findMany({ where, select: LIST_SELECT })

/** Values a list offers: its CategoryEntity rows. */
async function valueCounts(_lists: ListRow[]) {
  return (l: ListRow) => l._count.curatedEntities
}

function coverOf(l: ListRow) {
  const asset = l.mediaAssets[0]
  const servable = asset && isServableAsset(asset) ? asset : null
  return { decision: coverDecisionOf(l.metadata), asset: servable }
}

function problemsOf(l: ListRow, valueCount: number): Problem[] {
  const { decision, asset } = coverOf(l)
  const problems: Problem[] = []
  if (!asset && decision?.status !== 'none') {
    // The automation ran and came back empty-handed, or broke: the admin has to step in.
    const suggest = covers.suggestState(l.metadata)
    problems.push(suggest?.status === 'failed' || (suggest?.status === 'done' && !suggest.candidates.length) ? 'cover-failed' : 'cover')
  }
  if (valueCount < l.maxItems) problems.push('values')
  for (const issue of flaggedIssues(l.metadata)) {
    const p = QUALITY_PROBLEM[issue.code]
    if (p && !problems.includes(p)) problems.push(p)
  }
  return problems.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
}

/** Re-runs the catalog audit soon after an edit, so flags clear without waiting for the timer. */
async function queueCatalogAudit() {
  const inFlight = await db.jobQueue.findFirst({ where: { type: 'CATALOG_AUDIT', status: 'PENDING' }, select: { id: true } })
  if (!inFlight) await db.jobQueue.create({ data: { type: 'CATALOG_AUDIT', payload: {} } })
}

/**
 * Hidden lists created in Admin that have never been live. Older lists
 * predate the firstLiveAt stamp, so for them "never published" is unknown
 * (retired lists were live once) and they show as plain Hidden.
 */
async function neverPublishedIds(lists: ListRow[]) {
  const hidden = lists.filter((l) => !l.isActive && !(l.metadata as any)?.firstLiveAt && (l.metadata as any)?.createdBy?.by === 'admin')
  if (!hidden.length) return new Set<string>()
  const taken = await db.list.groupBy({ by: ['categoryId'], where: { categoryId: { in: hidden.map((l) => l.id) }, isComplete: true } })
  const withTakes = new Set(taken.map((t) => t.categoryId))
  return new Set(hidden.filter((l) => !withTakes.has(l.id)).map((l) => l.id))
}

function card(l: ListRow) {
  const asset = coverOf(l).asset
  return { imageUrl: asset?.publicUrl ?? null, imageCardUrl: (asset?.metadata as any)?.card?.publicUrl ?? asset?.publicUrl ?? null }
}

export class ListAdminService {
  async browse(opts: { q?: string; status?: ListStatusFilter; groupId?: string; sort?: ListSort; limit?: number; offset?: number }) {
    const lists = await loadLists()
    const count = await valueCounts(lists)
    const never = await neverPublishedIds(lists)
    const rows = lists.map((l) => {
      const valueCount = count(l)
      return { l, valueCount, problems: problemsOf(l, valueCount) }
    })

    const q = opts.q?.trim().toLowerCase()
    const filtered = rows.filter(({ l, problems }) =>
      (!q || [l.shortLabel, l.prompt, l.slug].some((s) => s.toLowerCase().includes(q))) &&
      (!opts.groupId || l.group.id === opts.groupId) &&
      (opts.status === 'live' ? l.isActive : opts.status === 'hidden' ? !l.isActive : opts.status === 'attention' ? problems.length > 0 : true))
    const sort = opts.sort ?? 'updated'
    filtered.sort((a, b) =>
      sort === 'az' ? a.l.shortLabel.localeCompare(b.l.shortLabel)
        : sort === 'takes' ? b.l.popularityCount - a.l.popularityCount || a.l.shortLabel.localeCompare(b.l.shortLabel)
          : b.l.updatedAt.getTime() - a.l.updatedAt.getTime())

    const offset = Math.max(0, opts.offset ?? 0)
    const limit = Math.min(200, Math.max(1, opts.limit ?? 50))
    const groups = new Map<string, { id: string; label: string; count: number }>()
    for (const { l } of rows) {
      const g = groups.get(l.group.id) ?? { ...l.group, count: 0 }
      g.count++
      groups.set(l.group.id, g)
    }
    return {
      total: filtered.length,
      items: filtered.slice(offset, offset + limit).map(({ l, valueCount, problems }) => ({
        id: l.id, slug: l.slug, title: l.shortLabel, prompt: l.prompt, group: l.group, isActive: l.isActive,
        neverPublished: never.has(l.id), valueCount, takes: l.popularityCount, problem: problems[0] ?? null,
        ...card(l), updatedAt: l.updatedAt.toISOString(),
      })),
      groups: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)),
    }
  }

  async detail(id: string) {
    const [l] = await loadLists({ id })
    if (!l) return fail(404, 'List not found')
    const valueCount = (await valueCounts([l]))(l)
    const values = (await db.categoryEntity.findMany({
      where: { categoryId: id, isExcluded: false }, orderBy: { sortOrder: 'asc' },
      select: { entity: { select: { id: true, canonicalName: true, metadata: true } } },
    })).map((v) => ({ entityId: v.entity.id, name: v.entity.canonicalName, isNew: (v.entity.metadata as any)?.origin?.by === 'admin' }))

    const { decision, asset } = coverOf(l)
    return {
      id: l.id, slug: l.slug, title: l.shortLabel, prompt: l.prompt, group: l.group, entityType: l.entityType,
      parentEntity: l.parentEntity ? { id: l.parentEntity.id, name: l.parentEntity.canonicalName } : null,
      isActive: l.isActive, isPremiumOnly: l.isPremiumOnly, isMatchSignal: l.isMatchSignal, orderingMode: l.orderingMode,
      minItems: l.minItems, maxItems: l.maxItems, curated: true,
      takes: l.popularityCount, neverPublished: (await neverPublishedIds([l])).has(l.id), valueCount,
      problems: problemsOf(l, valueCount), updatedAt: l.updatedAt.toISOString(),
      issues: flaggedIssues(l.metadata).map((i) => ({ code: QUALITY_PROBLEM[i.code] ?? i.code, detail: i.detail })),
      cover: {
        status: decision?.status ?? null,
        ...card(l),
        title: decision?.title ?? (asset?.metadata as any)?.title ?? null,
        credit: asset ? { creator: asset.creator ?? null, license: asset.license ?? null, attribution: asset.attribution ?? null, landingUrl: asset.landingUrl ?? null } : null,
        canRevert: !!decision?.replaced?.status,
      },
      coverSuggest: covers.suggestState(l.metadata),
      values,
    }
  }

  async create(input: { title?: string; prompt?: string; groupId?: string; entityTypeId?: string }, actor: Actor) {
    const title = input.title?.trim(), prompt = input.prompt?.trim()
    if (!title || !prompt || !input.groupId || !input.entityTypeId) return fail(400, 'Title, question, group and value type are required')
    if (!(await db.entityType.findFirst({ where: { id: input.entityTypeId, isActive: true } }))) fail(400, 'Choose an active value type')
    if (!(await db.categoryGroup.findUnique({ where: { id: input.groupId } }))) fail(400, 'Choose a group')
    if (await db.category.findFirst({ where: { shortLabel: title } })) fail(409, `A list called "${title}" already exists`)
    const base = key(title) || 'list'
    let slug = base
    for (let n = 2; await db.category.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`
    const created = await db.category.create({
      data: {
        slug, shortLabel: title, prompt, groupId: input.groupId, entityTypeId: input.entityTypeId,
        poolMode: 'CURATED', isActive: false, minItems: 1, maxItems: 5, orderingMode: 'RANKED',
        metadata: { adminEditedAt: new Date().toISOString(), createdBy: { by: 'admin', userId: actor.id } },
      },
    })
    await this.audit(actor, 'create_list', created.id, { title })
    await queueCatalogAudit()
    return this.detail(created.id)
  }

  async update(id: string, input: Record<string, unknown>, actor: Actor) {
    const l = await db.category.findUnique({ where: { id }, select: { id: true, metadata: true, isActive: true, maxItems: true, minItems: true, slug: true } })
    if (!l) return fail(404, 'List not found')
    const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string).trim() : undefined)
    const data: Record<string, unknown> = {}
    const title = str('title'), prompt = str('prompt'), slug = str('slug'), groupId = str('groupId')
    if (title !== undefined) data.shortLabel = title || fail(400, 'Title is required')
    if (prompt !== undefined) data.prompt = prompt || fail(400, 'Question is required')
    if (groupId !== undefined) data.groupId = (await db.categoryGroup.findUnique({ where: { id: groupId } }))?.id ?? fail(400, 'Unknown group')
    if (slug !== undefined && slug !== l.slug) {
      if (!/^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u.test(slug)) fail(400, 'Slug may contain only letters, numbers and single dashes')
      if (await db.category.findUnique({ where: { slug } })) fail(409, 'Another list already uses that slug')
      data.slug = slug
    }
    for (const k of ['isActive', 'isPremiumOnly', 'isMatchSignal'] as const) if (typeof input[k] === 'boolean') data[k] = input[k]
    if (input.orderingMode === 'RANKED' || input.orderingMode === 'UNRANKED') data.orderingMode = input.orderingMode
    for (const k of ['minItems', 'maxItems'] as const) {
      if (input[k] === undefined) continue
      const n = Number(input[k])
      if (!Number.isInteger(n) || n < 1 || n > 20) fail(400, `${k === 'minItems' ? 'Min' : 'Max'} picks must be 1–20`)
      data[k] = n
    }
    if (((data.minItems as number) ?? l.minItems) > ((data.maxItems as number) ?? l.maxItems)) fail(400, 'Min picks can\'t exceed max picks')

    const goingLive = data.isActive === true && !l.isActive
    if (goingLive) await this.assertReadyToGoLive(id, (data.maxItems as number) ?? l.maxItems)

    const now = new Date().toISOString()
    const meta = mergeRefMetadata(l.metadata, { adminEditedAt: now, ...(goingLive && !(l.metadata as any)?.firstLiveAt ? { firstLiveAt: now } : {}) })
    await db.category.update({ where: { id }, data: { ...data, metadata: meta } })
    await this.audit(actor, 'update_list', id, data)
    await queueCatalogAudit()
    return this.detail(id)
  }

  /** Live needs what users see: title and question (enforced on save), enough values, and a cover or an explicit "No cover". */
  private async assertReadyToGoLive(id: string, maxItems: number) {
    const [l] = await loadLists({ id })
    const missing: string[] = []
    const valueCount = (await valueCounts([l!]))(l!)
    if (valueCount < maxItems) missing.push(`at least ${maxItems} values (has ${valueCount})`)
    const { decision, asset } = coverOf(l!)
    if (!asset && decision?.status !== 'none') missing.push('a cover, or choose "No cover"')
    if (missing.length) fail(422, `Before going live, this list needs ${missing.join(' and ')}.`, { missing })
  }

  /** Replaces the list's values and their order. */
  async setValues(id: string, entityIds: unknown, actor: Actor) {
    if (!Array.isArray(entityIds) || entityIds.some((e) => typeof e !== 'string')) return fail(400, 'entityIds must be an array of ids')
    const ids = [...new Set(entityIds as string[])]
    const l = await db.category.findUnique({ where: { id }, select: { entityTypeId: true, metadata: true } })
    if (!l) return fail(404, 'List not found')
    const valid = await db.entity.count({ where: { id: { in: ids }, entityTypeId: l.entityTypeId, mergedIntoId: null } })
    if (valid !== ids.length) fail(400, 'Every value must be an unmerged value of this list\'s type')

    await db.$transaction([
      db.categoryEntity.deleteMany({ where: { categoryId: id } }),
      db.categoryEntity.createMany({ data: ids.map((entityId, sortOrder) => ({ categoryId: id, entityId, sortOrder })) }),
      db.category.update({ where: { id }, data: { metadata: mergeRefMetadata(l.metadata, { adminEditedAt: new Date().toISOString() }) } }),
    ])

    await this.audit(actor, 'set_list_values', id, { count: ids.length })
    await queueCatalogAudit()
    await this.maybeAutoCover(id, actor)
    return this.detail(id)
  }

  /**
   * + Add: an existing value by id, or a name. A name is matched the way user
   * submissions are (exact key, then ≥0.92 similarity) before anything is
   * created; a merely similar value comes back as `similar` for the admin to
   * pick or override with `create: true`. Created values are APPROVED (pending
   * ones are visible only to their submitter) and tagged metadata.origin.
   */
  async addValue(id: string, input: { entityId?: string; name?: string; create?: boolean }, actor: Actor) {
    const l = await db.category.findUnique({ where: { id }, select: { entityTypeId: true, curatedEntities: { where: { isExcluded: false }, select: { entityId: true }, orderBy: { sortOrder: 'asc' } } } })
    if (!l) return fail(404, 'List not found')
    const current = l.curatedEntities.map((c) => c.entityId)
    const add = async (entityId: string, status: 'existing' | 'created') => {
      if (current.includes(entityId)) {
        const { canonicalName } = await db.entity.findUniqueOrThrow({ where: { id: entityId }, select: { canonicalName: true } })
        fail(409, `"${canonicalName}" is already in this list`)
      }
      return { status, list: await this.setValues(id, [...current, entityId], actor) }
    }

    if (input.entityId) {
      const e = await db.entity.findFirst({ where: { id: input.entityId, entityTypeId: l.entityTypeId, mergedIntoId: null } })
      return add(e?.id ?? fail(400, 'Unknown value for this list\'s type'), 'existing')
    }
    const name = input.name?.trim().replace(/\s+/g, ' ')
    if (!name) return fail(400, 'A name is required')
    const slugs = [...new Set([key(name), legacyAsciiKey(name)])].filter(Boolean)
    const exact = await db.entity.findFirst({
      where: { entityTypeId: l.entityTypeId, status: 'APPROVED', OR: [{ slug: { in: slugs } }, { canonicalName: name }, { aliases: { some: { alias: name } } }] },
      select: { id: true, mergedIntoId: true },
    })
    if (exact) return add(exact.mergedIntoId ?? exact.id, 'existing')

    // Shortlist by word stems (first 4 letters), so a typo still finds its neighbour.
    const stems = [...new Set(name.split(' ').filter((w) => w.length >= 3).map((w) => w.slice(0, 4)))]
    const nearby = await db.entity.findMany({
      where: { entityTypeId: l.entityTypeId, status: 'APPROVED', mergedIntoId: null, OR: stems.flatMap((stem) => [{ canonicalName: { contains: stem } }, { aliases: { some: { alias: { contains: stem } } } }]) },
      take: 200, select: { id: true, canonicalName: true },
    })
    const best = nearby.map((e) => ({ e, score: similarity(name, e.canonicalName) })).sort((a, b) => b.score - a.score)[0]
    if (best && best.score >= 0.92) return add(best.e.id, 'existing')
    if (best && best.score >= 0.7 && !input.create) return { status: 'similar' as const, match: { entityId: best.e.id, name: best.e.canonicalName } }

    let slug = key(name)
    for (let n = 2; await db.entity.findUnique({ where: { entityTypeId_slug: { entityTypeId: l.entityTypeId, slug } } }); n++) slug = `${key(name)}-${n}`
    const created = await db.entity.create({
      data: {
        entityTypeId: l.entityTypeId, canonicalName: name, slug, sourceType: 'SEEDED', status: 'APPROVED',
        metadata: { origin: { by: 'admin', userId: actor.id, listId: id, at: new Date().toISOString() } },
      },
    })
    return add(created.id, 'created')
  }

  /** A list with enough values and no cover decision gets one automatically (applied only if it clears the bar). */
  async maybeAutoCover(id: string, actor: Actor) {
    const [l] = await loadLists({ id })
    if (!l) return
    const { decision, asset } = coverOf(l)
    if (decision || asset || l._count.curatedEntities < l.maxItems) return
    const state = covers.suggestState(l.metadata)
    if (state?.status === 'running' || state?.status === 'done') return
    await covers.suggest(id, actor, { autoApply: true })
  }

  private audit(actor: Actor, action: string, targetId: string, detail: object) {
    return db.adminAuditEvent.create({ data: { actorUserId: actor.id, actorRole: actor.role as any, action, targetType: 'category', targetId, metadata: detail as any } }).catch(() => {})
  }
}
