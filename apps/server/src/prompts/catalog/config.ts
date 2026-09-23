// Developer tuning lives here and in the adjacent plain-text templates.
export const catalogConfig = {
  CONCEPTS: { template: 'concepts', count: 50, max: 100 },
  LIST_IDEAS: { template: 'lists', count: 10, max: 20 },
  VALUES: { template: 'values', count: 20, max: 50 },
  FACETS: { template: 'facets', count: 5, max: 10 },
} as const
export type GenerationKind = keyof typeof catalogConfig
export const promptVersion = '2'
export const generationModel = process.env.CATALOG_MODEL || 'gpt-4o-mini'
export const generationTimeoutMs = 60000
export const facetVocabulary = {
  tone: ['dark', 'playful', 'nostalgic', 'campy', 'uplifting'],
  theme: ['exploration', 'isolation', 'community', 'adventure'],
  style: ['cerebral', 'experimental', 'minimalist', 'traditional'],
}
