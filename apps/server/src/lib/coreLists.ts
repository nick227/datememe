/** SitePickGroup slug of the core compatibility set (catalog/core-lists.json). */
export const CORE_GROUP_SLUG = 'core'

/** Feed title that carries the viewer's progress — the app renders module titles, not their context. */
export function coreTitle(label: string, done: number, total: number) {
  return done >= total ? `${label} · all ${total} done` : `${label} · ${done} of ${total} done`
}
