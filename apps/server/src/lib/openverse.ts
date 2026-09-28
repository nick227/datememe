import { isApprovedImageHost, wikimediaSizedUrl } from './imageHosts'

// Openverse search for list cover candidates, with the cheap junk filters
// applied before anything is downloaded or scored.

export type CoverCandidate = {
  id: string; title: string; creator?: string; license: string; licenseVersion?: string; licenseUrl?: string
  attribution?: string; url: string; thumbnail: string; landingUrl?: string; width: number; height: number; source?: string
}

const USER_AGENT = 'Datememe/1.0 (https://datememe-server.up.railway.app; list cover proposals)'
export const MIN_WIDTH = 1200

// Titles/tags that are almost never a good card: cut-outs and graphics, maps
// and diagrams, and subjects that don't belong on a dating app's list cover.
const BLOCKLIST = /\b(png|clip ?art|clipart|vector|sticker|icon|logo|illustration|diagram|chart|map|infographic|screenshot|text|poster|flyer|memorial|funeral|grave|protest|riot|crash|accident|war|weapon|gun|blood|injur\w*|disaster|nude|naked)\b/i

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function searchOpenverse(q: string): Promise<any[]> {
  const params = new URLSearchParams({ q, license_type: 'commercial,modification', category: 'photograph', size: 'large', mature: 'false', page_size: '20' })
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) })
    if (response.ok) return ((await response.json()) as any).results ?? []
    if (response.status !== 429 || attempt === 2) throw new Error(`Openverse returned ${response.status}`)
    await sleep((Number(response.headers.get('retry-after')) || 30 * 2 ** attempt) * 1000)
  }
}

/** Openverse can't thumbnail Wikimedia-hosted files (HTTP 424); Commons serves its own resized copy. */
function previewUrl(r: { url: string; thumbnail: string }) {
  const sized = wikimediaSizedUrl(r.url, undefined, [500])
  return sized !== r.url ? sized : r.thumbnail
}

/** Reusable, big enough, a usable shape (3:4 cards and 16:9 rails both crop from it), approved host, no blocklisted words. */
export function usableCandidates(results: any[]): CoverCandidate[] {
  return results
    .filter((r) => r.width >= MIN_WIDTH && r.height && r.width / r.height >= 0.7 && r.width / r.height <= 2.4)
    .filter((r) => { try { return isApprovedImageHost('openverse', new URL(r.url).hostname) } catch { return false } })
    .filter((r) => !BLOCKLIST.test(`${r.title ?? ''} ${(r.tags ?? []).map((t: any) => t.name).join(' ')}`))
    .map((r) => ({
      id: r.id, title: r.title ?? '', creator: r.creator ?? undefined, license: r.license, licenseVersion: r.license_version,
      licenseUrl: r.license_url, attribution: r.attribution, url: r.url, thumbnail: previewUrl(r), landingUrl: r.foreign_landing_url,
      width: r.width, height: r.height, source: r.source,
    }))
}

export async function fetchThumbnail(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20000) })
      if (response.ok && (response.headers.get('content-type') ?? '').startsWith('image/')) return Buffer.from(await response.arrayBuffer())
      if (response.status === 404 || response.status === 424) return null
      await sleep(8000 * (attempt + 1))
    } catch { await sleep(3000) }
  }
  return null
}
