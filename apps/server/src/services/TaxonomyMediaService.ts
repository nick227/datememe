import { createHash } from 'crypto'
import sharp from 'sharp'
import { db } from '@project/db'
import { createStorageProvider } from '../providers/storage'
import { assertMediaWritesAreServable, isServableAsset } from '../lib/mediaIntegrity'
import { mergeRefMetadata, verification, verificationOf } from '../lib/wikidataIdentity'
import { isApprovedImageHost } from '../lib/imageHosts'
import { cardVariant, measureImage } from '../lib/coverImage'
import { getImageProvider, imageProviders, type ImageCandidate } from './imageProviders'

const storage = createStorageProvider()
const MAX_REMOTE_BYTES = 12 * 1024 * 1024
const VARCHAR_LIMIT = 191 // Prisma's default String length on MySQL

// Commons credits can run to paragraphs; the column keeps a truncated copy and
// metadata keeps the full text.
function fitColumn(value: string | undefined) {
  return value && value.length > VARCHAR_LIMIT ? `${value.slice(0, VARCHAR_LIMIT - 1)}…` : value
}

type Target = { entityId?: string; entityTypeId?: string; categoryId?: string }

function targetWhere(target: Target) {
  if (target.entityId) return { entityId: target.entityId }
  if (target.entityTypeId) return { entityTypeId: target.entityTypeId }
  if (target.categoryId) return { categoryId: target.categoryId }
  throw { statusCode: 400, message: 'A taxonomy target is required' }
}

function assertTarget(target: Target) {
  if ([target.entityId, target.entityTypeId, target.categoryId].filter(Boolean).length !== 1) {
    throw { statusCode: 400, message: 'Exactly one taxonomy target is required' }
  }
}

export class TaxonomyMediaService {
  async search(query: string, entityTypeLabel?: string, parentPath?: string) {
    const cleanQuery = query.trim()
    if (!cleanQuery) throw { statusCode: 400, message: 'query is required' }

    const context = { query: cleanQuery, entityTypeLabel, parentPath }
    const results = await Promise.all(imageProviders.map(async (provider) => {
      try {
        return await provider.search(context)
      } catch {
        return []
      }
    }))

    return results.flat().slice(0, 60)
  }

  async uploadAndAttach(input: {
    target: Target
    buffer: Buffer
    originalName: string
    mimeType: string
    crop?: unknown
    sourceType?: string
    actorUserId: string
    actorRole: string
  }) {
    assertTarget(input.target)
    const normalized = await this.normalize(input.buffer, input.mimeType)
    const stored = await this.storeNormalized(normalized.buffer, input.originalName.replace(/\.[^.]+$/, '') + '.webp')
    return this.attachAsset(input.target, {
      sourceType: input.sourceType ?? 'UPLOAD',
      storageKey: stored.key,
      publicUrl: stored.url,
      mimeType: stored.mimeType,
      byteSize: stored.size,
      originalWidth: normalized.width,
      originalHeight: normalized.height,
      crop: input.crop,
      sha256: createHash('sha256').update(normalized.buffer).digest('hex'),
    }, input.actorUserId, input.actorRole)
  }

