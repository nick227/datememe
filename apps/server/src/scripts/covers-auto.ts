import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { db } from '@project/db'
import { hashDistance, measureImage, NEAR_DUPLICATE, technicalQuality, type ImageMetrics } from '../lib/coverImage'
import { combineScore, generateBriefs, RATING_VERSION, rateImage, subjectKey, type ListContext, type VisionRating } from '../lib/coverScoring'
import { fetchThumbnail, searchOpenverse, usableCandidates, type CoverCandidate } from '../lib/openverse'
import { mergeRefMetadata } from '../lib/wikidataIdentity'
import { coverDecisionOf } from '../lib/categoryCovers'

// Automatic list covers. DB-only (no files), so this runs locally against the
// target database; media:sync then downloads the new covers inside the container.
//
//   pnpm --filter server covers:backfill [--apply]   lists with no cover (or only the placeholder)
//   pnpm --filter server covers:improve  [--apply]   lists whose cover scores below IMPROVE_BELOW
//
// Per list: the brief in catalog/cover-briefs.json plus 3 model-written briefs
// are searched on Openverse and pooled; cheap filters (size, shape, host,
// blocklist), thumbnail metrics (dark, B&W, blurry, cut-out) and perceptual
// hashes (near-duplicates of any other list's cover) run before the model
// rates the survivors for relevance, 3:4 crop survival, appeal, people,
// text/logos and sensitive content. combineScore turns that into 0–100.
//
//   Good, relevant and distinct beats perfect (POC bar, 2026-09-28).
//   backfill: best ≥ AUTO_MIN (72) with relevance ≥ 7 and no prominent text → approved;
//             best ≥ REVIEW_MIN → review; otherwise nothing good found.
//   improve:  replaces only when best ≥ current + MARGIN, with the same
//             auto/review split; a replaced cover is kept in cover.replaced.
//
// Dry run by default (a report plus catalog/review/covers-auto.<REVIEW_ENV>.html
// to look at). --apply writes the auto picks and adds the close calls to the
// covers:propose review file. Searches, briefs and ratings are cached in
// catalog/review/cache/, so a dry run followed by --apply costs nothing twice.

const ROOT = resolve(__dirname, '../../../..')
const BRIEFS = resolve(ROOT, 'catalog/cover-briefs.json')
const REVIEW_ENV = process.env.REVIEW_ENV || 'local'
const REVIEW_FILE = resolve(ROOT, `catalog/review/covers.${REVIEW_ENV}.json`)
const REPORT_FILE = resolve(ROOT, `catalog/review/covers-auto.${REVIEW_ENV}.html`)
const CACHE_FILE = resolve(ROOT, `catalog/review/cache/covers-auto.${REVIEW_ENV}.json`)

const MODE: 'backfill' | 'improve' = process.argv.includes('improve') ? 'improve' : 'backfill'
const APPLY = process.argv.includes('--apply')
const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback)
const AUTO_MIN = num('AUTO_MIN', 72)
const REVIEW_MIN = num('REVIEW_MIN', 60)
const MARGIN = num('MARGIN', 12)
const IMPROVE_BELOW = num('IMPROVE_BELOW', 72)
const LIMIT = num('LIMIT', 200)
const PER_BRIEF = 5
const MAX_RATED = 10

type Scored = { candidate: CoverCandidate; metrics: ImageMetrics; rating: VisionRating; score: number; flags: string[] }
type Outcome = {
  slug: string; title: string; categoryId: string; current?: { url: string; score: number; reason: string; flags: string[] }
  best?: Scored; runnerUp?: Scored; decision: 'auto' | 'review' | 'keep' | 'nothing-good'; note: string; rejected: Record<string, number>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Cache = { searches: Record<string, any[]>; briefs: Record<string, string[]>; metrics: Record<string, ImageMetrics>; ratings: Record<string, { rating: VisionRating; metrics: ImageMetrics }> }
const cache: Cache = { searches: {}, briefs: {}, metrics: {}, ratings: {}, ...(existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}) }
function saveCache() { mkdirSync(dirname(CACHE_FILE), { recursive: true }); writeFileSync(CACHE_FILE, JSON.stringify(cache)) }

