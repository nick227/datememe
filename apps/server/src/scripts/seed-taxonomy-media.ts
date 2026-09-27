import { db } from '@project/db'
import { TaxonomyMediaService } from '../services/TaxonomyMediaService'
import { resolveWikidataImage } from '../services/imageProviders/wikimedia'
import type { ImageCandidate } from '../services/imageProviders'
import { assertMediaWritesAreServable, isServableAsset } from '../lib/mediaIntegrity'
import { fixtures } from './taxonomyMediaFixtures'

// Reviewed fallback titles: retain this provider's own identity and credit.
// These are image IDs, never external identities for the taxonomy entity.
const fallbacks: { name: string; type: string; id: string; title: string }[] = []

const media = new TaxonomyMediaService()

// Rejections the pipeline is designed to make — an image failing the quality
// gate, or an image file Commons no longer serves. Reported, but not a failed
// run; anything else (a deleted Wikidata item, rate limits, DB errors, bugs) is.
function isExpectedRejection(error: any) {
  if ([409, 413, 415].includes(error?.statusCode)) return true
  return /Image source returned (404|410)\b/.test(error?.message ?? '')
}
const report: object[] = []

async function openverse(id: string, expectedTitle: string): Promise<ImageCandidate> {
  const response = await fetch(`https://api.openverse.org/v1/images/${id}/`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Openverse ${response.status}`)
  const item = await response.json() as any
  if (item.title !== expectedTitle) throw new Error('Fallback identity changed; review required')
  return {
    provider: 'openverse', externalId: item.id, title: item.title,
    previewUrl: item.thumbnail, sourceUrl: item.url, landingUrl: item.foreign_landing_url,
    creator: item.creator, license: item.license, licenseUrl: item.license_url, attribution: item.attribution,
    width: item.width, height: item.height,
    importRule: ['cc0', 'pdm', 'by', 'by-sa'].includes(item.license) ? 'IMPORT_ALLOWED' : 'REVIEW_REQUIRED',
    metadata: { source: item.source, provider: item.provider, reviewedFixture: true },
  }
}

async function main() {
  // Before any DB write: a run whose files the server can't serve is worse than no run.
  assertMediaWritesAreServable()
  const actor = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!actor) throw new Error('Seed an ADMIN user first')
  async function attach(target: { entityId?: string; entityTypeId?: string; categoryId?: string }, candidate: ImageCandidate, label: string) {
    const metadata = { ...candidate.metadata, previewUrl: candidate.previewUrl, reviewedFixture: true }
    const previous = await db.mediaAsset.findFirst({ where: { ...target, isPrimary: true, provider: candidate.provider, sourceId: candidate.externalId } })
    if (previous && (previous.metadata as any)?.reviewedFixture && isServableAsset(previous)) {
      report.push({ label, status: 'already-imported', provider: candidate.provider })
      return
    }
    const asset = await media.importAndAttach(target, { ...candidate, metadata }, actor!.id, actor!.role)
    report.push({ label, status: 'imported', provider: candidate.provider, sourceId: candidate.externalId, sha256: asset.sha256 })
  }

  // Fixtures whose Wikidata item has no usable image are re-checked at most
  // this often (FORCE=1 overrides), so routine runs don't re-query ~100 items.
  const recheckMs = parseInt(process.env.RECHECK_DAYS || '30', 10) * 86_400_000
  const force = process.env.FORCE === '1'

  const start = parseInt(process.env.START || '0', 10)
  const limit = parseInt(process.env.LIMIT || '50', 10)
  const batch = fixtures.slice(start, start + limit)
  
  console.log(`Processing batch of ${batch.length} fixtures (Start: ${start}, Limit: ${limit})...`)

  for (const fixture of batch) {
    const type = await db.entityType.findUnique({ where: { slug: fixture.type } })
    const entity = type && await db.entity.findFirst({ where: { entityTypeId: type.id, canonicalName: fixture.name } })
    if (!type || !entity) { report.push({ label: fixture.name, status: 'missing-taxonomy-record' }); continue }
    let fetchedFromNetwork = false
    try {
      const priorRef = await db.entityExternalRef.findUnique({ where: { entityId_provider: { entityId: entity.id, provider: 'wikimedia' } } })
      const lastCheck = priorRef?.externalId === fixture.qid ? (priorRef.metadata as any)?.imageCheck : undefined
      if (!force && lastCheck && Date.now() - Date.parse(lastCheck.at) < recheckMs) {
        report.push({ label: fixture.name, status: `${lastCheck.status} (checked ${lastCheck.at.slice(0, 10)})`, qid: fixture.qid })
        continue
      }
      // Record the verified entity identity even when it has no usable image.
      await db.entityExternalRef.upsert({
        where: { entityId_provider: { entityId: entity.id, provider: 'wikimedia' } },
        create: { entityId: entity.id, provider: 'wikimedia', externalId: fixture.qid },
        update: { externalId: fixture.qid },
      })
      const cached = await db.mediaAsset.findFirst({ where: { entityId: entity.id, isPrimary: true, provider: 'wikimedia', sourceId: fixture.qid } })
      // A cached row is only a cache hit if its file is really served here;
      // otherwise re-fetch so the import repairs it.
      const candidate: ImageCandidate | null = cached && (cached.metadata as any)?.reviewedFixture && isServableAsset(cached) ? {
        provider: 'wikimedia', externalId: fixture.qid, title: (cached!.metadata as any).title,
        previewUrl: (cached!.metadata as any).previewUrl ?? cached!.sourceUrl!, sourceUrl: cached!.sourceUrl!, landingUrl: cached!.landingUrl ?? undefined,
        creator: cached!.creator ?? undefined, license: cached!.license ?? undefined,
        licenseUrl: cached!.licenseUrl ?? undefined, attribution: cached!.attribution ?? undefined,
        importRule: 'IMPORT_ALLOWED', metadata: cached!.metadata as any,
      } : await (async () => {
        fetchedFromNetwork = true;
        return resolveWikidataImage(fixture.qid)
      })()
      if (!candidate || candidate.importRule !== 'IMPORT_ALLOWED') {
        const status = candidate ? 'rights-review-required' : 'missing-image'
        await db.entityExternalRef.update({
          where: { entityId_provider: { entityId: entity.id, provider: 'wikimedia' } },
          data: { metadata: { imageCheck: { status, at: new Date().toISOString() } } },
        })
        report.push({ label: fixture.name, status, qid: fixture.qid })
        continue
      }
      await attach({ entityId: entity.id }, candidate, fixture.name)
      if ('cover' in fixture && fixture.cover) await attach({ entityTypeId: type.id }, candidate, `type:${fixture.type}`)
      const categories = await db.category.findMany({ where: { entityTypeId: type.id, ...( 'categories' in fixture ? { slug: { in: [...fixture.categories] } } : { id: '__none__' }) } })
      for (const category of categories) await attach({ categoryId: category.id }, candidate, `list:${category.slug}`)
    } catch (error: any) {
      report.push({ label: fixture.name, status: isExpectedRejection(error) ? 'rejected' : 'failed-import', reason: error.message ?? String(error) })
    } finally {
      // Avoid hammering public APIs — including after a `continue` above.
      // Failures stay visible, never become blind matches.
      if (fetchedFromNetwork) await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  for (const fixture of fallbacks) {
    const entity = await db.entity.findFirst({ where: { canonicalName: fixture.name, entityType: { slug: fixture.type } } })
    if (!entity) continue
    try { await attach({ entityId: entity.id }, await openverse(fixture.id, fixture.title), fixture.name) }
    catch (error: any) { report.push({ label: fixture.name, status: 'failed-fallback', reason: error.message }) }
  }

  // Quarantine the exact mismatches identified in the prior automatic seed.
  // Keep the assets and their provenance for review; only remove primary status.
  const mismatchedIds = ['cab90ed5-cf34-484b-8f83-e8f2f842c100', '4d09bf13-6ae2-409b-a955-14cc1702cdbe', 'f97b4eef-0908-4503-b79c-c75669f26b84', '2900c00a-5cd7-46bb-bdf0-03dd049b1440', 'bea82445-88cf-42ae-9f0c-29eaef5a58c7', 'c63256b9-399d-47aa-a090-91b2abb1306e', '0d16e586-0375-40b2-8268-4a6152e57cd6', 'dbe122bb-9dc6-4fa9-a672-7532c953baa7', '12275dfb-0595-4093-b4f2-994a2dc0616e', '9237a56c-1d21-49c1-8c33-61f057bdd2b9', 'f4bcdd3e-1650-4a08-b346-a7147b60ab92']
  const wrong = await db.mediaAsset.findMany({ where: { provider: 'openverse', sourceId: { in: mismatchedIds }, isPrimary: true } })
  for (const asset of wrong) {
    await db.$transaction(async (tx) => {
      await tx.mediaAsset.update({ where: { id: asset.id }, data: { isPrimary: false } })
      if (asset.entityId) await tx.entity.update({ where: { id: asset.entityId }, data: { imageUrl: null } })
      await tx.adminAuditEvent.create({ data: { actorUserId: actor.id, actorRole: actor.role, action: 'quarantine_mismatched_thumbnail', targetType: 'media_asset', targetId: asset.id, beforeValue: { isPrimary: true }, afterValue: { isPrimary: false } } })
    })
  }
  const itemsToClear = [...fixtures, ...fallbacks]
  for (const f of itemsToClear) {
    await db.entityExternalRef.deleteMany({ where: { provider: 'openverse', entity: { canonicalName: f.name, entityType: { slug: f.type } } } })
  }
  console.log(JSON.stringify({ results: report, quarantined: wrong.length, primaryAssets: await db.mediaAsset.count({ where: { isPrimary: true } }) }, null, 2))
  const summary = (report as { status: string }[]).reduce<Record<string, number>>((acc, r) => {
    const status = r.status.replace(/ \(checked .*\)$/, '')
    return { ...acc, [status]: (acc[status] ?? 0) + 1 }
  }, {})
  console.log('Summary:', JSON.stringify(summary))
  if (report.some((r: any) => r.status.startsWith('failed'))) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
