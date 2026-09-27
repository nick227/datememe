import { z } from 'zod'
import { db } from '@project/db'
import { key, legacyAsciiKey } from '../lib/identityKey'

// The portable list format AI generation produces (catalog/lists/*.json).
// AI proposes content only — names, titles, prompts. Every identity (slugs,
// entity resolution, types) is decided here, in code.
const valueName = z.union([z.string(), z.object({ name: z.string() })]).transform((v) => (typeof v === 'string' ? v : v.name).trim())

export const ListSeedInputV1 = z.object({
  schemaVersion: z.literal(1),
  groupSlug: z.string().describe('Slug of an existing CategoryGroup (e.g. film-tv, music)'),
  entityTypeSlug: z.string().describe('Slug of the EntityType (e.g. movie, tv-show, band)'),
  createEntityType: z.object({ label: z.string(), pluralLabel: z.string() }).optional()
    .describe('Only when entityTypeSlug is new on purpose; otherwise an unknown type is an error, not a silent new type'),
  title: z.string().min(1).describe('The clean noun-phrase title (e.g. Books, Top Movies)'),
  prompt: z.string().min(1).describe('The prompt question (e.g. What are your favorite books?)'),
  axes: z.array(z.string()).min(1).describe('The semantic axes for matching'),
  values: z.array(valueName).min(8).describe('Entity names to pre-populate (minimum 8)'),
  isAbstract: z.boolean().default(false).describe('Whether this category uses ICON media instead of photos'),
  requiredTags: z.array(z.string()).optional().describe('Optional tags required for this category'),
})

export type ListSeedInput = z.input<typeof ListSeedInputV1>

export type ImportReport = {
  status: 'SUCCESS' | 'DRY_RUN' | 'ERROR'
  title?: string
  categorySlug?: string
  categoryCreated: boolean
  entitiesCreated: string[]
  entitiesReused: string[]
  errors: string[]
}

// CategoryGroup slug -> SitePickGroup slug for auto-assignment.
const SITE_PICK_GROUPS: Record<string, string> = {
  'entertainment': 'film-tv', 'film-tv': 'film-tv', 'music': 'music', 'food-drink': 'food', 'food': 'food',
  'lifestyle-hobbies': 'craft', 'lifestyle': 'craft', 'tech': 'tech', 'creators': 'creators', 'gaming': 'gaming',
  'career': 'career', 'travel': 'travel', 'sports': 'sports', 'literature': 'books', 'books': 'books', 'craft': 'craft',
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0]

export class ListImporterService {
  /** Validates and imports one list atomically. Safe to re-run: existing categories and entities are reused, never modified. */
  async importList(input: ListSeedInput, dryRun = false): Promise<ImportReport> {
    const report: ImportReport = { status: dryRun ? 'DRY_RUN' : 'SUCCESS', categoryCreated: false, entitiesCreated: [], entitiesReused: [], errors: [] }
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
        const group = await tx.categoryGroup.findUnique({ where: { slug: data.groupSlug } })
        if (!group) report.errors.push(`Group '${data.groupSlug}' not found`)
        let entityType = await tx.entityType.findUnique({ where: { slug: data.entityTypeSlug } })
        if (!entityType && !data.createEntityType) {
          report.errors.push(`Entity type '${data.entityTypeSlug}' not found; add createEntityType if it is meant to be new`)
        }
        if (report.errors.length) return

        // Existing categories keep whatever admins have since edited.
        const existing = await tx.category.findFirst({ where: { slug: { in: [...new Set([key(data.title), legacyAsciiKey(data.title)])] } } })
        if (existing) report.categorySlug = existing.slug
        report.categoryCreated = !existing

        const names = [...seen.values()]
        const resolved = entityType ? await this.resolveEntities(tx, entityType.id, names, report) : new Map<string, string>()
        if (report.errors.length) return
        for (const name of names) (resolved.has(name) ? report.entitiesReused : report.entitiesCreated).push(name)
        if (dryRun) return

        if (!entityType) {
          entityType = await tx.entityType.create({ data: { slug: data.entityTypeSlug, label: data.createEntityType!.label, pluralLabel: data.createEntityType!.pluralLabel, icon: 'box' } })
        }
        if (!existing) {
          const category = await tx.category.create({
            data: {
              groupId: group!.id, entityTypeId: entityType.id, slug: report.categorySlug!, prompt: data.prompt, shortLabel: data.title,
              minItems: 1, maxItems: 5, orderingMode: 'RANKED', axes: data.axes, isActive: true,
              metadata: data.isAbstract ? { mediaKind: 'ICON' } : {},
            },
          })
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
          await tx.entity.create({ data: { entityTypeId: entityType.id, canonicalName: name, slug: key(name), sourceType: 'SEEDED', status: 'APPROVED' } })
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
