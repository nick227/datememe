import { db } from '@project/db'
import { hashDistance, measureImage, NEAR_DUPLICATE, technicalQuality, type ImageMetrics } from './coverImage'
import { combineScore, generateBriefs, RATING_VERSION, rateImage, subjectKey, type ListContext, type VisionRating } from './coverScoring'
import { fetchThumbnail, searchOpenverse, usableCandidates, type CoverCandidate } from './openverse'
import { coverDecisionOf } from './categoryCovers'

// Finding cover candidates for one list: pooled briefs → Openverse → cheap
// filters → thumbnail metrics → duplicate checks (image id, perceptual hash,
// subject — against every other list) → model rating → 0–100 score. Shared by
// scripts/covers-auto (bulk, file-cached) and ListCoverService (one list, from
// the admin app). Nothing here writes to the database.

export const AUTO_MIN = Number(process.env.AUTO_MIN ?? 72)
const PER_BRIEF = 5
const MAX_RATED = 10

export type Scored = { candidate: CoverCandidate; metrics: ImageMetrics; rating: VisionRating; score: number; flags: string[] }

/** What other lists already show, keyed by what must not repeat → the list's slug. */
export type Taken = { ids: Map<string, string>; hashes: Map<string, string>; subjects: Map<string, string> }

export type SuggestDeps = {
  search: (q: string) => Promise<any[]>
  briefs: (slug: string, list: ListContext) => Promise<string[]>
  metrics: (candidate: CoverCandidate) => Promise<ImageMetrics | null>
  rate: (key: string, list: ListContext, image: () => Promise<Buffer | null>, metrics?: ImageMetrics) => Promise<{ rating: VisionRating; metrics: ImageMetrics } | null>
}

// Stock libraries photograph models; anywhere else a recognizable face is a real, unasked person.
const STOCK = new Set(['stocksnap', 'rawpixel'])

/** Good enough to apply without a person: good, relevant, distinct (the POC bar). */
export const isGood = (s: Scored) => s.score >= AUTO_MIN && s.rating.relevance >= 7 && !s.flags.some((f) => /text|logo/.test(f)) &&
  !(s.rating.people === 'identifiable' && !STOCK.has(s.candidate.source ?? ''))

/** Candidates for one list, best first. `reject` counts why others were dropped. */
export async function findCoverCandidates(
  slug: string, list: ListContext, currentCoverId: string | undefined, taken: Taken, deps: SuggestDeps, reject: (why: string) => void,
): Promise<Scored[]> {
  const queries = [...new Set([list.brief, ...(await deps.briefs(slug, list))].filter(Boolean) as string[])]
  const pool = new Map<string, CoverCandidate>()
  for (const q of queries) {
    let results: any[] = []
    // Openverse matches only titles containing every word, so an empty result
    // is retried with the leading (usually descriptive) word dropped:
    // "rich chocolate cake" → "chocolate cake".
    for (let words = q.split(/\s+/); words.length && !results.length; words = words.slice(1)) {
      try { results = await deps.search(words.join(' ')) } catch (error: any) {
        // Openverse's firewall refuses some innocent queries (403 on "outdoor park"); only its rate limit is fatal.
        if (/returned 429/.test(error?.message ?? '')) throw error
        reject(`search "${words.join(' ')}" failed`)
        break
      }
      if (words.length === 1) break
    }
    if (!results.length) { reject(`no results for "${q}"`); continue }
    for (const r of usableCandidates(results).slice(0, PER_BRIEF)) {
      const holder = taken.ids.get(r.id)
      if (holder && holder !== slug) { reject('used by another list'); continue }
      if (r.id === currentCoverId) continue
      pool.set(r.id, r)
    }
  }

  const measured: { candidate: CoverCandidate; metrics: ImageMetrics; technical: number }[] = []
  for (const candidate of pool.values()) {
    const metrics = await deps.metrics(candidate)
    if (!metrics) { reject('thumbnail unavailable'); continue }
    const technical = technicalQuality({ ...metrics, width: candidate.width, height: candidate.height })
    if (technical.issues.some((i) => /transparent|extreme|too dark|blurry/.test(i))) { reject(technical.issues[0]!); continue }
    if ([...taken.hashes].some(([other, h]) => other !== slug && hashDistance(h, metrics.dhash) <= NEAR_DUPLICATE)) { reject('near-duplicate of another cover'); continue }
    measured.push({ candidate, metrics, technical: technical.score })
  }

  const scored: Scored[] = []
  for (const m of measured.sort((a, b) => b.technical - a.technical).slice(0, MAX_RATED)) {
    const rated = await deps.rate(`v${RATING_VERSION}:${slug}:${m.candidate.id}`, list, () => fetchThumbnail(m.candidate.thumbnail), m.metrics)
    if (!rated) { reject('thumbnail unavailable'); continue }
    const s = combineScore(rated.rating, rated.metrics, { width: m.candidate.width, height: m.candidate.height })
    if (s.rejected) { reject(s.rejected); continue }
    // Feed variety: a different picture of the same thing (two microphones) is still a repeat.
    const subject = subjectKey(rated.rating.subject)
    if ([...taken.subjects].some(([other, t]) => other !== slug && t === subject)) { reject(`same subject as another cover (${subject})`); continue }
    scored.push({ candidate: m.candidate, metrics: rated.metrics, rating: rated.rating, score: s.score, flags: s.flags })
  }
  return scored.sort((a, b) => b.score - a.score)
}

/** Uncached deps for one-off use (the admin app): Openverse spacing, no files. */
export function liveDeps(): SuggestDeps {
  let lastSearch = 0
  return {
    async search(q) {
      await new Promise((r) => setTimeout(r, Math.max(0, lastSearch + 3500 - Date.now()))) // Openverse: 20/min anonymous
      lastSearch = Date.now()
      return searchOpenverse(q)
    },
    briefs: (_slug, list) => generateBriefs(list),
    async metrics(candidate) {
      const buffer = await fetchThumbnail(candidate.thumbnail)
      return buffer ? measureImage(buffer) : null
    },
    async rate(_key, list, image, metrics) {
      const buffer = await image()
      if (!buffer) return null
      return { rating: await rateImage(list, buffer), metrics: metrics ?? (await measureImage(buffer)) }
    },
  }
}

/**
 * What every other active list already shows. Subjects come from the cover
 * decision (`cover.subject`, recorded when a suggestion is used or by
 * covers:improve --apply); lists without one only block by image and hash.
 */
export async function takenByCatalog(): Promise<Taken> {
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: { slug: true, metadata: true, mediaAssets: { where: { isPrimary: true }, select: { metadata: true }, take: 1 } },
  })
  const taken: Taken = { ids: new Map(), hashes: new Map(), subjects: new Map() }
  for (const c of categories) {
    const cover = coverDecisionOf(c.metadata)
    if (cover?.id) taken.ids.set(cover.id, c.slug)
    const subject = cover?.subject ?? cover?.auto?.subject
    if (subject) taken.subjects.set(c.slug, subjectKey(subject))
    const dhash = (c.mediaAssets[0]?.metadata as any)?.quality?.dhash
    if (dhash) taken.hashes.set(c.slug, dhash)
  }
  return taken
}
