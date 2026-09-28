# Discovery Feature

The Discovery domain (`features/discovery/`) handles core matching, feeding, and profile inspection.

## Key Screens
- `DiscoverFeedScreen`: The primary entry point. Combines filtering, feed fetching, and layout delegation.
- `ProfileDetailScreen`: A deep dive into an individual match, rendering `MatchDimensionsBreakdown` and `InsightList`.
- `QuickPicksScreen`: A fast, swipe-based interaction mode.

## Data Flow
Data primarily originates from `useDiscoverFeed`.
