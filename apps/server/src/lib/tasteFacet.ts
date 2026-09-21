import { db, QuickPickContextType } from '@project/db'

/**
 * One generic axis for Discover's taste filter, instead of a dedicated
 * DiscoveryService parameter per taxonomy depth. Reuses the DB's own
 * `QuickPickContextType` enum (CATEGORY/ENTITY_TYPE/PARENT_ENTITY/TAG) as the
 * kind vocabulary — Quick Picks' comparison-pool traversal and Discover's
 * taste filter are two different *uses* of taxonomy depth, but they used to
 * describe that depth with two separate, drifting enums ('group'|'tag'|
 * 'entityType' here vs. the DB's own type). Now there is exactly one
 * taxonomy-kind vocabulary in the codebase.
 *
 * `GROUP` (CategoryGroup) is the one addition on top of that enum: a
 * CategoryGroup spans many Categories ("Music" contains "Top 90s Bands",
 * "Favorite Artists", ...), a layer QuickPickContextType has no reason to
 * model since a quiz pair always lives inside one eligibility pool, never
 * "any category in this broad topic". It's Discover's current chip-bar
 * granularity; CATEGORY/ENTITY_TYPE/PARENT_ENTITY/TAG are the deeper axes
 * this same filter can already resolve today, ready for a future chip like
 * "Music -> Punk" (TAG or PARENT_ENTITY) or "Cars -> Japanese Cars"
 * (PARENT_ENTITY) without DiscoveryService or its API contract changing at all.
 */
export type TasteFacetKind = QuickPickContextType | 'GROUP'
export type TasteFacet = { kind: TasteFacetKind; slug: string }

const VALID_KINDS: TasteFacetKind[] = ['GROUP', 'CATEGORY', 'ENTITY_TYPE', 'PARENT_ENTITY', 'TAG']

/** Parses "kind:slug" (e.g. "group:music", "tag:punk"), case-insensitively on the kind. Returns null for anything malformed rather than throwing — an unrecognized filter should degrade to "no filter", not 400. */
export function parseTasteFacet(raw?: string): TasteFacet | null {
  if (!raw) return null
  const separatorIndex = raw.indexOf(':')
  if (separatorIndex < 0) return null
  const kind = raw.slice(0, separatorIndex).toUpperCase() as TasteFacetKind
  const slug = raw.slice(separatorIndex + 1)
  if (!slug || !VALID_KINDS.includes(kind)) return null
  return { kind, slug }
}

/**
 * Profile ids with real *engagement* in this facet (a started or completed
 * List touching it) — pool membership, not a compatibility signal. Whether
 * two engaged people actually share taste is decided separately, from their
 * real overlapping picks (see ContentFeedService's taste-graph matching).
 *
 * Slugs, not raw ids, identify the facet — a nicer, stable shape for a
 * client-facing filter query param than QuickPickSignal's own internal
 * `contextId` convention (which is a raw cuid, fine for a value the client
 * never has to construct by hand).
 */
export async function getTasteEngagedProfileIds(facet: TasteFacet): Promise<string[]> {
  switch (facet.kind) {
    case 'GROUP': {
      const categoryIds = (await db.category.findMany({ where: { group: { slug: facet.slug } }, select: { id: true } })).map(
        (c) => c.id,
      )
      if (!categoryIds.length) return []
      const rows = await db.list.findMany({
        where: { categoryId: { in: categoryIds }, items: { some: {} } },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      return rows.map((r) => r.profileId)
    }
    case 'CATEGORY': {
      // Narrower than GROUP: engagement with one specific Category (e.g.
      // "Top 90s Bands"), not every category under its group.
      const rows = await db.list.findMany({
        where: { category: { slug: facet.slug }, items: { some: {} } },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      return rows.map((r) => r.profileId)
    }
    case 'TAG': {
      const rows = await db.list.findMany({
        where: { items: { some: { entity: { tags: { some: { tag: { slug: facet.slug } } } } } } },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      return rows.map((r) => r.profileId)
    }
    case 'ENTITY_TYPE': {
      const rows = await db.list.findMany({
        where: { category: { entityType: { slug: facet.slug } }, items: { some: {} } },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      return rows.map((r) => r.profileId)
    }
    case 'PARENT_ENTITY': {
      // The actual "Cars -> Japanese Cars" depth: anyone who's ranked any
      // child entity under a given parent Entity — the same parentId
      // hierarchy QuickPickService's own PARENT_ENTITY traversal walks.
      const parent = await db.entity.findFirst({ where: { slug: facet.slug }, select: { id: true } })
      if (!parent) return []
      const rows = await db.list.findMany({
        where: { items: { some: { entity: { parentId: parent.id } } } },
        select: { profileId: true },
        distinct: ['profileId'],
      })
      return rows.map((r) => r.profileId)
    }
  }
}
