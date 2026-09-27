import { hostname } from 'os'
import { db } from '@project/db'
import { TaxonomyMediaService } from '../services/TaxonomyMediaService'
import { resolveWikidataImage } from '../services/imageProviders/wikimedia'
import type { ImageCandidate } from '../services/imageProviders'
import { assertMediaWritesAreServable, isServableAsset } from '../lib/mediaIntegrity'
import { IDENTITY_PROVIDER, mergeRefMetadata, verification, verificationOf } from '../lib/wikidataIdentity'
import { fixtures } from './taxonomyMediaFixtures'
import { assignCategoryCovers } from '../lib/categoryCovers'

// Production media sync. Writes image files, so it runs only inside the
// server container (the guard below refuses anywhere else):
//
//   railway ssh --service server --environment production -- \
//     sh -c 'cd /app/apps/server && ./node_modules/.bin/tsx src/scripts/media-sync.ts'
//
// Idempotent and resumable — each run:
//   1. records the fixture identities (taxonomyMediaFixtures.ts) as verified refs
//   2. fetches an image for up to LIMIT verified identities that don't yet have
//      a servable one, skipping known no-image items for RECHECK_DAYS
//   3. attaches the fixture type/list covers that are missing
//   4. downloads list covers a person approved (covers:propose)
//   5. gives every other list its own cover from its choices, never a repeat
// Unverified identities are never touched. The last line is a machine-readable
// `MEDIA_SYNC {…}` summary with `remaining`; run again until it is 0.
// Exit 1 only for unexpected failures (rate limits, deleted items, bugs).

const LIMIT = parseInt(process.env.LIMIT || '60', 10)
const RECHECK_MS = parseInt(process.env.RECHECK_DAYS || '30', 10) * 86_400_000
const FORCE = process.env.FORCE === '1'
const DELAY_MS = 5000 // between Wikimedia fetches
const CLAIM_TTL_MS = 15 * 60_000 // well above one image's fetch + normalize time
const CLAIM_OWNER = `${process.env.RAILWAY_REPLICA_ID ?? hostname()}:${process.pid}`

const media = new TaxonomyMediaService()
const results: { label: string; status: string; reason?: string }[] = []

// Rejections the pipeline is designed to make — an image failing the quality
// gate, or an image file Commons no longer serves. Reported, not a failed run.
function isExpectedRejection(error: any) {
  if ([409, 413, 415].includes(error?.statusCode)) return true
  return /Image source returned (404|410)\b/.test(error?.message ?? '')
}

function candidateFromAsset(qid: string, asset: { metadata: unknown; sourceUrl: string | null; landingUrl: string | null; creator: string | null; license: string | null; licenseUrl: string | null; attribution: string | null }): ImageCandidate {
  const metadata = (asset.metadata ?? {}) as Record<string, any>
  return {
    provider: IDENTITY_PROVIDER, externalId: qid, title: metadata.title,
    previewUrl: metadata.previewUrl ?? asset.sourceUrl!, sourceUrl: asset.sourceUrl ?? undefined, landingUrl: asset.landingUrl ?? undefined,
    creator: metadata.creator ?? asset.creator ?? undefined, license: asset.license ?? undefined,
    licenseUrl: asset.licenseUrl ?? undefined, attribution: asset.attribution ?? undefined,
    importRule: 'IMPORT_ALLOWED', metadata,
  }
}

