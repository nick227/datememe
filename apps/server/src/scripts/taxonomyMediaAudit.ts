import { readdirSync } from 'fs'
import { db } from '@project/db'
import { isServableAsset } from '../lib/mediaIntegrity'
import { localStorageConfig } from '../providers/localStorageConfig'
import { fixtures, retiredQids } from './taxonomyMediaFixtures'

// Read-only consistency check between what the database says about taxonomy
// media and what this deployment can actually serve. No network calls.
// Shared by audit-media.ts (report) and repair-taxonomy-media.ts (fix).

export type AssetFinding = {
  assetId: string
  entityId: string | null
  label: string
  primary: boolean
  publicUrl: string | null
  sourceId: string | null
  problem: 'unservable-url' | 'missing-file' | 'wrong-identity'
  expectedQid?: string
}

export type RefFinding = {
  refId: string
  entityId: string
  label: string
  externalId: string
  problem: 'stale-ref' | 'retired-qid'
  expectedQid?: string
}

export async function auditTaxonomyMedia() {
  const { baseUrl, directory } = localStorageConfig()
  const [assets, entities, refs] = await Promise.all([
    db.mediaAsset.findMany({
      select: { id: true, entityId: true, entityTypeId: true, categoryId: true, provider: true, sourceId: true, storageKey: true, publicUrl: true, sha256: true, isPrimary: true, metadata: true },
    }),
    db.entity.findMany({ select: { id: true, canonicalName: true, imageUrl: true, entityType: { select: { slug: true } } } }),
    db.entityExternalRef.findMany({ where: { provider: 'wikimedia' }, select: { id: true, entityId: true, externalId: true } }),
  ])

  const entityById = new Map(entities.map((e) => [e.id, e]))
  const label = (entityId: string | null) => {
    const e = entityId ? entityById.get(entityId) : undefined
    return e ? `${e.entityType.slug}:${e.canonicalName}` : '(type/list cover)'
  }
  const expectedQid = new Map<string, string>()
  const fixtureQid = new Map(fixtures.map((f) => [`${f.type}:${f.name}`, f.qid as string]))
  for (const e of entities) {
    const qid = fixtureQid.get(`${e.entityType.slug}:${e.canonicalName}`)
    if (qid) expectedQid.set(e.id, qid)
  }

  const assetFindings: AssetFinding[] = []
  const servableUrls = new Set<string>()
  for (const a of assets) {
    const base = { assetId: a.id, entityId: a.entityId, label: label(a.entityId), primary: a.isPrimary, publicUrl: a.publicUrl, sourceId: a.sourceId }
    const expected = a.entityId ? expectedQid.get(a.entityId) : undefined
    const servable = isServableAsset(a)
    if (servable && a.publicUrl) servableUrls.add(a.publicUrl)
    const wrongQid = a.provider === 'wikimedia' && a.sourceId && /^Q\d+$/.test(a.sourceId) &&
      (expected ? a.sourceId !== expected : !!retiredQids[a.sourceId])
    if (wrongQid) {
      assetFindings.push({ ...base, problem: 'wrong-identity', expectedQid: expected })
    } else if (!servable) {
      const foreign = !a.publicUrl || !a.publicUrl.startsWith(`${baseUrl}/`)
      assetFindings.push({ ...base, problem: foreign ? 'unservable-url' : 'missing-file' })
    }
  }

  const refFindings: RefFinding[] = []
  for (const r of refs) {
    const expected = expectedQid.get(r.entityId)
    const base = { refId: r.id, entityId: r.entityId, label: label(r.entityId), externalId: r.externalId }
    if (expected && r.externalId !== expected) refFindings.push({ ...base, problem: 'stale-ref', expectedQid: expected })
    else if (!expected && retiredQids[r.externalId]) refFindings.push({ ...base, problem: 'retired-qid' })
  }

  // Entity.imageUrl is a denormalized copy of its primary asset's URL.
  const deadEntityImages = entities
    .filter((e) => e.imageUrl && e.imageUrl.includes('/uploads/') && !servableUrls.has(e.imageUrl))
    .map((e) => ({ entityId: e.id, label: label(e.id), imageUrl: e.imageUrl! }))

  // The same bytes as the primary image of two different entities is almost
  // always a wrong identity on one of them.
  const byHash = new Map<string, Set<string>>()
  for (const a of assets) {
    if (!a.isPrimary || !a.entityId || !a.sha256) continue
    byHash.set(a.sha256, (byHash.get(a.sha256) ?? new Set()).add(label(a.entityId)))
  }
  const sharedHashes = [...byHash.entries()].filter(([, s]) => s.size > 1).map(([sha256, s]) => ({ sha256, entities: [...s] }))

  // Files on disk no MediaAsset points at. Profile photos live in the same
  // directory, so this is informational, never a deletion list.
  let unreferencedFiles: number | null = null
  try {
    const keys = new Set(assets.map((a) => a.storageKey))
    unreferencedFiles = readdirSync(directory).filter((f) => !keys.has(f)).length
  } catch {
    unreferencedFiles = null // directory absent here
  }

  const fixtureEntities = expectedQid.size
  const summary = {
    baseUrl,
    uploadsDir: directory,
    entities: entities.length,
    entitiesWithImage: entities.filter((e) => e.imageUrl).length,
    entitiesWithServableImage: entities.filter((e) => e.imageUrl && servableUrls.has(e.imageUrl)).length,
    deadEntityImages: deadEntityImages.length,
    assets: assets.length,
    primaryAssets: assets.filter((a) => a.isPrimary).length,
    typeCovers: assets.filter((a) => a.isPrimary && a.entityTypeId).length,
    listCovers: assets.filter((a) => a.isPrimary && a.categoryId).length,
    unservableUrlAssets: assetFindings.filter((f) => f.problem === 'unservable-url').length,
    missingFileAssets: assetFindings.filter((f) => f.problem === 'missing-file').length,
    wrongIdentityAssets: assetFindings.filter((f) => f.problem === 'wrong-identity').length,
    staleWikidataRefs: refFindings.filter((f) => f.problem === 'stale-ref').length,
    retiredWikidataRefs: refFindings.filter((f) => f.problem === 'retired-qid').length,
    sharedImageHashes: sharedHashes.length,
    fixtureEntitiesInDb: fixtureEntities,
    fixturesMissingFromDb: fixtures.length - fixtureEntities,
    unreferencedFilesOnDisk: unreferencedFiles,
  }
  const healthy = !summary.deadEntityImages && !assetFindings.length && !refFindings.length && !sharedHashes.length
  return { summary, healthy, assetFindings, refFindings, deadEntityImages, sharedHashes }
}
