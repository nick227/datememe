import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { db } from '@project/db'
import { isApprovedImageHost } from '../lib/imageHosts'
import { mergeRefMetadata } from '../lib/wikidataIdentity'

// List covers are chosen by a person. DB-only (no files), so this runs locally
// against the target database; media:sync later downloads approved covers
// inside the container.
//
//   pnpm --filter server covers:propose                 propose candidates
//   pnpm --filter server covers:propose --apply-review  record your picks
//
// For each active list without a decided cover, searches Openverse with the
// list's brief (catalog/cover-briefs.json — keep it to 2-3 words; Openverse
// requires every word to match) for reusable (commercial +
// modification) wide images ≥1200px on approved hosts, and writes 6
// candidates to catalog/review/covers.<REVIEW_ENV>.json plus a contact sheet
// (.html) to look at them. Set "approve" to a candidate number (1–6), an
// Openverse id, or "none"; then --apply-review. A picked image can't be
// approved for two lists.

const ROOT = resolve(__dirname, '../../../..')
const BRIEFS = resolve(ROOT, 'catalog/cover-briefs.json')
const REVIEW_ENV = process.env.REVIEW_ENV || 'local'
const REVIEW_FILE = resolve(ROOT, `catalog/review/covers.${REVIEW_ENV}.json`)
const SHEET_FILE = REVIEW_FILE.replace(/\.json$/, '.html')
const LIMIT = parseInt(process.env.LIMIT || '120', 10)
const CANDIDATES = 6
const MIN_WIDTH = 1200
const USER_AGENT = 'Datememe/1.0 (list cover proposals)'

type Candidate = { id: string; title: string; creator?: string; license: string; licenseVersion?: string; licenseUrl?: string; attribution?: string; url: string; thumbnail: string; landingUrl?: string; width: number; height: number; source?: string }
type Entry = { categoryId: string; slug: string; title: string; brief: string; candidates: Candidate[]; approve: string | null }
type ReviewFile = { instructions: string; pending: Entry[] }
const INSTRUCTIONS = `Entries are for ONE environment (${REVIEW_ENV}). Open the .html next to this file to see the candidates. Set "approve" to a candidate number (1-6), an Openverse id, or "none", then run covers:propose --apply-review (or pnpm prod:publish-catalog --apply-review).`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const read = (): ReviewFile => existsSync(REVIEW_FILE) ? JSON.parse(readFileSync(REVIEW_FILE, 'utf8')) : { instructions: INSTRUCTIONS, pending: [] }
function write(review: ReviewFile) {
  mkdirSync(dirname(REVIEW_FILE), { recursive: true })
  writeFileSync(REVIEW_FILE, JSON.stringify({ ...review, instructions: INSTRUCTIONS }, null, 2) + '\n')
  writeFileSync(SHEET_FILE, contactSheet(review))
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
function contactSheet(review: ReviewFile) {
  const rows = review.pending.map((e) => `<section><h2>${esc(e.title)} <small>${esc(e.slug)} · “${esc(e.brief)}”${e.approve ? ` · approve: ${esc(e.approve)}` : ''}</small></h2><div class="grid">${
    e.candidates.map((c, i) => `<figure><a href="${esc(c.landingUrl ?? c.url)}" target="_blank"><img loading="lazy" src="${esc(c.thumbnail)}"></a><figcaption><b>${i + 1}</b> ${esc(c.title.slice(0, 60))}<br>${esc(c.creator ?? '?')} · ${esc(c.license.toUpperCase())} · ${c.width}×${c.height}</figcaption></figure>`).join('')
  }</div></section>`).join('\n')
  return `<!doctype html><meta charset="utf-8"><title>List covers — ${REVIEW_ENV}</title><style>body{font:14px system-ui;margin:24px;background:#fff;color:#111}h2{font-size:16px;margin:28px 0 8px}small{color:#666;font-weight:400}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}figure{margin:0}img{width:100%;aspect-ratio:16/10;object-fit:cover;border:1px solid #ddd}figcaption{font-size:12px;color:#444}</style><h1>List covers (${review.pending.length} pending) — ${REVIEW_ENV}</h1>${rows}`
}

async function openverse(q: string): Promise<any[]> {
  const params = new URLSearchParams({ q, license_type: 'commercial,modification', size: 'large', aspect_ratio: 'wide', mature: 'false', page_size: '20' })
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) })
    if (response.ok) return ((await response.json()) as any).results ?? []
    if (response.status !== 429 || attempt === 2) throw new Error(`Openverse returned ${response.status}`)
    await sleep((Number(response.headers.get('retry-after')) || 30 * 2 ** attempt) * 1000)
  }
}

