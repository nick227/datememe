import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { db } from '@project/db'
import { key } from '../lib/identityKey'
import { IDENTITY_PROVIDER, mergeRefMetadata, verification, verificationOf } from '../lib/wikidataIdentity'
import { fixtures } from './taxonomyMediaFixtures'
import { loadIdentityClasses } from '../lib/identityClasses'

// Decides which Wikidata item each entity is, so media:sync can fetch its
// image. DB-only (no files), so it runs locally against the target database.
//
//   pnpm --filter server media:identify                 find identities
//   pnpm --filter server media:identify --apply-review  apply your decisions
//
// Auto-accepts an item only when ALL hold — otherwise a human decides:
//   - its English label or an alias equals the entity's name or alias (by key())
//   - its "instance of" (P31) includes a class allowed for the entity type in
//     catalog/identity-classes.json, or a subclass of one (identity-classes.generated.json);
//     a type not listed there is never automatic
//   - it is the only search result that passes both
// Everything else lands in catalog/review/identities.<REVIEW_ENV>.json (default local;
// prod:publish-catalog sets it to the Railway environment). Set "approve" to a
// QID or "none" per entry, then run --apply-review. No fuzzy fallback exists.

const ROOT = resolve(__dirname, '../../../..')
// Entries are keyed by entity ID, which differs per database — one file per environment.
const REVIEW_ENV = process.env.REVIEW_ENV || 'local'
const REVIEW_FILE = resolve(ROOT, `catalog/review/identities.${REVIEW_ENV}.json`)
const LIMIT = parseInt(process.env.LIMIT || '200', 10)
const RECHECK_MS = parseInt(process.env.RECHECK_DAYS || '30', 10) * 86_400_000
const FORCE = process.env.FORCE === '1'
const USER_AGENT = 'Datememe/1.0 (catalog identity resolver)'
// Only a match within Wikidata's top results may be auto-accepted. Search is
// widened past this to find candidates, but a lone match deep in the results
// is usually an obscure namesake of an entity Wikidata doesn't have — the
// Catan -> Catania failure — so it goes to review instead.
const AUTO_ACCEPT_RANK = 10

type Candidate = { qid: string; rank: number; label?: string; description?: string; classes: string[]; nameMatch: boolean; classMatch: boolean }
type ReviewEntry = { entityId: string; type: string; name: string; reason: string; candidates: Candidate[]; approve: string | null }
type ReviewFile = { instructions: string; pending: ReviewEntry[] }

const INSTRUCTIONS = 'Entries are for ONE environment (see file name). Set "approve" to the correct QID (it need not be a listed candidate) or to "none" if the entity has no Wikidata identity, then run: pnpm --filter server media:identify --apply-review. Leave null to decide later. Judge by description, not label.'

