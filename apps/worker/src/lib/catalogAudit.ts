import { db } from '@project/db'

// Catalog quality, computed quietly (docs/admin-lists-roadmap.md): each active
// list gets Category.metadata.quality = {score, issues, checkedAt}, and Admin →
// Lists surfaces only the `flagged` issues through Needs attention. The same
// pass can produce a coverage report (what the catalog has too much or too
// little of) for whoever generates the next batch. Database only — no images
// are opened; cover checks read the metrics stored at import.

export const QUALITY_VERSION = 1
export type IssueCode = 'duplicate' | 'overlap' | 'too-broad' | 'needs-values' | 'wrong-group' | 'weak-cover' | 'low-takes'
export type QualityIssue = { code: IssueCode; detail: string; flagged: boolean }
export type ListQuality = { score: number; issues: QualityIssue[]; checkedAt: string; version: number }

const MIN_VALUES = 8 // the importer's minimum; a list with fewer offers little to choose from
const OVERLAP = 0.6 // Jaccard of two lists' value sets
const TITLE_SIMILAR = 0.88
const NEAR_DUPLICATE_BITS = 8 // dhash distance, same as the cover tooling
const LOW_TAKES_MIN_SITE_TAKES = 300 // below this, zero takes says nothing about a list
const PENALTY: Record<IssueCode, number> = { duplicate: 40, overlap: 30, 'too-broad': 30, 'needs-values': 25, 'weak-cover': 20, 'wrong-group': 15, 'low-takes': 10 }

/** "Top 90s Bands" and "Favorite 90s Band" → "90s band". */
export function titleKey(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(favorite|favourite|top|best|most|your|ideal|the|of all time|all time|greatest|go-to)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).join(' ')
}

function similarity(a: string, b: string) {
  if (a === b) return 1
  const m = a.length, n = b.length
  if (!m || !n) return 0
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return 1 - prev[n]! / Math.max(m, n)
}

function hashDistance(a: string, b: string) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), bits = 0
  while (x) { bits += Number(x & 1n); x >>= 1n }
  return bits
}

async function loadCatalog() {
  const lists = await db.category.findMany({
    where: { isActive: true },
    select: {
      id: true, slug: true, shortLabel: true, prompt: true, maxItems: true, popularityCount: true, createdAt: true, metadata: true, entityTypeId: true,
      group: { select: { slug: true, label: true } },
      entityType: { select: { slug: true, label: true, pluralLabel: true } },
      requiredTags: { select: { tagId: true } },
      curatedEntities: { where: { isExcluded: false }, select: { entityId: true } },
      mediaAssets: { where: { isPrimary: true }, select: { metadata: true }, take: 1 },
    },
  })
  return { lists }
}
type Catalog = Awaited<ReturnType<typeof loadCatalog>>
type List = Catalog['lists'][number]

/** Of two lists that repeat each other, the one to act on: fewer takes, then the newer one. */
const weaker = (a: List, b: List) => (a.popularityCount !== b.popularityCount ? (a.popularityCount < b.popularityCount ? a : b) : a.createdAt > b.createdAt ? a : b)

