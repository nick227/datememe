import { Grid } from './Grid'
import { Rail } from './Rail'
import { Spotlight } from './Spotlight'
import { River } from './River'
import { QuickPicksModule } from './QuickPicksModule'
import { QuickPicksSpotlight } from './QuickPicksSpotlight'
import { PersonalHistorySummary } from './PersonalHistorySummary'
import { isCollection, type ContentUnit, type FeedModule, type StructureState } from './types'

// The two personal-history beats (getListsFeed's "Your lists", getDiscoverFeed's
// "Your favorites") are identified by id, not `type` — ordinary topic-group
// rails on Lists also carry `type: 'lists'`, so type alone can't distinguish
// "this is the viewer's own running history" from "this is a rail of browsable
// content that happens to be list-shaped."
const PERSONAL_HISTORY_MODULE_IDS = new Set(['your-lists', 'your-favorites'])

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
      // Your lists / Your favorites collapse to a one-line summary instead
      // of rendering as a Rail at all — see PersonalHistorySummary.
      if (PERSONAL_HISTORY_MODULE_IDS.has(module.id)) {
        return <PersonalHistorySummary {...shared} itemNoun={module.type === 'favorites' ? 'favorite' : 'list'} />
      }
      // Small topic-group rails (type 'lists') run large enough to show
      // ranked covers/items inside each card; contextual nudge rails
      // (Add more, Because you liked X) stay narrower.
      const isWideRail = module.type === 'lists' || module.type === 'favorites'
      return <Rail {...shared} cardWidth={isWideRail ? 300 : undefined} />
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