let lastSearch = 0
async function search(q: string) {
  if (cache.searches[q]) return cache.searches[q]!
  await sleep(Math.max(0, lastSearch + 3500 - Date.now())) // Openverse anonymous limit: 20/min, 200/day
  lastSearch = Date.now()
  cache.searches[q] = await searchOpenverse(q)
  saveCache()
  return cache.searches[q]!
}

async function rate(key: string, list: ListContext, image: () => Promise<Buffer | null>, storedMetrics?: ImageMetrics) {
  if (cache.ratings[key]) return cache.ratings[key]!
  const buffer = await image()
  if (!buffer) return null
  const result = { rating: await rateImage(list, buffer), metrics: storedMetrics ?? (await measureImage(buffer)) }
  cache.ratings[key] = result
  saveCache()
  return result
}

const coverOf = coverDecisionOf
// Stock libraries photograph models; anywhere else a recognizable face is a real, unasked person.
const STOCK = new Set(['stocksnap', 'rawpixel'])
const isGood = (s: Scored) => s.score >= AUTO_MIN && s.rating.relevance >= 7 && !s.flags.some((f) => /text|logo/.test(f)) &&
  !(s.rating.people === 'identifiable' && !STOCK.has(s.candidate.source ?? ''))

async function main() {
  const briefs: Record<string, string> = JSON.parse(readFileSync(BRIEFS, 'utf8'))
  const categories = await db.category.findMany({
    where: { isActive: true },
    select: {
      id: true, slug: true, shortLabel: true, prompt: true, metadata: true, popularityCount: true,
      curatedEntities: { select: { entity: { select: { canonicalName: true } } }, orderBy: { sortOrder: 'asc' }, take: 8 },
      mediaAssets: { where: { isPrimary: true }, select: { publicUrl: true, metadata: true }, take: 1 },
    },
    orderBy: [{ popularityCount: 'desc' }, { slug: 'asc' }],
  })
  const asset = (c: (typeof categories)[number]) => c.mediaAssets[0]
  const hasCover = (c: (typeof categories)[number]) => ['approved', 'asset'].includes(coverOf(c.metadata)?.status ?? '') && !!asset(c)?.publicUrl
  // An image an admin attached directly is their call: rated (so others avoid its subject) but never replaced.
  // Every image in use (by id and perceptual hash): no list may get another list's picture.
  const takenIds = new Map<string, string>()
  const takenHashes = new Map<string, string>()
  for (const c of categories) {
    const id = coverOf(c.metadata)?.id
    if (id) takenIds.set(id, c.slug)
    const dhash = (asset(c)?.metadata as any)?.quality?.dhash
    if (dhash) takenHashes.set(c.slug, dhash)
  }

  const scope = MODE === 'backfill' ? categories.filter((c) => !hasCover(c)) : categories.filter((c) => hasCover(c) && coverOf(c.metadata)!.status === 'approved')
  const outcomes: Outcome[] = []
  let stopped: string | null = null
  const contextOf = (c: (typeof categories)[number]): ListContext =>
    ({ title: c.shortLabel, prompt: c.prompt, values: c.curatedEntities.map((e) => e.entity.canonicalName), brief: briefs[c.slug] })

  // Every current cover rated first (the same way as candidates: stored full-size
  // metrics, our own copy of the image), so each list knows what the others show.
  const currents = new Map<string, NonNullable<Outcome['current']>>()
  const takenSubjects = new Map<string, string>()
  try {
    for (const c of categories.filter(hasCover)) {
      const cover = coverOf(c.metadata)!
      const stored = (asset(c)!.metadata as any)?.quality as ImageMetrics | undefined
      const rated = await rate(`v${RATING_VERSION}:${c.slug}:current:${cover.id ?? cover.assetId}`, contextOf(c), () => fetchThumbnail(asset(c)!.publicUrl!), stored)
      if (!rated) continue
      const s = combineScore(rated.rating, rated.metrics)
      currents.set(c.slug, { url: (asset(c)!.metadata as any)?.card?.publicUrl ?? asset(c)!.publicUrl!, score: s.score, reason: s.rejected ?? rated.rating.reason, flags: s.flags })
      takenSubjects.set(c.slug, subjectKey(rated.rating.subject))
    }
  } catch (error: any) {
    if (!/429|quota|OPENAI_API_KEY/i.test(error?.message ?? '')) throw error
    stopped = error.message
  }

  for (const c of stopped ? [] : scope.slice(0, LIMIT)) {
    const list = contextOf(c)
    const outcome: Outcome = { slug: c.slug, title: c.shortLabel, categoryId: c.id, decision: 'nothing-good', note: '', rejected: {} }
    const reject = (why: string) => { outcome.rejected[why] = (outcome.rejected[why] ?? 0) + 1 }
    try {
      if (MODE === 'improve') {
        outcome.current = currents.get(c.slug)
        if (!outcome.current) { outcome.note = 'current cover could not be fetched'; outcomes.push(outcome); continue }
        if (outcome.current.score >= IMPROVE_BELOW) { outcome.decision = 'keep'; outcome.note = 'above threshold'; outcomes.push(outcome); continue }
      }

      cache.briefs[c.slug] ??= await generateBriefs(list)
      saveCache()
      const queries = [...new Set([list.brief, ...cache.briefs[c.slug]!].filter(Boolean) as string[])]
      const pool = new Map<string, CoverCandidate>()
      for (const q of queries) {
        let results: any[]
        try { results = await search(q) } catch (error: any) {
          // Openverse's firewall refuses some innocent queries (403 on "outdoor park"); only its rate limit stops the run.
          if (/returned 429/.test(error?.message ?? '')) throw error
          reject(`search "${q}" failed`); continue
        }
        for (const r of usableCandidates(results).slice(0, PER_BRIEF)) {
          const holder = takenIds.get(r.id)
          if (holder && holder !== c.slug) { reject('used by another list'); continue }
          if (r.id === coverOf(c.metadata)?.id) continue
          pool.set(r.id, r)
        }
      }

      const measured: { candidate: CoverCandidate; metrics: ImageMetrics; technical: number }[] = []
      for (const candidate of pool.values()) {
        if (!cache.metrics[candidate.id]) {
          const buffer = await fetchThumbnail(candidate.thumbnail)
          if (!buffer) { reject('thumbnail unavailable'); continue }
          cache.metrics[candidate.id] = await measureImage(buffer)
          saveCache()
        }
        const metrics = cache.metrics[candidate.id]!
        const technical = technicalQuality({ ...metrics, width: candidate.width, height: candidate.height })
        if (technical.issues.some((i) => /transparent|extreme|too dark|blurry/.test(i))) { reject(technical.issues[0]!); continue }
        const twin = [...takenHashes].find(([slug, h]) => slug !== c.slug && hashDistance(h, metrics.dhash) <= NEAR_DUPLICATE)
        if (twin) { reject('near-duplicate of another cover'); continue }
        measured.push({ candidate, metrics, technical: technical.score })
      }

      const scored: Scored[] = []
      for (const m of measured.sort((a, b) => b.technical - a.technical).slice(0, MAX_RATED)) {
        const rated = await rate(`v${RATING_VERSION}:${c.slug}:${m.candidate.id}`, list, () => fetchThumbnail(m.candidate.thumbnail), m.metrics)
        if (!rated) { reject('thumbnail unavailable'); continue }
        const s = combineScore(rated.rating, rated.metrics, { width: m.candidate.width, height: m.candidate.height })
        if (s.rejected) { reject(s.rejected); continue }
        // Feed variety: a different picture of the same thing (two microphones) is still a repeat.
        const subject = subjectKey(rated.rating.subject)
        if ([...takenSubjects].some(([slug, taken]) => slug !== c.slug && taken === subject)) { reject(`same subject as another cover (${subject})`); continue }
        scored.push({ candidate: m.candidate, metrics: rated.metrics, rating: rated.rating, score: s.score, flags: s.flags })
      }
      scored.sort((a, b) => b.score - a.score)
      ;[outcome.best, outcome.runnerUp] = scored

      const best = outcome.best
      const bar = MODE === 'improve' ? outcome.current!.score + MARGIN : REVIEW_MIN
      if (!best || best.score < Math.max(bar, REVIEW_MIN)) {
        outcome.decision = MODE === 'improve' ? 'keep' : 'nothing-good'
        outcome.note = best ? `best ${best.score} < ${Math.max(bar, REVIEW_MIN)}` : 'no usable candidate'
      } else {
        outcome.decision = isGood(best) ? 'auto' : 'review'
        outcome.note = `best ${best.score}${outcome.current ? ` vs current ${outcome.current.score}` : ''}`
        // Claim the picture now so no later list in this run can take it or a look-alike.
        takenIds.set(best.candidate.id, c.slug)
        takenHashes.set(c.slug, best.metrics.dhash)
        takenSubjects.set(c.slug, subjectKey(best.rating.subject))
      }
    } catch (error: any) {
      if (/429|quota|OPENAI_API_KEY/i.test(error?.message ?? '')) { stopped = error.message; break }
      outcome.note = `error: ${error?.message ?? error}`
    }
    outcomes.push(outcome)
    console.log(`${outcome.decision.padEnd(12)} ${c.slug} — ${outcome.note}`)
  }

  // Would the resulting catalog have two lists showing the same (or a near-identical) picture?
  const finalHashes = [...takenHashes.values()]
  let collisions = 0
  for (let i = 0; i < finalHashes.length; i++) for (let j = i + 1; j < finalHashes.length; j++) if (hashDistance(finalHashes[i]!, finalHashes[j]!) <= NEAR_DUPLICATE) collisions++

  if (APPLY) await apply(outcomes, categories)
  writeFileSync(REPORT_FILE, sheet(outcomes))

  const n = (d: Outcome['decision']) => outcomes.filter((o) => o.decision === d).length
  const verb = APPLY ? '' : 'would be '
  if (MODE === 'backfill') {
    console.log(`\n${categories.length} active lists / ${scope.length} missing / ${n('auto') + n('review')} proposed / ${n('auto')} ${verb}auto-filled / ${n('review')} review / ${n('nothing-good')} nothing good found`)
  } else {
    const below = outcomes.filter((o) => o.current && o.current.score < IMPROVE_BELOW).length
    console.log(`\n${scope.length} existing covers / ${below} below ${IMPROVE_BELOW} / ${n('auto')} ${verb}improved / ${n('review')} review / ${collisions} duplicate collisions`)
  }
  const bySubject = new Map<string, string[]>()
  for (const [slug, subject] of takenSubjects) bySubject.set(subject, [...(bySubject.get(subject) ?? []), slug])
  const shared = [...bySubject].filter(([, slugs]) => slugs.length > 1)
  if (shared.length) console.log(`Shared subjects (informational): ${shared.map(([subject, slugs]) => `${subject} ×${slugs.length}`).join(', ')}`)
  if (stopped) console.log(`Stopped early: ${stopped}. Progress is cached; re-run to resume.`)
  console.log(`${APPLY ? 'Applied.' : 'Dry run — nothing written. Re-run with --apply.'} Details: ${REPORT_FILE}`)
}

