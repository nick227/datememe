import type { ImageCandidate, ImageProvider } from './types'

const USER_AGENT = 'Datememe/1.0 (taxonomy image importer)'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

async function getJson(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Wikimedia request failed with ${response.status}`)
  return response.json() as Promise<any>
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/<[^>]+>/g, '').trim() : undefined
}

async function getCommonsImage(filename: string, wikidataId: string, label: string): Promise<ImageCandidate | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    titles: `File:${filename}`,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '800',
  })
  const data = await getJson(`${COMMONS_API}?${params}`)
  const page = data.query?.pages?.[0]
  const info = page?.imageinfo?.[0]
  if (!info?.thumburl || !info?.url) return null

  const license = cleanText(info.extmetadata?.LicenseShortName?.value)
  const creator = cleanText(info.extmetadata?.Artist?.value)
  const allowed = Boolean(license && /^(cc0|public domain|cc by(?:-sa)?)/i.test(license))

  return {
    provider: 'wikimedia',
    externalId: wikidataId,
    title: label,
    previewUrl: info.thumburl,
    sourceUrl: info.url,
    landingUrl: info.descriptionurl,
    creator,
    license,
    licenseUrl: cleanText(info.extmetadata?.LicenseUrl?.value),
    attribution: creator && license ? `${creator} · ${license}` : creator ?? license,
    width: info.width,
    height: info.height,
    importRule: allowed ? 'IMPORT_ALLOWED' : 'REVIEW_REQUIRED',
    metadata: { filename, wikidataId, mime: info.mime },
  }
}

async function searchCommonsImage(query: string): Promise<ImageCandidate | null> {
  const searchParams = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    list: 'search',
    srsearch: `${query} filetype:bitmap`,
    srnamespace: '6',
    srlimit: '5',
  })
  const search = await getJson(`${COMMONS_API}?${searchParams}`)
  const title = search.query?.search?.[0]?.title
  if (!title?.startsWith('File:')) return null
  return getCommonsImage(title.slice(5), `commons:${title}`, query)
}

/** Resolve a reviewed identity without silently substituting a same-name subject. */
export async function resolveWikidataImage(id: string): Promise<ImageCandidate | null> {
  if (!/^Q\d+$/.test(id)) throw new Error('Invalid Wikidata identity')
  const data = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`)
  const entity = data.entities?.[id]
  const filename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  if (!filename) return null
  return getCommonsImage(filename, id, entity.labels?.en?.value ?? id)
}

export const wikimediaProvider: ImageProvider = {
  id: 'wikimedia',
  label: 'Wikidata / Wikimedia Commons',
  priority: 10,
  async search({ query }) {
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: query,
      language: 'en',
      format: 'json',
      limit: '8',
    })
    const search = await getJson(`${WIKIDATA_API}?${params}`)
    const results = await Promise.all((search.search ?? []).map(async (item: any) => {
      try {
        const entity = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${item.id}.json`)
        const claims = entity.entities?.[item.id]?.claims?.P18 ?? []
        const filename = claims[0]?.mainsnak?.datavalue?.value
        if (filename) return getCommonsImage(filename, item.id, item.label ?? query)
        return null
      } catch {
        return null
      }
    }))
    if (search.search?.length) return results.filter(Boolean) as ImageCandidate[]
    const commonsFallback = await searchCommonsImage(query)
    return commonsFallback ? [commonsFallback] : []
  },
}