  /** `maxDimension`: list covers keep more resolution (1600) than value images (1000). */
  async importAndAttach(target: Target, candidate: ImageCandidate, actorUserId: string, actorRole: string, opts: { maxDimension?: number } = {}) {
    assertTarget(target)
    if (!getImageProvider(candidate.provider)) {
      throw { statusCode: 400, message: 'Unknown image provider' }
    }
    if (candidate.importRule !== 'IMPORT_ALLOWED') {
      throw { statusCode: 409, message: 'This provider result is not approved for import; use it as a reference or configure provider rights first.' }
    }
    const imageUrl = candidate.previewUrl || candidate.sourceUrl!
    let parsedUrl: URL
    try {
      parsedUrl = new URL(imageUrl)
    } catch {
      throw { statusCode: 400, message: 'Image source URL is invalid' }
    }
    if (!isApprovedImageHost(candidate.provider, parsedUrl.hostname)) {
      throw { statusCode: 400, message: 'Image source is not an approved provider host' }
    }
    const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': `Datememe/1.0 (${process.env.BASE_URL ?? 'https://datememe-server.up.railway.app'}; taxonomy image importer)` } })
    if (!response.ok) throw { statusCode: 502, message: `Image source returned ${response.status}` }
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_REMOTE_BYTES) throw { statusCode: 413, message: 'Remote image exceeds the import limit' }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > MAX_REMOTE_BYTES) throw { statusCode: 413, message: 'Remote image exceeds the import limit' }

    const normalized = await this.normalize(buffer, response.headers.get('content-type') ?? 'image/jpeg', opts.maxDimension)
    const stored = await this.storeNormalized(normalized.buffer, `${candidate.provider}-${candidate.externalId}.webp`)
    // List covers also get a 3:4 card crop and quality metrics.
    const cover = target.categoryId ? await this.coverExtras(buffer, normalized.buffer) : {}
    return this.attachAsset(target, {
      sourceType: 'PROVIDER_IMPORT',
      provider: candidate.provider,
      sourceId: candidate.externalId,
      sourceUrl: candidate.sourceUrl,
      landingUrl: candidate.landingUrl,
      creator: fitColumn(candidate.creator),
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
      attribution: candidate.attribution,
      importRule: candidate.importRule,
      originalWidth: normalized.width,
      originalHeight: normalized.height,
      storageKey: stored.key,
      publicUrl: stored.url,
      mimeType: stored.mimeType,
      byteSize: stored.size,
      metadata: { ...candidate.metadata, title: candidate.title, creator: candidate.creator, ...cover },
      sha256: createHash('sha256').update(normalized.buffer).digest('hex'),
    }, actorUserId, actorRole)
  }

  /**
   * A list cover's 3:4 card variant (attention-cropped from the best source
   * available) and its quality metrics, as asset metadata. Also used to
   * backfill covers that predate variants.
   */
  async coverExtras(source: Buffer, stored: Buffer) {
    const card = await cardVariant(source)
    const saved = await this.storeNormalized(card.buffer, 'card.webp')
    return { card: { storageKey: saved.key, publicUrl: saved.url, width: card.width, height: card.height }, quality: await measureImage(stored) }
  }

  async attachReference(target: Target, candidate: ImageCandidate, actorUserId: string, actorRole: string) {
    assertTarget(target)
    if (candidate.importRule === 'IMPORT_ALLOWED') {
      return this.importAndAttach(target, candidate, actorUserId, actorRole)
    }
    return this.attachAsset(target, {
      sourceType: 'PROVIDER_REFERENCE',
      provider: candidate.provider,
      sourceId: candidate.externalId,
      sourceUrl: candidate.sourceUrl,
      landingUrl: candidate.landingUrl,
      creator: fitColumn(candidate.creator),
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
      attribution: candidate.attribution,
      importRule: candidate.importRule,
      publicUrl: candidate.previewUrl,
      metadata: { ...candidate.metadata, title: candidate.title, creator: candidate.creator },
    }, actorUserId, actorRole)
  }

  private async normalize(buffer: Buffer, mimeType: string, maxDimension = 1000) {
    const baseMimeType = mimeType.split(';')[0] ?? ''
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(baseMimeType)) {
      throw { statusCode: 415, message: 'Only raster image formats can be used for taxonomy thumbnails' }
    }
    try {
      const source = sharp(buffer, { limitInputPixels: 40_000_000 })
      const metadata = await source.metadata()
      if (!metadata.width || !metadata.height) throw new Error('Missing image dimensions')
      if (metadata.width < 200 || metadata.height < 200) {
        throw { statusCode: 415, message: 'Image fails quality gate: must be at least 200x200 pixels' }
      }
      const aspectRatio = metadata.width / metadata.height
      if (aspectRatio < 0.4 || aspectRatio > 2.5) {
        throw { statusCode: 415, message: 'Image fails quality gate: extreme aspect ratio' }
      }
      const output = await source.rotate().resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      return { buffer: output, width: metadata.width, height: metadata.height }
    } catch (error: any) {
      // Keep the quality-gate reason (size, aspect ratio) rather than
      // reporting every rejection as a decode failure.
      if (error?.statusCode) throw error
      throw { statusCode: 415, message: `Image could not be decoded or normalized: ${error?.message ?? error}` }
    }
  }

  private async storeNormalized(buffer: Buffer, originalName: string) {
    assertMediaWritesAreServable()
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    // Share bytes with an identical earlier import, but only if that copy is
    // actually served by this deployment — never inherit a dead URL.
    const existing = (await db.mediaAsset.findMany({ where: { sha256, storageKey: { not: null } }, orderBy: { createdAt: 'asc' } }))
      .find(isServableAsset)
    if (existing?.storageKey && existing.publicUrl) {
      return { key: existing.storageKey, url: existing.publicUrl, mimeType: existing.mimeType!, size: existing.byteSize! }
    }
    return storage.upload({ buffer, originalName, mimeType: 'image/webp' })
  }

  private async attachAsset(target: Target, data: Record<string, unknown>, actorUserId: string, actorRole: string) {
    const where = targetWhere(target)
    const asset = await db.$transaction(async (tx) => {
      await tx.mediaAsset.updateMany({ where: { ...where, isPrimary: true }, data: { isPrimary: false } })
      // Re-importing the same source for the same target is idempotent. Separate
      // targets retain separate provenance rows while sharing the stored bytes.
      const sameSource = await tx.mediaAsset.findFirst({ where: {
        ...where,
        ...(data.sha256 ? { sha256: data.sha256 as string } : { publicUrl: data.publicUrl as string }),
        provider: (data.provider as string) ?? null,
        sourceId: (data.sourceId as string) ?? null,
      } })

      // Only entities compete for an image: a type or list cover deliberately
      // reuses one of its entities' images.
      if (data.sha256 && !sameSource && target.entityId) {
        const otherEntity = await tx.mediaAsset.findFirst({ 
          where: { 
            sha256: data.sha256 as string,
            entityId: { not: target.entityId },
            isPrimary: true
          } 
        })
        if (otherEntity) {
          throw { statusCode: 409, message: 'Image fails quality gate: duplicate image across unrelated entities' }
        }
      }

      const values = { ...target, ...data, isPrimary: true } as any
      const created = sameSource
        ? await tx.mediaAsset.update({ where: { id: sameSource.id }, data: values })
        : await tx.mediaAsset.create({ data: values })
      if (target.entityId) await tx.entity.update({ where: { id: target.entityId }, data: { imageUrl: created.publicUrl } })
      if (target.entityId && created.sourceId && (created.provider === 'tmdb' || (created.provider === 'wikimedia' && /^Q\d+$/.test(created.sourceId)))) {
        const where = { entityId_provider: { entityId: target.entityId, provider: created.provider! } }
        const existing = await tx.entityExternalRef.findUnique({ where })
        const sameIdentity = existing?.externalId === created.sourceId
        // Keep how the identity was verified; attaching an image for a
        // different QID (admin UI) is itself the verification.
        const metadata = mergeRefMetadata(existing?.metadata, {
          ...(created.metadata as Record<string, unknown> ?? {}),
          verification: (sameIdentity && verificationOf(existing?.metadata)) || verification('admin'),
        }, sameIdentity)
        await tx.entityExternalRef.upsert({
          where,
          update: { externalId: created.sourceId, metadata: metadata as any },
          create: { entityId: target.entityId, provider: created.provider!, externalId: created.sourceId, metadata: metadata as any },
        })
      }
      return created
    })

    await db.adminAuditEvent.create({
      data: {
        actorUserId,
        actorRole: actorRole as any,
        action: 'attach_taxonomy_image',
        targetType: target.entityId ? 'entity' : target.entityTypeId ? 'entity_type' : 'category',
        targetId: target.entityId ?? target.entityTypeId ?? target.categoryId ?? null,
        afterValue: { mediaAssetId: asset.id, provider: asset.provider, sourceType: asset.sourceType },
      },
    })
    return asset
  }

  async listAssets(target: Target) {
    assertTarget(target)
    return db.mediaAsset.findMany({ where: targetWhere(target), orderBy: { createdAt: 'desc' } })
  }
}

export { getImageProvider }
