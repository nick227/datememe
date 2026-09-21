import { CategoryUnitCard } from './CategoryUnitCard'
import { PersonUnitCard } from './PersonUnitCard'
import { InsightUnitCard } from './InsightUnitCard'
import type { RenderVariant } from './renderBudgets'
import type { ContentUnit } from './types'

type Props = {
  unit: ContentUnit
  variant: RenderVariant
  onPress: () => void
}

/**
 * Single dispatch point from a generic ContentUnit to its kind-specific card.
 * The shared abstraction lives at the structure level (Grid/Rail/Spotlight/
 * River: layout mechanics, pagination, skeletons, render budgets) — not at
 * the pixel level. Forcing every kind through one literal layout would just
 * relocate the rigidity this system exists to remove.
 */
export function ContentUnitCard({ unit, variant, onPress }: Props) {
  switch (unit.kind) {
    case 'person':
      return <PersonUnitCard unit={unit} variant={variant} onPress={onPress} />
    case 'insight':
      return <InsightUnitCard unit={unit} variant={variant} />
    case 'category':
    case 'entity':
    case 'poll':
    default:
      return <CategoryUnitCard unit={unit} variant={variant} onPress={onPress} />
  }
}
