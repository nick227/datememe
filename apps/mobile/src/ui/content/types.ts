import type { components } from '@project/sdk'

export type ContentUnit = components['schemas']['ContentUnit']
export type FeedModule = components['schemas']['FeedModule']

// FeedModule is one flat wire schema (see openapi.yaml's comment on it — fast-json-stringify
// can't reliably serialize a oneOf of structurally-similar objects); these two are the
// TypeScript-level narrowings of it, discriminated on `moduleKind`.
export type ContentCollection = FeedModule & { moduleKind: 'collection'; type: NonNullable<FeedModule['type']>; items: NonNullable<FeedModule['items']> }
export type InteractiveModule = FeedModule & { moduleKind: 'interactive'; kind: NonNullable<FeedModule['kind']> }

export type PageSummary = components['schemas']['PageSummary']
export type FilterChip = components['schemas']['FilterChip']
export type Metric = components['schemas']['Metric']

export type StructureName = 'grid' | 'rail' | 'spotlight' | 'river'
export type GridShape = 'square' | 'dense'

/** loading/empty/error/ready — every structure's state contract (proposal §7). */
export type StructureState = 'loading' | 'ready' | 'empty' | 'error'

export function isCollection(module: FeedModule): module is ContentCollection {
  return module.moduleKind === 'collection'
}
