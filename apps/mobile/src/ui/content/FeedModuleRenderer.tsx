import { Grid } from './Grid'
import { Rail } from './Rail'
import { Spotlight } from './Spotlight'
import { River } from './River'
import { QuickPicksModule } from './QuickPicksModule'
import { QuickPicksSpotlight } from './QuickPicksSpotlight'
import { isCollection, type ContentUnit, type FeedModule, type StructureState } from './types'

type Props = {
  module: FeedModule
  state: StructureState
  onPressItem: (unit: ContentUnit) => void
  onPressQuickPicks: () => void
  // Discover compares people's preferences (photo + "Prefers X"), not bare
  // things — Lists' quiz stays the plain taxonomy comparison.
  quickPicksPeopleMode?: boolean
}

/**
 * The one place that turns a `suggestedStructure` hint into an actual
 * component — advisory, never authoritative (proposal §1): a missing or
 * unrecognized hint falls back to Grid, the baseline grammar.
 */
export function FeedModuleRenderer({ module, state, onPressItem, onPressQuickPicks, quickPicksPeopleMode }: Props) {
  if (!isCollection(module)) {
    if (module.kind === 'quick-picks') return <QuickPicksModule onPress={onPressQuickPicks} />
    return null
  }

  // The feed only ever sends a marker for this — the actual comparison is
  // driven client-side against /quick-picks/next + /quick-picks/choice.
  // module.id keys the query so multiple instances down the feed don't share one prompt.
  if (module.type === 'quiz') return <QuickPicksSpotlight moduleId={module.id} peopleMode={quickPicksPeopleMode} />

  const shared = { testID: `feed.module.${module.id}`, title: module.title, items: module.items, state, onPressItem }

  switch (module.suggestedStructure) {
    case 'rail': {
      // Personal-history rails (Your lists / Your favorites) run large
      // enough to show ranked covers/items inside each card; contextual
      // nudge rails (Add more, Because you liked X) stay narrower.
      const isPersonalHistory = module.type === 'lists' || module.type === 'favorites'
      return <Rail {...shared} cardWidth={isPersonalHistory ? 300 : undefined} />
    }
    case 'spotlight':
      return <Spotlight {...shared} />
    case 'river':
      return <River {...shared} />
    case 'grid':
    default:
      return <Grid {...shared} gridShape={module.options?.gridShape} columns={module.options?.columns} />
  }
}
