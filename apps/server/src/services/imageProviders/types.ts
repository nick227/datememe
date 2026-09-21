export type ImageImportRule = 'IMPORT_ALLOWED' | 'HOTLINK_ONLY' | 'REVIEW_REQUIRED'

export type ImageSearchContext = {
  query: string
  entityTypeLabel?: string
  parentPath?: string
}

export type ImageCandidate = {
  provider: string
  externalId: string
  title: string
  previewUrl: string
  sourceUrl?: string
  landingUrl?: string
  creator?: string
  license?: string
  licenseUrl?: string
  attribution?: string
  width?: number
  height?: number
  importRule: ImageImportRule
  metadata?: Record<string, unknown>
}

export interface ImageProvider {
  id: string
  label: string
  priority: number
  search(context: ImageSearchContext): Promise<ImageCandidate[]>
}
