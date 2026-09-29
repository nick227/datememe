import { z } from 'zod'
import { db } from '@project/db'
import { key, legacyAsciiKey } from '../lib/identityKey'

// The portable list format AI generation produces (catalog/lists/*.json).
// AI proposes content only — names, titles, prompts. Every identity (slugs,
// entity resolution, types) is decided here, in code.
const valueName = z.union([z.string(), z.object({ name: z.string() })]).transform((v) => (typeof v === 'string' ? v : v.name).trim())

export const ListSeedInputV1 = z.object({
  schemaVersion: z.literal(1),
  groupSlug: z.string().describe('Slug of the CategoryGroup (e.g. film-tv, music)'),
  createGroup: z.object({ label: z.string() }).optional()
    .describe('Only when groupSlug is new on purpose; otherwise an unknown group is an error'),
  entityTypeSlug: z.string().describe('Slug of the EntityType (e.g. movie, tv-show, band)'),
  createEntityType: z.object({ label: z.string(), pluralLabel: z.string() }).optional()
    .describe('Only when entityTypeSlug is new on purpose; otherwise an unknown type is an error, not a silent new type'),
  title: z.string().min(1).describe('The clean noun-phrase title (e.g. Books, Top Movies)'),
  prompt: z.string().min(1).describe('The prompt question (e.g. What are your favorite books?)'),
  axes: z.array(z.string()).min(1).describe('The semantic axes for matching'),
  values: z.array(valueName).min(8).describe('Entity names to pre-populate (minimum 8)'),
  isAbstract: z.boolean().default(false).describe('Whether this category uses ICON media instead of photos'),
  requiredTags: z.array(z.string()).optional().describe('Optional tags required for this category'),
  pool: z.enum(['curated', 'entity-type']).default('curated')
    .describe("'curated' (default): the list's values are its choices. 'entity-type': every entity of the type — only for deliberately broad lists like Movies"),
  alsoExpands: z.array(z.string()).optional()
    .describe('Titles of existing lists that offer every value of this type and are meant to gain its new values (e.g. "Top Movies"). Any other such list fails validation'),
})

export type ListSeedInput = z.input<typeof ListSeedInputV1>

export type ImportReport = {
  status: 'SUCCESS' | 'DRY_RUN' | 'ERROR'
  title?: string
  categorySlug?: string
  categoryCreated: boolean
  entitiesCreated: string[]
  entitiesReused: string[]
  /** Values newly added to a curated category's choices. */
  choicesAdded: number
  warnings: string[]
  errors: string[]
}