async function main() {
  // Before any DB write: a run whose files the server can't serve is worse than no run.
  assertMediaWritesAreServable()
  const actor = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!actor) throw new Error('Seed an ADMIN user first')

  async function attach(target: { entityId?: string; entityTypeId?: string; categoryId?: string }, candidate: ImageCandidate, label: string) {
    const previous = await db.mediaAsset.findFirst({ where: { ...target, isPrimary: true, provider: candidate.provider, sourceId: candidate.externalId } })
    if (previous && isServableAsset(previous)) return false
    await media.importAndAttach(target, { ...candidate, metadata: { ...candidate.metadata, previewUrl: candidate.previewUrl, verifiedIdentity: true } }, actor!.id, actor!.role)
    results.push({ label, status: 'imported' })
    return true
  }

  // 1. Fixture identities -> verified refs (DB only, no network).
  const types = new Map((await db.entityType.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]))
  const fixtureEntities = new Map<string, string>() // `${type}:${name}` -> entityId
  for (const f of fixtures) {
    const typeId = types.get(f.type)
    const entity = typeId && await db.entity.findFirst({ where: { entityTypeId: typeId, canonicalName: f.name }, select: { id: true } })
    if (!entity) continue
    fixtureEntities.set(`${f.type}:${f.name}`, entity.id)
    const where = { entityId_provider: { entityId: entity.id, provider: IDENTITY_PROVIDER } }
    const ref = await db.entityExternalRef.findUnique({ where })
    if (ref?.externalId === f.qid && verificationOf(ref.metadata)?.method === 'fixture') continue
    const metadata = mergeRefMetadata(ref?.metadata, { verification: verification('fixture') }, ref?.externalId === f.qid)
    await db.entityExternalRef.upsert({ where, update: { externalId: f.qid, metadata }, create: { entityId: entity.id, provider: IDENTITY_PROVIDER, externalId: f.qid, metadata } })
  }

  // 2. Verified identities still needing an image.
  const refs = await db.entityExternalRef.findMany({
    where: { provider: IDENTITY_PROVIDER, entity: { status: 'APPROVED', mergedIntoId: null } },
    select: { entityId: true, externalId: true, metadata: true, entity: { select: { canonicalName: true, entityType: { select: { slug: true } } } } },
    orderBy: { entityId: 'asc' },
  })
  const verified = refs.filter((r) => verificationOf(r.metadata) && /^Q\d+$/.test(r.externalId))
  const counts = { verifiedIdentities: verified.length, withImage: 0, knownNoImage: 0, processed: 0, imported: 0, rejected: 0, noImage: 0, failed: 0, locked: 0, remaining: 0 }
  const todo: typeof verified = []
  for (const ref of verified) {
    const asset = await db.mediaAsset.findFirst({ where: { entityId: ref.entityId, isPrimary: true, provider: IDENTITY_PROVIDER, sourceId: ref.externalId } })
    const check = (ref.metadata as any)?.imageCheck
    if (asset && isServableAsset(asset)) counts.withImage++
    else if (!FORCE && check && Date.now() - Date.parse(check.at) < RECHECK_MS) counts.knownNoImage++
    else todo.push(ref)
  }

  // Remember a no-image outcome so routine runs don't re-fetch it.
  const recordCheck = (ref: (typeof todo)[number], status: string, reason?: string) => db.entityExternalRef.update({
    where: { entityId_provider: { entityId: ref.entityId, provider: IDENTITY_PROVIDER } },
    data: { metadata: mergeRefMetadata(ref.metadata, { imageCheck: { status, at: new Date().toISOString(), ...(reason ? { reason } : {}) } }) },
  })
  for (const ref of todo.slice(0, LIMIT)) {
    const label = `${ref.entity.entityType.slug}:${ref.entity.canonicalName}`

    // Claim the entity so a concurrent sync doesn't fetch it too. A claim older
    // than CLAIM_TTL_MS belongs to a run that died mid-image (SSH drop,
    // redeploy) and is taken over rather than blocking the entity forever.
    await db.mediaSyncClaim.deleteMany({ where: { entityId: ref.entityId, startedAt: { lt: new Date(Date.now() - CLAIM_TTL_MS) } } })
    try {
      await db.mediaSyncClaim.create({ data: { entityId: ref.entityId, status: 'RUNNING', lockedBy: CLAIM_OWNER } })
    } catch (error: any) {
      if (error.code === 'P2002') {
        counts.locked++
        results.push({ label, status: 'skipped-locked' })
        continue
      }
      throw error
    }

    counts.processed++
    try {
      const candidate = await resolveWikidataImage(ref.externalId)
      if (!candidate || candidate.importRule !== 'IMPORT_ALLOWED') {
        const status = candidate ? 'rights-review-required' : 'missing-image'
        await recordCheck(ref, status)
        counts.noImage++
        results.push({ label, status })
      } else {
        await attach({ entityId: ref.entityId }, candidate, label)
        counts.imported++
      }
    } catch (error: any) {
      const reason = error?.message ?? String(error)
      if (isExpectedRejection(error)) {
        await recordCheck(ref, 'rejected', reason)
        counts.rejected++
        results.push({ label, status: 'rejected', reason })
      } else {
        counts.failed++
        results.push({ label, status: 'failed', reason })
      }
    } finally {
      await db.mediaSyncClaim.deleteMany({ where: { entityId: ref.entityId, lockedBy: CLAIM_OWNER } })
    }
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
  }
  counts.remaining = todo.length - counts.processed + counts.failed

  // 3. Fixture covers, from each cover entity's current image.
  for (const f of fixtures) {
    const entityId = fixtureEntities.get(`${f.type}:${f.name}`)
    const hasCover = 'cover' in f && f.cover
    const categories = 'categories' in f ? [...f.categories] : []
    if (!entityId || (!hasCover && !categories.length)) continue
    const asset = await db.mediaAsset.findFirst({ where: { entityId, isPrimary: true, provider: IDENTITY_PROVIDER, sourceId: f.qid } })
    if (!asset || !isServableAsset(asset)) continue
    const candidate = candidateFromAsset(f.qid, asset)
    try {
      if (hasCover) await attach({ entityTypeId: types.get(f.type)! }, candidate, `type:${f.type}`)
      for (const category of await db.category.findMany({ where: { entityTypeId: types.get(f.type)!, slug: { in: categories } } })) {
        // One image per list: skip if another list already shows this one.
        const taken = await db.mediaAsset.findFirst({ where: { isPrimary: true, sha256: asset.sha256, categoryId: { not: null }, NOT: { categoryId: category.id } } })
        if (!taken) await attach({ categoryId: category.id }, candidate, `list:${category.slug}`)
      }
    } catch (error: any) {
      counts.failed++
      results.push({ label: `cover:${f.name}`, status: 'failed', reason: error?.message ?? String(error) })
    }
  }

  // 4. Covers a person approved (covers:propose), downloaded at cover quality.
  const approvedCovers = { imported: 0, rejected: 0, failed: 0 }
  for (const c of await db.category.findMany({ where: { isActive: true }, select: { id: true, slug: true, metadata: true } })) {
    const cover = (c.metadata as any)?.cover
    if (cover?.status !== 'approved') continue
    const current = await db.mediaAsset.findFirst({ where: { categoryId: c.id, isPrimary: true, provider: cover.provider, sourceId: cover.id } })
    if (current && isServableAsset(current)) continue
    try {
      await media.importAndAttach({ categoryId: c.id }, {
        provider: cover.provider, externalId: cover.id, title: cover.title, previewUrl: cover.url, sourceUrl: cover.url, landingUrl: cover.landingUrl,
        creator: cover.creator, license: cover.license, licenseUrl: cover.licenseUrl, attribution: cover.attribution,
        importRule: 'IMPORT_ALLOWED', metadata: { approvedCover: true, source: cover.source },
      }, actor.id, actor.role, { maxDimension: 1600 })
      approvedCovers.imported++
      results.push({ label: `cover:${c.slug}`, status: 'imported' })
    } catch (error: any) {
      const reason = error?.message ?? String(error)
      isExpectedRejection(error) ? approvedCovers.rejected++ : (approvedCovers.failed++, counts.failed++)
      results.push({ label: `cover:${c.slug}`, status: isExpectedRejection(error) ? 'rejected' : 'failed', reason })
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  // 5. Every other list gets its own cover from its choices — never a repeat.
  const covers = { approved: approvedCovers, ...(await assignCategoryCovers()) }

  for (const r of results) console.log(`${r.status.padEnd(22)} ${r.label}${r.reason ? ` — ${r.reason}` : ''}`)
  console.log(`MEDIA_SYNC ${JSON.stringify({ ...counts, covers })}`)
  if (counts.failed) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