class RateLimited extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Serial, spaced requests; on 429/503 back off (honoring Retry-After) and
// retry, then give up with RateLimited so the run stops cleanly and resumes later.
async function wikidata(params: Record<string, string>) {
  for (let attempt = 0; ; attempt++) {
    await sleep(750)
    const response = await fetch(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: 'json' })}`, {
      headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(15000),
    })
    if (response.ok) return response.json() as Promise<any>
    if (response.status !== 429 && response.status !== 503) throw new Error(`Wikidata returned ${response.status}`)
    if (attempt === 3) throw new RateLimited(`Wikidata still rate-limiting after ${attempt + 1} attempts`)
    await sleep(Math.max(Number(response.headers.get('retry-after')) || 0, 15 * 2 ** attempt) * 1000)
  }
}

async function describe(qids: string[]) {
  if (!qids.length) return {} as Record<string, any>
  const data = await wikidata({ action: 'wbgetentities', ids: qids.join('|'), props: 'labels|aliases|descriptions|claims', languages: 'en|mul' })
  return data.entities as Record<string, any>
}

const labelOf = (e: any) => e?.labels?.en?.value ?? e?.labels?.mul?.value
const classesOf = (e: any): string[] => (e?.claims?.P31 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)

function readReview(): ReviewFile {
  return existsSync(REVIEW_FILE) ? JSON.parse(readFileSync(REVIEW_FILE, 'utf8')) : { instructions: INSTRUCTIONS, pending: [] }
}
function writeReview(review: ReviewFile) {
  mkdirSync(dirname(REVIEW_FILE), { recursive: true })
  writeFileSync(REVIEW_FILE, JSON.stringify({ ...review, instructions: INSTRUCTIONS }, null, 2) + '\n')
}

async function setEntityCheck(entityId: string, metadata: unknown, identityCheck: Record<string, unknown>) {
  await db.entity.update({ where: { id: entityId }, data: { metadata: mergeRefMetadata(metadata, { identityCheck: { ...identityCheck, at: new Date().toISOString() } }) } })
}

async function writeIdentity(entityId: string, qid: string, method: 'auto-strict' | 'review', note: string) {
  const where = { entityId_provider: { entityId, provider: IDENTITY_PROVIDER } }
  const ref = await db.entityExternalRef.findUnique({ where })
  const metadata = mergeRefMetadata(ref?.metadata, { verification: verification(method, note) }, ref?.externalId === qid)
  await db.entityExternalRef.upsert({ where, update: { externalId: qid, metadata }, create: { entityId, provider: IDENTITY_PROVIDER, externalId: qid, metadata } })
}

async function identify() {
  const allowed = loadIdentityClasses()
  const review = readReview()
  const pendingIds = new Set(review.pending.map((p) => p.entityId))

  const entities = await db.entity.findMany({
    where: { status: 'APPROVED', mergedIntoId: null },
    select: {
      id: true, canonicalName: true, metadata: true, entityType: { select: { slug: true } },
      aliases: { select: { alias: true } },
      externalRefs: { where: { provider: IDENTITY_PROVIDER }, select: { externalId: true, metadata: true } },
    },
    orderBy: { id: 'asc' },
  })
  // Fixture entities get their hand-reviewed QID from media:sync; looking them up here only spends API calls.
  const fixtureKeys = new Set(fixtures.map((f) => `${f.type}:${f.name}`))
  const counts = { entities: entities.length, verified: 0, fixture: 0, typeNotAllowlisted: 0, awaitingReview: 0, knownNoIdentity: 0, recentlyChecked: 0, checked: 0, autoAccepted: 0, toReview: 0, remaining: 0 }
  const todo: typeof entities = []
  for (const e of entities) {
    const check = (e.metadata as any)?.identityCheck
    if (e.externalRefs.some((r) => verificationOf(r.metadata))) counts.verified++
    else if (fixtureKeys.has(`${e.entityType.slug}:${e.canonicalName}`)) counts.fixture++
    else if (!allowed[e.entityType.slug]) counts.typeNotAllowlisted++
    else if (pendingIds.has(e.id)) counts.awaitingReview++
    else if (!FORCE && check?.status === 'no-identity') counts.knownNoIdentity++
    else if (!FORCE && check && Date.now() - Date.parse(check.at) < RECHECK_MS) counts.recentlyChecked++
    else todo.push(e)
  }

  let stoppedEarly: string | null = null
  for (const e of todo.slice(0, LIMIT)) {
    const names = new Set([e.canonicalName, ...e.aliases.map((a) => a.alias)].map(key))
    const classes = allowed[e.entityType.slug]!
    let candidates: Candidate[] = []
    let qualifying: Candidate[] = []
    
    try {
      for (const limit of ['10', '25', '50']) {
        const search = await wikidata({ action: 'wbsearchentities', search: e.canonicalName, language: 'en', uselang: 'en', type: 'item', limit })
        const qids: string[] = (search.search ?? []).map((r: any) => r.id)
        const newQids = qids.filter((qid) => !candidates.some((c) => c.qid === qid))

        if (newQids.length > 0) {
          const details = await describe(newQids)
          const newCandidates = newQids.map((qid) => {
            const d = details[qid]
            const rank = qids.indexOf(qid)
            const itemNames = [labelOf(d), ...(d?.aliases?.en ?? []).map((a: any) => a.value)].filter(Boolean).map(key)
            const itemClasses = classesOf(d)
            return {
              qid, rank, label: labelOf(d), description: d?.descriptions?.en?.value, classes: itemClasses,
              nameMatch: itemNames.some((n) => names.has(n)), classMatch: itemClasses.some((c) => classes[c]),
            }
          })
          candidates.push(...newCandidates)
          qualifying = candidates.filter((c) => c.nameMatch && c.classMatch)
        }

        if (qualifying.length > 0) break
      }
    } catch (error) {
      if (!(error instanceof RateLimited)) throw error
      stoppedEarly = error.message
      break
    }

    counts.checked++
    if (qualifying.length === 1 && qualifying[0]!.rank < AUTO_ACCEPT_RANK) {
      const q = qualifying[0]!
      await writeIdentity(e.id, q.qid, 'auto-strict', `${q.label} — ${q.description ?? ''}`)
      await setEntityCheck(e.id, e.metadata, { status: 'auto', qid: q.qid })
      counts.autoAccepted++
      console.log(`auto      ${e.entityType.slug}:${e.canonicalName} -> ${q.qid} (${q.label} — ${q.description ?? ''})`)
    } else {
      const reason = !candidates.length ? 'no search results'
        : qualifying.length > 1 ? `${qualifying.length} items match name and class`
        : qualifying.length === 1 ? `only match is search result #${qualifying[0]!.rank + 1}, below the top ${AUTO_ACCEPT_RANK}`
        : candidates.some((c) => c.nameMatch) ? 'name matches, but no allowed class'
        : 'no exact name match'
      // Most plausible first: name + class matches, then name matches, then search rank.
      const score = (c: Candidate) => (c.nameMatch && c.classMatch ? 0 : c.nameMatch ? 1 : 2) * 1000 + c.rank
      const shortlist = [...candidates].sort((a, b) => score(a) - score(b)).slice(0, 8)
      review.pending.push({ entityId: e.id, type: e.entityType.slug, name: e.canonicalName, reason, candidates: shortlist, approve: null })
      await setEntityCheck(e.id, e.metadata, { status: 'review' })
      counts.toReview++
      console.log(`review    ${e.entityType.slug}:${e.canonicalName} — ${reason}`)
    }
    writeReview(review) // after every entity, so an interrupted run loses nothing
  }
  counts.remaining = todo.length - counts.checked
  if (stoppedEarly) console.log(`Stopped early: ${stoppedEarly}. Progress is saved; re-run to resume.`)
  console.log(`IDENTIFY ${JSON.stringify({ ...counts, stoppedEarly: !!stoppedEarly, reviewFile: review.pending.length ? REVIEW_FILE : null })}`)
  if (stoppedEarly) process.exitCode = 1
}