export async function auditCatalog(now = new Date()) {
  const catalog = await loadCatalog()
  const { lists } = catalog
  const issues = new Map<string, QualityIssue[]>(lists.map((l) => [l.id, []]))
  const add = (l: List, code: IssueCode, detail: string, flagged = true) => {
    const mine = issues.get(l.id)!
    if (!mine.some((i) => i.code === code)) mine.push({ code, detail, flagged })
  }
  const values = (l: List) => l.curatedEntities.length

  // Pairs: repeated titles, repeated value sets, repeated cover images.
  const keys = new Map(lists.map((l) => [l.id, titleKey(l.shortLabel)]))
  const sets = new Map(lists.map((l) => [l.id, new Set(l.curatedEntities.map((c) => c.entityId))]))
  const dhash = (l: List) => (l.mediaAssets[0]?.metadata as any)?.quality?.dhash as string | undefined
  for (let i = 0; i < lists.length; i++) {
    for (let j = i + 1; j < lists.length; j++) {
      const a = lists[i]!, b = lists[j]!
      const ka = keys.get(a.id)!, kb = keys.get(b.id)!
      if (ka && kb && (ka === kb || similarity(ka, kb) >= TITLE_SIMILAR)) {
        const w = weaker(a, b)
        add(w, 'duplicate', `Same list as “${(w === a ? b : a).shortLabel}”`)
      }
      const sa = sets.get(a.id)!, sb = sets.get(b.id)!
      if (sa.size >= 5 && sb.size >= 5) {
        let shared = 0
        for (const id of sa) if (sb.has(id)) shared++
        const jaccard = shared / (sa.size + sb.size - shared)
        if (jaccard >= OVERLAP) {
          const w = weaker(a, b)
          add(w, 'overlap', `Shares ${Math.round(jaccard * 100)}% of its values with “${(w === a ? b : a).shortLabel}”`)
        }
      }
      const ha = dhash(a), hb = dhash(b)
      if (ha && hb && hashDistance(ha, hb) <= NEAR_DUPLICATE_BITS) {
        const w = weaker(a, b)
        add(w, 'weak-cover', `Cover looks the same as “${(w === a ? b : a).shortLabel}”`)
      }
    }
  }

  // The group most lists of each value type live in (only when it's a clear majority).
  const typeGroups = new Map<string, Map<string, number>>()
  for (const l of lists) {
    const counts = typeGroups.get(l.entityTypeId) ?? new Map<string, number>()
    counts.set(l.group.slug, (counts.get(l.group.slug) ?? 0) + 1)
    typeGroups.set(l.entityTypeId, counts)
  }
  const siteTakes = lists.reduce((sum, l) => sum + l.popularityCount, 0)

  for (const l of lists) {
    const n = values(l)
    if (n < Math.max(MIN_VALUES, l.maxItems)) add(l, 'needs-values', `Only ${n} values; aim for at least ${Math.max(MIN_VALUES, l.maxItems)}`)

    const counts = typeGroups.get(l.entityTypeId)!
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    const [majority, majorityCount] = [...counts].sort((a, b) => b[1] - a[1])[0]!
    if (total >= 3 && majorityCount / total >= 0.75 && majority !== l.group.slug) {
      const label = lists.find((x) => x.group.slug === majority)!.group.label
      add(l, 'wrong-group', `Other ${l.entityType.label} lists are in ${label}, this one is in ${l.group.label}`)
    }

    const q = (l.mediaAssets[0]?.metadata as any)?.quality
    const autoScore = (l.metadata as any)?.cover?.auto?.score as number | undefined
    if (q && (q.luminance < 0.12 || q.sharpness < 12 || q.transparency > 0.05)) {
      add(l, 'weak-cover', q.luminance < 0.12 ? 'Cover is very dark' : q.sharpness < 12 ? 'Cover is blurry' : 'Cover is a cut-out, not a photo')
    } else if (autoScore !== undefined && autoScore < 60) add(l, 'weak-cover', `Cover scored ${autoScore}/100`)

    const liveSince = new Date((l.metadata as any)?.firstLiveAt ?? l.createdAt)
    if (l.popularityCount === 0 && now.getTime() - liveSince.getTime() > 30 * 86400_000) {
      // Quiet until the site has enough takes for "nobody picks this" to mean something.
      add(l, 'low-takes', 'No completed takes in 30+ days', siteTakes >= LOW_TAKES_MIN_SITE_TAKES)
    }
  }

  const checkedAt = now.toISOString()
  const quality = new Map<string, ListQuality>(lists.map((l) => {
    const mine = issues.get(l.id)!
    const score = Math.max(0, 100 - mine.reduce((sum, i) => sum + PENALTY[i.code], 0))
    return [l.id, { score, issues: mine, checkedAt, version: QUALITY_VERSION }]
  }))
  return { catalog, quality }
}