// Openverse can't thumbnail Wikimedia-hosted files (HTTP 424); Commons serves
// its own resized copy at a predictable path.
function previewUrl(r: { url: string; thumbnail: string }) {
  const m = r.url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?]+)$/)
  return m ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/500px-${m[3]}` : r.thumbnail
}

const coverOf = (metadata: unknown) => (metadata as any)?.cover as { status: 'approved' | 'none'; id?: string } | undefined

async function propose() {
  const briefs: Record<string, string> = JSON.parse(readFileSync(BRIEFS, 'utf8'))
  const review = read()
  const pending = new Set(review.pending.map((e) => e.categoryId))
  const categories = await db.category.findMany({ where: { isActive: true }, select: { id: true, slug: true, shortLabel: true, metadata: true }, orderBy: { slug: 'asc' } })
  const taken = new Set(categories.map((c) => coverOf(c.metadata)?.id).filter(Boolean) as string[])
  const counts = { lists: categories.length, decided: 0, awaitingReview: 0, noBrief: 0, proposed: 0, noCandidates: 0, remaining: 0 }
  const todo = categories.filter((c) => {
    if (coverOf(c.metadata)) return counts.decided++, false
    if (pending.has(c.id)) return counts.awaitingReview++, false
    if (!briefs[c.slug]) return counts.noBrief++, false
    return true
  })
  let stopped: string | null = null
  for (const c of todo.slice(0, LIMIT)) {
    let results: any[]
    try { results = await openverse(briefs[c.slug]!) } catch (error: any) { stopped = error.message; break }
    const candidates: Candidate[] = results
      .filter((r) => r.width >= MIN_WIDTH && r.height && r.width / r.height >= 1.25 && r.width / r.height <= 2.4)
      .filter((r) => { try { return isApprovedImageHost('openverse', new URL(r.url).hostname) } catch { return false } })
      .filter((r) => !taken.has(r.id))
      // CC0 first (stock-quality, no attribution needed), keeping Openverse's relevance order within each.
      .sort((a, b) => Number(b.license === 'cc0') - Number(a.license === 'cc0'))
      .slice(0, CANDIDATES)
      .map((r) => ({ id: r.id, title: r.title ?? '', creator: r.creator ?? undefined, license: r.license, licenseVersion: r.license_version, licenseUrl: r.license_url, attribution: r.attribution, url: r.url, thumbnail: previewUrl(r), landingUrl: r.foreign_landing_url, width: r.width, height: r.height, source: r.source }))
    if (!candidates.length) counts.noCandidates++
    review.pending.push({ categoryId: c.id, slug: c.slug, title: c.shortLabel, brief: briefs[c.slug]!, candidates, approve: null })
    counts.proposed++
    write(review)
    console.log(`${candidates.length ? 'proposed' : 'no match'}  ${c.slug} (${candidates.length})`)
    await sleep(3500) // Openverse anonymous limit: 20/min
  }
  counts.remaining = todo.length - counts.proposed
  if (stopped) console.log(`Stopped early: ${stopped}. Progress is saved; re-run to resume.`)
  console.log(`COVERS ${JSON.stringify({ ...counts, stoppedEarly: !!stopped, reviewFile: review.pending.length ? REVIEW_FILE : null, contactSheet: review.pending.length ? SHEET_FILE : null })}`)
}

async function applyReview() {
  const review = read()
  const categories = await db.category.findMany({ where: { isActive: true }, select: { id: true, metadata: true } })
  const taken = new Map(categories.flatMap((c) => { const id = coverOf(c.metadata)?.id; return id ? [[id, c.id] as const] : [] }))
  let applied = 0
  for (const e of review.pending.filter((p) => p.approve)) {
    const category = categories.find((c) => c.id === e.categoryId)
    if (!category) continue
    let cover: Record<string, unknown>
    if (e.approve === 'none') cover = { status: 'none', at: new Date().toISOString() }
    else {
      const pick = /^\d+$/.test(e.approve!) ? e.candidates[Number(e.approve) - 1] : e.candidates.find((c) => c.id === e.approve)
      if (!pick) throw new Error(`${e.slug}: "${e.approve}" is not one of its candidates`)
      const holder = taken.get(pick.id)
      if (holder && holder !== e.categoryId) throw new Error(`${e.slug}: that image is already another list's cover — pick a different one`)
      taken.set(pick.id, e.categoryId)
      cover = { status: 'approved', provider: 'openverse', ...pick, at: new Date().toISOString() }
    }
    await db.category.update({ where: { id: e.categoryId }, data: { metadata: mergeRefMetadata(category.metadata, { cover }) } })
    applied++
    console.log(`${e.approve === 'none' ? 'no cover' : 'approved'}  ${e.slug}${e.approve === 'none' ? '' : ` -> ${e.approve}`}`)
  }
  review.pending = review.pending.filter((p) => !p.approve)
  write(review)
  console.log(`COVERS_REVIEW ${JSON.stringify({ applied, stillPending: review.pending.length })}`)
}

(process.argv.includes('--apply-review') ? applyReview() : propose())
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => db.$disconnect())