async function applyReview() {
  const review = readReview()
  const decided = review.pending.filter((p) => p.approve !== null && p.approve !== undefined)
  const approvals = decided.filter((p) => p.approve !== 'none')
  for (const p of approvals) if (!/^Q\d+$/.test(p.approve!)) throw new Error(`${p.name}: "approve" must be a QID, "none" or null — got ${JSON.stringify(p.approve)}`)
  const details = {} as Record<string, any>
  const qids = [...new Set(approvals.map((p) => p.approve!))]
  for (let i = 0; i < qids.length; i += 50) Object.assign(details, await describe(qids.slice(i, i + 50)))
  let applied = 0
  for (const p of decided) {
    const entity = await db.entity.findUnique({ where: { id: p.entityId }, select: { metadata: true } })
    if (!entity) continue
    if (p.approve === 'none') {
      await setEntityCheck(p.entityId, entity.metadata, { status: 'no-identity' })
    } else {
      const d = details[p.approve!]
      if (!d || d.missing !== undefined) throw new Error(`${p.name}: ${p.approve} does not exist on Wikidata`)
      await writeIdentity(p.entityId, p.approve!, 'review', `${labelOf(d)} — ${d.descriptions?.en?.value ?? ''}`)
      await setEntityCheck(p.entityId, entity.metadata, { status: 'reviewed', qid: p.approve })
    }
    applied++
    console.log(`${p.approve === 'none' ? 'no-identity' : 'approved'}  ${p.type}:${p.name}${p.approve === 'none' ? '' : ` -> ${p.approve}`}`)
  }
  review.pending = review.pending.filter((p) => p.approve === null || p.approve === undefined)
  writeReview(review)
  console.log(`IDENTIFY_REVIEW ${JSON.stringify({ applied, stillPending: review.pending.length })}`)
}

(process.argv.includes('--apply-review') ? applyReview() : identify())
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => db.$disconnect())
