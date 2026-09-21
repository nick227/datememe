import type { Metric } from './types'

export type RenderVariant = 'grid-dense' | 'grid-square' | 'rail' | 'spotlight' | 'river'

/**
 * A unit may carry more semantic data than a structure has room for. Renderers
 * select by priority; they never dump every field just because it's present —
 * see docs/shared-content-system-proposal.md §5.
 */
export const RENDER_BUDGETS: Record<RenderVariant, { metrics: number; badges: number; subtitle: boolean; actions: number }> = {
  'grid-dense': { metrics: 1, badges: 0, subtitle: false, actions: 1 },
  'grid-square': { metrics: 1, badges: 1, subtitle: true, actions: 1 },
  rail: { metrics: 2, badges: 1, subtitle: true, actions: 1 },
  spotlight: { metrics: 3, badges: 2, subtitle: true, actions: 2 },
  river: { metrics: 5, badges: 3, subtitle: true, actions: 2 },
}

const IMPORTANCE_RANK: Record<NonNullable<Metric['importance']>, number> = { primary: 0, secondary: 1, tertiary: 2 }

/** Sorts by `importance` (primary first, undefined last) and trims to the structure's metric budget. */
export function pickMetrics(metrics: Metric[] | undefined, variant: RenderVariant): Metric[] {
  if (!metrics?.length) return []
  const budget = RENDER_BUDGETS[variant].metrics
  return metrics
    .slice()
    .sort((a, b) => (a.importance ? IMPORTANCE_RANK[a.importance] : 99) - (b.importance ? IMPORTANCE_RANK[b.importance] : 99))
    .slice(0, budget)
}
