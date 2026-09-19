import { db, Prisma, type Entity } from '@project/db'
import { decodeOffsetCursor, encodeOffsetCursor, normalizeLimit } from '../lib/pagination'
import { similarity } from '../lib/levenshtein'
import { CATEGORY_INCLUDE, ENTITY_SELECT, serializeCategory, serializeEntity } from '../lib/serializers'

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export class TaxonomyService {
  async listEntityTypes() {
    return db.entityType.findMany({ orderBy: { label: 'asc' }, take: 500 })
  }

  async listCategoryGroups() {
    return db.categoryGroup.findMany({ orderBy: { sortOrder: 'asc' }, take: 500 })
  }

  async listCategories(groupSlug?: string) {
    const categories = await db.category.findMany({
      where: { status: 'APPROVED', ...(groupSlug ? { group: { slug: groupSlug } } : {}) },
      include: CATEGORY_INCLUDE,
      orderBy: [{ group: { sortOrder: 'asc' } }, { shortLabel: 'asc' }],
      take: 500,
    })
    return categories.map(serializeCategory)
  }

  async getCategory(slug: string) {
    const category = await db.category.findUnique({ where: { slug }, include: CATEGORY_INCLUDE })
    if (!category) throw { statusCode: 404, message: 'Category not found' }
    return serializeCategory(category)
  }

  /**
   * Autocomplete for a category's entity pool: same EntityType, ALL of the category's
   * requiredTags (AND-only — docs §4.4), APPROVED status or the viewer's own
   * PENDING/REJECTED submissions (visibility rule, docs §5.3).
   */
  async searchCategoryEntities(
    categorySlug: string,
    viewerProfileId: string,
    opts: { q?: string; cursor?: string; limit?: number },
  ) {
    const category = await db.category.findUnique({
      where: { slug: categorySlug },
      include: { requiredTags: true },
    })
    if (!category) throw { statusCode: 404, message: 'Category not found' }

    const limit = normalizeLimit(opts.limit)
    const offset = decodeOffsetCursor(opts.cursor)

    const tagFilters: Prisma.EntityWhereInput[] = category.requiredTags.map((rt) => ({
      tags: { some: { tagId: rt.tagId } },
    }))
    const statusOr: Prisma.EntityWhereInput[] = [
      { status: 'APPROVED' },
      { status: { in: ['PENDING', 'REJECTED'] }, submittedByProfileId: viewerProfileId },
    ]
    const searchOr: Prisma.EntityWhereInput[] | null = opts.q
      ? [{ canonicalName: { contains: opts.q } }, { aliases: { some: { alias: { contains: opts.q } } } }]
      : null

    const rows = await db.entity.findMany({
      where: {
        entityTypeId: category.entityTypeId,
        AND: [...tagFilters, { OR: statusOr }, ...(searchOr ? [{ OR: searchOr }] : [])],
      },
      // Alphabetically APPROVED < PENDING < REJECTED, so this also puts live entities
      // first without a separate CASE expression — documented, not accidental.
      orderBy: [{ status: 'asc' }, { usageCount: 'desc' }, { canonicalName: 'asc' }],
      skip: offset,
      take: limit + 1,
      select: ENTITY_SELECT,
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    return {
      data: items.map(serializeEntity),
      meta: { hasMore, nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null },
    }
  }

  /** See docs/data-schema-proposal.md §5.3 for the full flow this implements. */
  async submitEntity(submitterProfileId: string, entityTypeId: string, rawText: string) {
    const entityType = await db.entityType.findUnique({ where: { id: entityTypeId } })
    if (!entityType) throw { statusCode: 404, message: 'Entity type not found' }

    const baseSlug = slugify(rawText)

    // 1. Exact-slug match against an already-APPROVED entity — short-circuit, no new rows.
    const exact = await db.entity.findUnique({ where: { entityTypeId_slug: { entityTypeId, slug: baseSlug } } })
    if (exact && exact.status === 'APPROVED') {
      return { id: `existing:${exact.id}`, status: 'APPROVED' as const, submittedEntity: serializeEntity(exact), suggestedMatch: null }
    }

    // 2. Fuzzy shortlist (contains-match, scored with Levenshtein) for a suggestedMatch
    //    and a high-confidence short-circuit.
    const candidates = await db.entity.findMany({
      where: {
        entityTypeId,
        status: 'APPROVED',
        OR: [{ canonicalName: { contains: rawText } }, { aliases: { some: { alias: { contains: rawText } } } }],
      },
      take: 20,
      select: ENTITY_SELECT,
    })
    let best: { entity: Entity; score: number } | null = null
    for (const candidate of candidates) {
      const score = similarity(rawText, candidate.canonicalName)
      if (!best || score > best.score) best = { entity: candidate, score }
    }
    if (best && best.score >= 0.92) {
      return {
        id: `existing:${best.entity.id}`,
        status: 'APPROVED' as const,
        submittedEntity: serializeEntity(best.entity),
        suggestedMatch: null,
      }
    }

    // 3. No confident match — create a PENDING entity. Avoid colliding with a slug someone
    //    else's still-unreviewed submission already owns (duplicates get merged later).
    let slug = baseSlug
    let suffix = 2
    while (await db.entity.findUnique({ where: { entityTypeId_slug: { entityTypeId, slug } } })) {
      slug = `${baseSlug}-${suffix++}`
    }

    const suggestedMatchId: string | undefined = best ? best.entity.id : undefined

    const submission = await db.$transaction(async (tx) => {
      const entity = await tx.entity.create({
        data: {
          entityTypeId,
          canonicalName: rawText.trim(),
          slug,
          sourceType: 'USER_SUBMITTED',
          status: 'PENDING',
          submittedByProfileId: submitterProfileId,
        },
      })
      return tx.entitySubmission.create({
        data: {
          entityTypeId,
          rawText,
          submittedByProfileId: submitterProfileId,
          submittedEntityId: entity.id,
          suggestedMatchId,
          status: 'PENDING',
        },
        include: { submittedEntity: true, suggestedMatch: true },
      })
    })

    return {
      id: submission.id,
      status: submission.status,
      submittedEntity: serializeEntity(submission.submittedEntity),
      suggestedMatch: submission.suggestedMatch ? serializeEntity(submission.suggestedMatch) : null,
    }
  }
}
