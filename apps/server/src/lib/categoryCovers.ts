import { db } from '@project/db'
import { isServableAsset } from './mediaIntegrity'

// Every list card shows its category's own cover. Covers are chosen once and
// stored (a DERIVED_COVER MediaAsset pointing at an entity image's stored
// file — no new download), so the feed, Lists page, rankings and list builder
// all agree, and no two active categories share an image. Categories used to
// fall back to their entity type's cover, which put the same photo on every
// movie list and every music list.
//
// Choice order: the category's own curated choices in list order; for a broad
// category, its type's most-used entities. More popular categories choose
// first. When nothing unused is left the category stays imageless — the UI's
// placeholder beats a repeated photo.

export const DERIVED_COVER = 'DERIVED_COVER'

type Asset = { id: string; storageKey: string | null; publicUrl: string | null; sha256: string | null }
const imageKey = (a: Asset) => a.sha256 ?? a.publicUrl ?? a.id

export async function assignCategoryCovers(apply = true) {
  const counts = { categories: 0, kept: 0, assigned: 0, duplicatesRemoved: 0, staleRemoved: 0, uncovered: 0 }

  // Derived covers whose source image is gone (e.g. removed by repair) are dropped and re-chosen.
  const stale = new Set<string>()
  for (const d of await db.mediaAsset.findMany({ where: { sourceType: DERIVED_COVER }, select: { id: true, metadata: true } })) {
    const sourceId = (d.metadata as any)?.derivedFromAssetId
    const source = sourceId ? await db.mediaAsset.findUnique({ where: { id: sourceId } }) : null
    if (source?.isPrimary && source.entityId && isServableAsset(source)) continue
    stale.add(d.id)
    if (apply) await db.mediaAsset.delete({ where: { id: d.id } })
  }
  counts.staleRemoved = stale.size

  const categories = await db.category.findMany({
    where: { isActive: true },
    select: {
      id: true, slug: true, poolMode: true, entityTypeId: true, popularityCount: true, metadata: true,
      mediaAssets: { where: { isPrimary: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  // A cover a person approved always keeps its image; then more popular lists choose first.
  const decision = (c: { metadata: unknown }) => (c.metadata as any)?.cover?.status as 'approved' | 'none' | undefined
  categories.sort((a, b) => Number(decision(b) === 'approved') - Number(decision(a) === 'approved') || b.popularityCount - a.popularityCount || a.slug.localeCompare(b.slug))
  counts.categories = categories.length

  const used = new Set<string>()
  const needCover: typeof categories = []
  for (const category of categories) {
    const cover = category.mediaAssets[0]
    if (decision(category) === 'none') {
      // A person decided this list shows the placeholder.
      if (cover && cover.sourceType === DERIVED_COVER && apply) await db.mediaAsset.delete({ where: { id: cover.id } })
      continue
    }
    if (!cover || stale.has(cover.id) || !isServableAsset(cover)) {
      needCover.push(category)
    } else if (used.has(imageKey(cover))) {
      // Same image as a more popular category's cover: this one gets another.
      counts.duplicatesRemoved++
      if (apply) {
        if (cover.sourceType === DERIVED_COVER) await db.mediaAsset.delete({ where: { id: cover.id } })
        else await db.mediaAsset.update({ where: { id: cover.id }, data: { isPrimary: false } })
      }
      needCover.push(category)
    } else {
      used.add(imageKey(cover))
      counts.kept++
    }
  }

  for (const category of needCover) {
    const entityImages = category.poolMode === 'CURATED'
      ? (await db.categoryEntity.findMany({
          where: { categoryId: category.id },
          orderBy: { sortOrder: 'asc' },
          select: { entity: { select: { id: true, mergedIntoId: true, mediaAssets: { where: { isPrimary: true }, take: 1 } } } },
        })).filter((c) => !c.entity.mergedIntoId).map((c) => ({ entityId: c.entity.id, asset: c.entity.mediaAssets[0] }))
      : (await db.entity.findMany({
          where: { entityTypeId: category.entityTypeId, status: 'APPROVED', mergedIntoId: null, mediaAssets: { some: { isPrimary: true } } },
          orderBy: [{ usageCount: 'desc' }, { id: 'asc' }],
          take: 50,
          select: { id: true, mediaAssets: { where: { isPrimary: true }, take: 1 } },
        })).map((e) => ({ entityId: e.id, asset: e.mediaAssets[0] }))

    const pick = entityImages.find(({ asset }) => asset && isServableAsset(asset) && !used.has(imageKey(asset)))
    if (!pick?.asset) { counts.uncovered++; continue }
    const a = pick.asset
    used.add(imageKey(a))
    counts.assigned++
    if (!apply) continue
    await db.mediaAsset.create({
      data: {
        categoryId: category.id, isPrimary: true, sourceType: DERIVED_COVER,
        provider: a.provider, sourceId: a.sourceId, sourceUrl: a.sourceUrl, landingUrl: a.landingUrl,
        creator: a.creator, license: a.license, licenseUrl: a.licenseUrl, attribution: a.attribution, importRule: a.importRule,
        storageKey: a.storageKey, publicUrl: a.publicUrl, mimeType: a.mimeType, byteSize: a.byteSize, sha256: a.sha256,
        originalWidth: a.originalWidth, originalHeight: a.originalHeight,
        metadata: { derivedFromAssetId: a.id, derivedFromEntityId: pick.entityId },
      },
    })
  }
  return counts
}
