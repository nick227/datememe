/**
 * `CompatibilityScore.sharedFavorites` is a loosely-typed JSON column, and a
 * handful of legacy rows predate `categoryShortLabel` being added to the
 * shape (they only have `entityName`) — the OpenAPI `SharedFavorite` schema
 * requires both fields, so `fast-json-stringify` throws a 500 on any
 * response that includes one of these rows unnormalized. Every read site
 * for this column must pass through here before it reaches a response body.
 */
export function normalizeSharedFavorites(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      categoryShortLabel: typeof item.categoryShortLabel === 'string' ? item.categoryShortLabel : 'Shared favorite',
      entityName: typeof item.entityName === 'string' ? item.entityName : 'Unknown',
    }))
}
