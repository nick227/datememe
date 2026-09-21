import { db } from '@project/db'
import { TaxonomyMediaService } from '../services/TaxonomyMediaService'
import { resolveWikidataImage } from '../services/imageProviders/wikimedia'
import type { ImageCandidate } from '../services/imageProviders'

// Reviewed identities, not first-result matching. Same-name films, books,
// bands, places and stock-photo subjects are deliberately not interchangeable.
const fixtures = [
  { type: 'movie', name: 'Inception', qid: 'Q25188', cover: true, categories: ['top-movies'] },
  { type: 'movie', name: 'Parasite', qid: 'Q61448040' },
  { type: 'movie', name: 'The Shining', qid: 'Q186341' },
  { type: 'band', name: 'Nirvana', qid: 'Q11649', cover: true, categories: ['top-90s-bands', 'top-rock-bands'] },
  { type: 'band', name: 'Radiohead', qid: 'Q44190' },
  { type: 'band', name: 'Taylor Swift', qid: 'Q26876', categories: ['top-pop-artists'] },
  { type: 'band', name: 'Kendrick Lamar', qid: 'Q130798', categories: ['top-hiphop-artists'] },
  { type: 'book', name: 'Dune', qid: 'Q190192', cover: true, categories: ['favorite-scifi-books'] },
  { type: 'book', name: 'The Hobbit', qid: 'Q74287' },
  { type: 'book', name: '1984', qid: 'Q208460' },
  { type: 'book', name: 'Foundation', qid: 'Q753894' },
  { type: 'country', name: 'Japan', qid: 'Q17', cover: true },
  { type: 'country', name: 'Italy', qid: 'Q38' },
  { type: 'country', name: 'Iceland', qid: 'Q189' },
  { type: 'country', name: 'Greece', qid: 'Q41' },
  { type: 'national-park', name: 'Yellowstone', qid: 'Q351', cover: true },
  { type: 'national-park', name: 'Yosemite', qid: 'Q180402' },
  { type: 'national-park', name: 'Grand Canyon', qid: 'Q118841' },
  { type: 'national-park', name: 'Zion', qid: 'Q205325' },
] as const

// Reviewed fallback titles: retain this provider's own identity and credit.
// These are image IDs, never external identities for the taxonomy entity.
const fallbacks = [
  { type: 'movie', name: 'The Godfather', id: '675c1f5e-18c4-4be1-87f3-ed593a504a12', title: 'The Godfather Movie in Text' },
  { type: 'movie', name: 'The Dark Knight', id: '39db8200-f1cf-4e4b-90a8-424db2489dde', title: 'dark knight bat signal' },
] as const

const media = new TaxonomyMediaService()
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
  const actor = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!actor) throw new Error('Seed an ADMIN user first')
  async function attach(target: { entityId?: string; entityTypeId?: string; categoryId?: string }, candidate: ImageCandidate, label: string) {
    const metadata = { ...candidate.metadata, previewUrl: candidate.previewUrl, reviewedFixture: true }
    const previous = await db.mediaAsset.findFirst({ where: { ...target, isPrimary: true, provider: candidate.provider, sourceId: candidate.externalId } })
    if ((previous?.metadata as any)?.reviewedFixture) {
      report.push({ label, status: 'already-imported', provider: candidate.provider })
      return
    }
    const asset = await media.importAndAttach(target, { ...candidate, metadata }, actor!.id, actor!.role)
    report.push({ label, status: 'imported', provider: candidate.provider, sourceId: candidate.externalId, sha256: asset.sha256 })
  }

  for (const fixture of fixtures) {
    const type = await db.entityType.findUnique({ where: { slug: fixture.type } })
    const entity = type && await db.entity.findFirst({ where: { entityTypeId: type.id, canonicalName: fixture.name } })
    if (!type || !entity) { report.push({ label: fixture.name, status: 'missing-taxonomy-record' }); continue }
    try {
      // Record the verified entity identity even when it has no usable image.
      await db.entityExternalRef.upsert({
        where: { entityId_provider: { entityId: entity.id, provider: 'wikimedia' } },
        create: { entityId: entity.id, provider: 'wikimedia', externalId: fixture.qid },
        update: { externalId: fixture.qid },
      })
      const cached = await db.mediaAsset.findFirst({ where: { entityId: entity.id, isPrimary: true, provider: 'wikimedia', sourceId: fixture.qid } })
      const candidate: ImageCandidate | null = (cached?.metadata as any)?.reviewedFixture ? {
        provider: 'wikimedia', externalId: fixture.qid, title: (cached!.metadata as any).title,
        previewUrl: (cached!.metadata as any).previewUrl ?? cached!.sourceUrl!, sourceUrl: cached!.sourceUrl!, landingUrl: cached!.landingUrl ?? undefined,
        creator: cached!.creator ?? undefined, license: cached!.license ?? undefined,
        licenseUrl: cached!.licenseUrl ?? undefined, attribution: cached!.attribution ?? undefined,
        importRule: 'IMPORT_ALLOWED', metadata: cached!.metadata as any,
      } : await resolveWikidataImage(fixture.qid)
      if (!candidate || candidate.importRule !== 'IMPORT_ALLOWED') {
        report.push({ label: fixture.name, status: candidate ? 'rights-review-required' : 'missing-image', qid: fixture.qid })
        continue
      }
      await attach({ entityId: entity.id }, candidate, fixture.name)
      if ('cover' in fixture && fixture.cover) await attach({ entityTypeId: type.id }, candidate, `type:${fixture.type}`)
      const categories = await db.category.findMany({ where: { entityTypeId: type.id, ...( 'categories' in fixture ? { slug: { in: [...fixture.categories] } } : { id: '__none__' }) } })
      for (const category of categories) await attach({ categoryId: category.id }, candidate, `list:${category.slug}`)
    } catch (error: any) {
      report.push({ label: fixture.name, status: 'failed-import', reason: error.message ?? String(error) })
    }
    // Avoid hammering public APIs. Failures stay visible, never become blind matches.
    await new Promise((resolve) => setTimeout(resolve, 5000))
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
  await db.entityExternalRef.deleteMany({ where: { provider: 'openverse', entity: { OR: [...fixtures, ...fallbacks].map((f) => ({ canonicalName: f.name, entityType: { slug: f.type } })) } } })
  console.log(JSON.stringify({ results: report, quarantined: wrong.length, primaryAssets: await db.mediaAsset.count({ where: { isPrimary: true } }) }, null, 2))
  if (report.some((r: any) => r.status.startsWith('failed'))) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