// CategoryGroup slug -> SitePickGroup slug for auto-assignment.
const SITE_PICK_GROUPS: Record<string, string> = {
  'entertainment': 'film-tv', 'film-tv': 'film-tv', 'music': 'music', 'food-drink': 'food', 'food': 'food',
  'lifestyle-hobbies': 'craft', 'lifestyle': 'craft', 'tech': 'tech', 'creators': 'creators', 'gaming': 'gaming',
  'career': 'career', 'travel': 'travel', 'sports': 'sports', 'literature': 'books', 'books': 'books', 'craft': 'craft',
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export type BatchManifest = {
  entityTypeSlugs: Set<string>
  /** Groups some list in the batch declares with createGroup. */
  groupSlugs?: Set<string>
}

export class ListImporterService {
  /**
   * Validates and imports one list atomically. Safe to re-run: existing
   * categories and entities are reused, never modified — except that a curated
   * category gains any of the file's values it doesn't offer yet (additive only).
   */
  async importList(input: ListSeedInput, dryRun = false, batchManifest?: BatchManifest): Promise<ImportReport> {
    const report: ImportReport = { status: dryRun ? 'DRY_RUN' : 'SUCCESS', categoryCreated: false, entitiesCreated: [], entitiesReused: [], choicesAdded: 0, warnings: [], errors: [] }
    const parsed = ListSeedInputV1.safeParse(input)
    if (!parsed.success) {
      report.status = 'ERROR'
      report.errors.push(...parsed.error.issues.map((i) => `${i.path.join('.') || 'list'}: ${i.message}`))
      return report
    }
    const data = parsed.data
    report.title = data.title
    report.categorySlug = key(data.title)

    const seen = new Map<string, string>()
    for (const name of data.values) {
      const k = key(name)
      if (!k) report.errors.push(`Value "${name}" has no usable name`)
      else if (seen.has(k)) report.errors.push(`Duplicate value: "${name}" and "${seen.get(k)}"`)
      else seen.set(k, name)
    }

    try {
      const run = async (tx: Tx) => {
        let group = await tx.categoryGroup.findUnique({ where: { slug: data.groupSlug } })
        if (!group && !data.createGroup && !batchManifest?.groupSlugs?.has(data.groupSlug)) {
          report.errors.push(`Group '${data.groupSlug}' not found; add createGroup if it is meant to be new`)
        }
        let entityType = await tx.entityType.findUnique({ where: { slug: data.entityTypeSlug } })
        if (!entityType && !data.createEntityType && !batchManifest?.entityTypeSlugs.has(data.entityTypeSlug)) {
          report.errors.push(`Entity type '${data.entityTypeSlug}' not found; add createEntityType if it is meant to be new`)
        }
        if (report.errors.length) return

        // Existing categories keep whatever admins have since edited.
        // By slug, else by displayed title (older lists' slugs don't follow their titles: "Artists" is favorite-artists-all-time).
        const existing = await tx.category.findFirst({ where: { slug: { in: [...new Set([key(data.title), legacyAsciiKey(data.title)])] } } })
          ?? await tx.category.findFirst({ where: { shortLabel: data.title } })
        if (existing) report.categorySlug = existing.slug
        report.categoryCreated = !existing
        // Reusing a same-titled category of another type would put this list's
        // values somewhere the category never offers them.
        if (existing && existing.entityTypeId !== entityType?.id) {
          const actual = await tx.entityType.findUnique({ where: { id: existing.entityTypeId }, select: { slug: true } })
          report.errors.push(`Title matches existing category "${existing.shortLabel}" of type '${actual?.slug}', not '${data.entityTypeSlug}'; use that type or rename the list`)
          return
        }
        const curated = existing ? existing.poolMode === 'CURATED' : data.pool === 'curated'
        if (existing && !curated && data.pool === 'curated') {
          report.warnings.push(`"${existing.shortLabel}" offers every ${data.entityTypeSlug} instead of this list's values; run catalog-backfill-pools.ts`)
        }

        const names = [...seen.values()]
        const resolved = entityType ? await this.resolveEntities(tx, entityType.id, names, report) : new Map<string, string>()
        if (report.errors.length) return
        for (const name of names) (resolved.has(name) ? report.entitiesReused : report.entitiesCreated).push(name)
        const offered = existing && curated
          ? new Set((await tx.categoryEntity.findMany({ where: { categoryId: existing.id }, select: { entityId: true } })).map((c) => c.entityId))
          : new Set<string>()
        if (curated) report.choicesAdded = names.filter((n) => !offered.has(resolved.get(n) ?? '')).length
        // The database is the truth once an admin has edited a list (Admin → Lists):
        // a file never re-adds values the admin removed. Report the difference instead.
        const adminEditedAt = (existing?.metadata as any)?.adminEditedAt as string | undefined
        if (existing && adminEditedAt) {
          const missing = names.filter((n) => !offered.has(resolved.get(n) ?? ''))
          if (missing.length) report.warnings.push(`"${existing.shortLabel}" was edited in Admin (${adminEditedAt.slice(0, 10)}); file differs — not adding ${missing.length} value(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''}`)
          report.choicesAdded = 0
          report.entitiesCreated = []
          return
        }
        if (dryRun) return

        if (!group) {
          const last = await tx.categoryGroup.aggregate({ _max: { sortOrder: true } })
          group = await tx.categoryGroup.create({ data: { slug: data.groupSlug, label: data.createGroup!.label, sortOrder: (last._max.sortOrder ?? 0) + 1 } })
        }
        if (!entityType) {
          entityType = await tx.entityType.create({ data: { slug: data.entityTypeSlug, label: data.createEntityType!.label, pluralLabel: data.createEntityType!.pluralLabel, icon: 'box' } })
        }
        let categoryId = existing?.id
        if (!existing) {
          const category = await tx.category.create({
            data: {
              groupId: group!.id, entityTypeId: entityType.id, slug: report.categorySlug!, prompt: data.prompt, shortLabel: data.title,
              minItems: 1, maxItems: 5, orderingMode: 'RANKED', axes: data.axes, isActive: true,
              poolMode: data.pool === 'curated' ? 'CURATED' : 'FILTERED',
              metadata: data.isAbstract ? { mediaKind: 'ICON' } : {},
            },
          })
          categoryId = category.id
          const sitePickGroup = SITE_PICK_GROUPS[group!.slug] && await tx.sitePickGroup.findUnique({ where: { slug: SITE_PICK_GROUPS[group!.slug] } })
          if (sitePickGroup) {
            await tx.sitePickItem.upsert({
              where: { groupId_categoryId: { groupId: sitePickGroup.id, categoryId: category.id } },
              update: {},
              create: { groupId: sitePickGroup.id, categoryId: category.id, sortOrder: 0 },
            })
          }
        }
        for (const name of report.entitiesCreated) {
          const entity = await tx.entity.create({ data: { entityTypeId: entityType.id, canonicalName: name, slug: key(name), sourceType: 'SEEDED', status: 'APPROVED' } })
          resolved.set(name, entity.id)
        }
        if (curated) {
          // The list's values are the category's choices, in the file's order.
          const start = ((await tx.categoryEntity.aggregate({ where: { categoryId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1
          await tx.categoryEntity.createMany({
            data: names.filter((n) => !offered.has(resolved.get(n)!)).map((n, i) => ({ categoryId: categoryId!, entityId: resolved.get(n)!, sortOrder: start + i })),
            skipDuplicates: true,
          })
        }
      }
      if (dryRun) await run(db as unknown as Tx)
      else await db.$transaction(run, { timeout: 60_000 })
    } catch (error: any) {
      report.errors.push(error?.message ?? String(error))
    }
    if (report.errors.length) report.status = 'ERROR'
    return report
  }

  /**
   * New values join their type, so an existing list that offers every value of
   * it (not curated, no required tags) silently gains them — batches reusing
   * pet-peeve grew Workplace Pet Peeves from 10 to 45 choices. For each such
   * list, errors on the batch's lists that would create values of the type,
   * unless a list of that type in the batch names it in alsoExpands (title or slug).
   */
  async fullTypeExposures(batch: { list: ListSeedInput; report: ImportReport }[]) {
    const types = new Map<string, { created: Set<string>; creators: ImportReport[]; ack: Set<string> }>()
    for (const { list, report } of batch) {
      const t = types.get(list.entityTypeSlug) ?? { created: new Set<string>(), creators: [], ack: new Set<string>() }
      for (const a of list.alsoExpands ?? []) t.ack.add(a.toLowerCase())
      if (report.status !== 'ERROR' && report.entitiesCreated.length) {
        report.entitiesCreated.forEach((n) => t.created.add(key(n)))
        t.creators.push(report)
      }
      types.set(list.entityTypeSlug, t)
    }
    for (const [slug, t] of types) {
      if (!t.created.size) continue
      const type = await db.entityType.findUnique({ where: { slug }, select: { id: true } })
      if (!type) continue // created by this batch: no list offers it yet
      const exposed = await db.category.findMany({
        where: { entityTypeId: type.id, isActive: true, poolMode: { not: 'CURATED' }, requiredTags: { none: {} } },
        select: { slug: true, shortLabel: true },
      })
      if (!exposed.length) continue
      const now = await db.entity.count({ where: { entityTypeId: type.id, status: 'APPROVED', mergedIntoId: null } })
      for (const c of exposed.filter((c) => !t.ack.has(c.shortLabel.toLowerCase()) && !t.ack.has(c.slug))) {
        const error = `Adds ${t.created.size} value(s) to type '${slug}', which "${c.shortLabel}" offers in full; publishing would expand it from ${now} to ${now + t.created.size} choices. Curate it (catalog-backfill-pools.ts), or add "alsoExpands": ["${c.shortLabel}"] if it is meant to grow`
        for (const r of t.creators) { r.errors.push(error); r.status = 'ERROR' }
      }
    }
  }

  /**
   * Existing entity per name: same key (or the legacy ASCII key), exact
   * canonical name, or exact alias — following merges. A name matching two
   * different entities is an error for a human to settle, never a guess.
   */
  private async resolveEntities(tx: Tx, entityTypeId: string, names: string[], report: ImportReport) {
    const resolved = new Map<string, string>()
    for (const name of names) {
      const matches = await tx.entity.findMany({
        where: {
          entityTypeId,
          OR: [
            { slug: { in: [...new Set([key(name), legacyAsciiKey(name)])].filter(Boolean) } },
            { canonicalName: name },
            { aliases: { some: { alias: name } } },
          ],
        },
        select: { id: true, canonicalName: true, mergedIntoId: true },
      })
      const ids = new Set(matches.map((m) => m.mergedIntoId ?? m.id))
      if (ids.size > 1) report.errors.push(`"${name}" matches ${ids.size} existing entities (${matches.map((m) => m.canonicalName).join(', ')}); disambiguate the name`)
      else if (ids.size === 1) resolved.set(name, [...ids][0]!)
    }
    return resolved
  }
}