/**
 * Writes each list's quality when its issues or score changed. Raw SQL keeps
 * Category.updatedAt untouched, so "Recently updated" in Admin → Lists only
 * moves for real edits.
 */
export async function writeQuality(catalog: Catalog, quality: Map<string, ListQuality>) {
  let written = 0
  for (const l of catalog.lists) {
    const next = quality.get(l.id)!
    const prev = (l.metadata as any)?.quality as ListQuality | undefined
    if (prev && prev.score === next.score && JSON.stringify(prev.issues) === JSON.stringify(next.issues)) continue
    const metadata = { ...((l.metadata as object | null) ?? {}), quality: next }
    await db.$executeRaw`UPDATE Category SET metadata = ${JSON.stringify(metadata)}, updatedAt = updatedAt WHERE id = ${l.id}`
    written++
  }
  // Retired lists keep no stale flags.
  await db.$executeRaw`UPDATE Category SET metadata = JSON_REMOVE(metadata, '$.quality'), updatedAt = updatedAt WHERE isActive = false AND JSON_CONTAINS_PATH(metadata, 'one', '$.quality')`
  return written
}

export type DomainConfig = Record<string, { label: string; groups?: string[]; keywords?: string[]; exclude?: string[]; min?: number; maxShare?: number }>

/** A whole word or phrase, plural allowed: "bar" matches "bar"/"bars", never "barbecue"; "cat" never "educational". */
const phrase = (k: string) => new RegExp(`(^|[^a-z])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?(?=[^a-z]|$)`, 'g')
type DomainStatus = 'missing' | 'thin' | 'ok' | 'overrepresented'

/** What the catalog has too much or too little of, for the next generation batch. */
export function coverageReport(catalog: Catalog, quality: Map<string, ListQuality>, domains: DomainConfig) {
  const { lists } = catalog
  const text = (l: List) => ` ${l.shortLabel} ${l.prompt} ${l.entityType.label} `.toLowerCase()
  const byDomain = Object.entries(domains).map(([slug, d]) => {
    // Excluded phrases use a keyword in another sense ("pet peeve", "candy bar", "spend time"); they're removed first.
    const matches = (l: List) => {
      const t = (d.exclude ?? []).reduce((s, x) => s.replace(phrase(x), ' '), text(l))
      return d.keywords?.some((k) => phrase(k).test(t))
    }
    const members = lists.filter((l) => d.groups?.includes(l.group.slug) || matches(l))
    const share = lists.length ? members.length / lists.length : 0
    const status: DomainStatus = !members.length ? 'missing' : d.min && members.length < d.min ? 'thin' : d.maxShare && share > d.maxShare ? 'overrepresented' : 'ok'
    return { domain: slug, label: d.label, status, lists: members.length, share: Math.round(share * 100) / 100, target: { min: d.min ?? null, maxShare: d.maxShare ?? null }, examples: members.slice(0, 5).map((l) => l.shortLabel) }
  })
  const groups = [...lists.reduce((m, l) => m.set(l.group.label, (m.get(l.group.label) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).map(([group, count]) => ({ group, count }))
  const flagged = lists
    .map((l) => ({ list: l.shortLabel, slug: l.slug, score: quality.get(l.id)!.score, issues: quality.get(l.id)!.issues.filter((i) => i.flagged).map((i) => `${i.code}: ${i.detail}`) }))
    .filter((f) => f.issues.length).sort((a, b) => a.score - b.score)
  return {
    generatedAt: new Date().toISOString(),
    activeLists: lists.length,
    summary: Object.fromEntries(byDomain.map((d) => [d.domain, d.status])),
    domains: byDomain.sort((a, b) => ['missing', 'thin', 'overrepresented', 'ok'].indexOf(a.status) - ['missing', 'thin', 'overrepresented', 'ok'].indexOf(b.status)),
    groups,
    flaggedLists: flagged,
    rules: 'Generate only in missing/thin domains; skip overrepresented ones. Check flaggedLists before adding a list that might duplicate one.',
  }
}
