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
