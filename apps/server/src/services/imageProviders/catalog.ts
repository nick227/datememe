import type { ImageCandidate, ImageProvider } from './types'

function configured(id: string, label: string, priority: number, keyName: string, searchUrl: (query: string, key: string) => string, map: (item: any, query: string) => ImageCandidate | null, headers?: (key: string) => Record<string, string>): ImageProvider {
  return {
    id,
    label,
    priority,
    async search({ query }) {
      const key = process.env[keyName]
      if (!key) return []
      const response = await fetch(searchUrl(query, key), { headers: headers?.(key) })
      if (!response.ok) throw new Error(`${label} request failed with ${response.status}`)
      const data = await response.json() as any
      const items = data.results ?? data.photos ?? data.hits ?? []
      return items.map((item: any) => map(item, query)).filter(Boolean) as ImageCandidate[]
    },
  }
}

export const tmdbProvider = configured(
  'tmdb',
  'TMDB',
  20,
  'TMDB_API_KEY',
  (query, key) => `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&include_adult=false`,
  (item, query) => {
    const path = item.poster_path || item.profile_path || item.backdrop_path
    if (!path) return null
    return {
      provider: 'tmdb', externalId: String(item.id), title: item.title || item.name || query,
      previewUrl: `https://image.tmdb.org/t/p/w500${path}`, landingUrl: `https://www.themoviedb.org/${item.media_type}/${item.id}`,
      importRule: process.env.TMDB_ALLOW_IMPORT === 'true' ? 'IMPORT_ALLOWED' : 'HOTLINK_ONLY',
      metadata: { mediaType: item.media_type },
    }
  },
)

export const unsplashProvider = configured(
  'unsplash',
  'Unsplash',
  70,
  'UNSPLASH_ACCESS_KEY',
  (query, key) => `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&client_id=${encodeURIComponent(key)}`,
  (item, query) => ({
    provider: 'unsplash', externalId: String(item.id), title: item.alt_description || query,
    previewUrl: item.urls?.small || item.urls?.regular, sourceUrl: item.urls?.regular,
    landingUrl: item.links?.html, creator: item.user?.name, license: 'Unsplash License',
    attribution: item.user?.name ? `Photo by ${item.user.name} on Unsplash` : undefined,
    width: item.width, height: item.height, importRule: 'HOTLINK_ONLY',
  }),
  (key) => ({ Authorization: `Client-ID ${key}` }),
)

export const pexelsProvider = configured(
  'pexels',
  'Pexels',
  75,
  'PEXELS_API_KEY',
  (query) => `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`,
  (item, query) => ({
    provider: 'pexels', externalId: String(item.id), title: item.alt || query,
    previewUrl: item.src?.medium || item.src?.large, sourceUrl: item.src?.large,
    landingUrl: item.url, creator: item.photographer, license: 'Pexels License',
    width: item.width, height: item.height, importRule: 'HOTLINK_ONLY',
  }),
  (key) => ({ Authorization: key }),
)

export const pixabayProvider = configured(
  'pixabay',
  'Pixabay',
  80,
  'PIXABAY_API_KEY',
  (query, key) => `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=12`,
  (item, query) => ({
    provider: 'pixabay', externalId: String(item.id), title: query,
    previewUrl: item.webformatURL, sourceUrl: item.largeImageURL, landingUrl: item.pageURL,
    creator: item.user, license: 'Pixabay Content License', width: item.imageWidth, height: item.imageHeight,
    importRule: 'REVIEW_REQUIRED',
  }),
)
