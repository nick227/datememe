// Hosts an import may download from, per provider. Openverse aggregates many
// sources; only those listed are fetched (the rest are filtered out when
// candidates are proposed), which keeps downloads to known image CDNs.
const HOSTS: Record<string, { exact?: string[]; suffix?: string[] }> = {
  wikimedia: { exact: ['upload.wikimedia.org', 'thumb.wikimedia.org', 'commons.wikimedia.org'] },
  openverse: { exact: ['api.openverse.org', 'upload.wikimedia.org', 'cdn.stocksnap.io', 'images.rawpixel.com'], suffix: ['.staticflickr.com'] },
}

export function isApprovedImageHost(provider: string, hostname: string) {
  const rule = HOSTS[provider]
  if (!rule) return false
  return !!rule.exact?.includes(hostname) || !!rule.suffix?.some((s) => hostname.endsWith(s))
}

/**
 * A Commons original at a standard thumbnail width (Wikimedia only serves
 * listed sizes). Originals can be tens of MB and get throttled when fetched
 * in a row; a sized copy is what we'd store anyway. Falls back to the original
 * when it isn't a Commons file or is narrower than the smallest useful size.
 */
export function wikimediaSizedUrl(url: string, originalWidth?: number, widths = [1920, 1280, 960, 500]) {
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?]+)$/)
  if (!m) return url
  const width = widths.find((w) => !originalWidth || originalWidth > w)
  return width ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${width}px-${m[3]}` : url
}
