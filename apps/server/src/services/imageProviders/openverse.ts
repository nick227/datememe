import type { ImageCandidate, ImageProvider } from './types'

export const openverseProvider: ImageProvider = {
  id: 'openverse',
  label: 'Openverse',
  priority: 40,
  async search({ query }) {
    const params = new URLSearchParams({ q: query, page_size: '12', license_type: 'commercial,modification' })
    const response = await fetch(`https://api.openverse.org/v1/images/?${params}`)
    if (!response.ok) throw new Error(`Openverse request failed with ${response.status}`)
    const data = await response.json() as any

    return (data.results ?? []).map((item: any) => ({
      provider: 'openverse',
      externalId: String(item.id),
      title: item.title || query,
      previewUrl: item.thumbnail || item.url,
      sourceUrl: item.url,
      landingUrl: item.foreign_landing_url || item.detail_url,
      creator: item.creator,
      license: item.license,
      licenseUrl: item.license_url,
      attribution: item.attribution,
      width: item.width,
      height: item.height,
      importRule: ['cc0', 'pdm', 'by', 'by-sa'].includes(String(item.license).toLowerCase()) ? 'IMPORT_ALLOWED' : 'REVIEW_REQUIRED',
      metadata: { source: item.source, provider: item.provider, filetype: item.filetype },
    }))
  },
}
