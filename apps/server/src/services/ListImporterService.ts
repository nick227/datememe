import { z } from 'zod'
import { db } from '@project/db'

// Stable JSON schema for List generation
export const ListSeedInputV1 = z.object({
  schemaVersion: z.literal(1),
  groupSlug: z.string().describe('The slug of the CategoryGroup this belongs to (e.g. film-tv, music)'),
  entityTypeSlug: z.string().describe('The slug of the EntityType (e.g. movie, tv-show, band)'),
  title: z.string().describe('The clean noun-phrase title (e.g. Books, Top Movies)'),
  prompt: z.string().describe('The prompt question (e.g. What are your favorite books?)'),
  axes: z.array(z.string()).min(1).describe('The semantic axes for matching'),
  values: z.array(z.string()).min(8).describe('The entities to pre-populate (minimum 8)'),
  isAbstract: z.boolean().default(false).describe('Whether this category requires ICON media fallback instead of photos'),
  requiredTags: z.array(z.string()).optional().describe('Optional tags required for this category'),
})

export type ListSeedInput = z.infer<typeof ListSeedInputV1>

export type ImportReport = {
  status: 'SUCCESS' | 'DRY_RUN' | 'ERROR'
  categorySlug?: string
  entitiesCreated: string[]
  entitiesReused: string[]
  errors: string[]
}

export class ListImporterService {
  private slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  async importList(input: ListSeedInput, dryRun = false): Promise<ImportReport> {
    const report: ImportReport = {
      status: dryRun ? 'DRY_RUN' : 'SUCCESS',
      entitiesCreated: [],
      entitiesReused: [],
      errors: [],
    }

    try {
      // Validate schema
      const data = ListSeedInputV1.parse(input)

      // Dedupe & validation checks
      const categorySlug = this.slugify(data.title)
      report.categorySlug = categorySlug

      if (data.values.length < 8) {
        report.errors.push('List must contain at least 8 values.')
      }

      // Validate group and entity type
      const group = await db.categoryGroup.findUnique({ where: { slug: data.groupSlug } })
      if (!group) report.errors.push(`Group slug '${data.groupSlug}' not found.`)

      let entityType = await db.entityType.findUnique({ where: { slug: data.entityTypeSlug } })
      if (!entityType) {
        if (!dryRun) {
           entityType = await db.entityType.create({
             data: { slug: data.entityTypeSlug, label: data.entityTypeSlug, pluralLabel: data.entityTypeSlug + 's', icon: 'box' }
           })
        } else {
           entityType = { id: 'dry-run-id', slug: data.entityTypeSlug, label: data.entityTypeSlug, pluralLabel: data.entityTypeSlug + 's', icon: 'box', createdAt: new Date(), updatedAt: new Date() }
        }
      }

      if (report.errors.length > 0) {
        report.status = 'ERROR'
        return report
      }

      if (!dryRun) {
        // Execute Writes
        const category = await db.category.upsert({
          where: { slug: categorySlug },
          update: {},
          create: {
            groupId: group!.id,
            entityTypeId: entityType!.id,
            slug: categorySlug,
            prompt: data.prompt,
            shortLabel: data.title,
            minItems: 1,
            maxItems: 5,
            orderingMode: 'RANKED',
            axes: data.axes,
            isActive: true,
            metadata: data.isAbstract ? { mediaKind: 'ICON' } : {},
          }
        })
      }

      for (const val of data.values) {
        const entitySlug = this.slugify(val)
        
        const entity = await db.entity.findUnique({
          where: { entityTypeId_slug: { entityTypeId: entityType!.id, slug: entitySlug } }
        })
        
        if (entity) {
          report.entitiesReused.push(val)
        } else {
          if (!dryRun) {
            await db.entity.create({
              data: {
                entityTypeId: entityType!.id,
                canonicalName: val,
                slug: entitySlug,
                sourceType: 'SEEDED',
                status: 'APPROVED',
              }
            })
          }
          report.entitiesCreated.push(val)
        }
      }

      return report
    } catch (error: any) {
      report.status = 'ERROR'
      report.errors.push(error.message || 'Unknown error')
      return report
    }
  }
}