async function apply(outcomes: Outcome[], categories: { id: string; metadata: unknown }[]) {
  const review = existsSync(REVIEW_FILE) ? JSON.parse(readFileSync(REVIEW_FILE, 'utf8')) : { instructions: '', pending: [] }
  for (const o of outcomes) {
    const category = categories.find((c) => c.id === o.categoryId)!
    if (o.decision === 'auto' && o.best) {
      const previous = coverOf(category.metadata)
      const cover = {
        status: 'approved', provider: 'openverse', ...o.best.candidate, at: new Date().toISOString(),
        auto: { score: o.best.score, previousScore: o.current?.score ?? null, relevance: o.best.rating.relevance, subject: subjectKey(o.best.rating.subject), reason: o.best.rating.reason, model: process.env.COVER_MODEL || 'gpt-4o-mini' },
        ...(previous ? { replaced: { ...previous, replaced: undefined } } : {}),
      }
      await db.category.update({ where: { id: o.categoryId }, data: { metadata: mergeRefMetadata(category.metadata, { cover }) } })
    } else if (o.decision === 'review' && o.best) {
      review.pending = review.pending.filter((e: any) => e.categoryId !== o.categoryId)
      review.pending.push({
        categoryId: o.categoryId, slug: o.slug, title: o.title, brief: `auto: ${o.note}${o.current ? ' — set "keep" to leave the current cover' : ''}`,
        candidates: [o.best, o.runnerUp].filter(Boolean).map((s) => s!.candidate), approve: null,
      })
    }
  }
  mkdirSync(dirname(REVIEW_FILE), { recursive: true })
  writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2) + '\n')
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
function sheet(outcomes: Outcome[]) {
  const order = { auto: 0, review: 1, 'nothing-good': 2, keep: 3 }
  const img = (url: string, caption: string) => `<figure><img loading="lazy" src="${esc(url)}"><figcaption>${caption}</figcaption></figure>`
  const scoredCaption = (label: string, s: Scored) => `<b>${label} ${s.score}</b> rel ${s.rating.relevance} · crop ${s.rating.cropSurvival} · appeal ${s.rating.appeal}${s.flags.length ? ` · ${esc(s.flags.join(', '))}` : ''}<br>${esc(s.rating.reason)}<br><small>${esc(s.candidate.title.slice(0, 50))} · ${esc(s.candidate.license.toUpperCase())}</small>`
  const rows = [...outcomes].sort((a, b) => order[a.decision] - order[b.decision] || (b.best?.score ?? 0) - (b.current?.score ?? 0) - ((a.best?.score ?? 0) - (a.current?.score ?? 0))).map((o) => {
    const figures = [
      o.current ? img(o.current.url, `<b>current ${o.current.score}</b>${o.current.flags.length ? ` · ${esc(o.current.flags.join(', '))}` : ''}<br>${esc(o.current.reason)}`) : '',
      o.best ? img(o.best.candidate.thumbnail, scoredCaption('best', o.best)) : '',
      o.runnerUp ? img(o.runnerUp.candidate.thumbnail, scoredCaption('runner-up', o.runnerUp)) : '',
    ].join('')
    const rejected = Object.entries(o.rejected).map(([k, v]) => `${v} ${k}`).join(', ')
    return `<section class="${o.decision}"><h2>${esc(o.title)} <small>${o.decision} · ${esc(o.note)}${rejected ? ` · rejected: ${esc(rejected)}` : ''}</small></h2><div class="grid">${figures}</div></section>`
  }).join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Cover ${MODE} — ${REVIEW_ENV}</title><style>body{font:14px system-ui;margin:24px;background:#fff;color:#111}h2{font-size:16px;margin:28px 0 8px}small{color:#666;font-weight:400}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,260px));gap:12px}figure{margin:0}img{width:100%;aspect-ratio:3/4;object-fit:cover;border:1px solid #ddd}figcaption{font-size:12px;color:#444}.keep{opacity:.5}</style><h1>Cover ${MODE} — ${REVIEW_ENV} ${APPLY ? '(applied)' : '(dry run)'}</h1>${rows}`
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
