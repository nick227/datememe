# Application Data Flow

Understanding the flow of data is essential for diagnosing rendering bugs.

## The Standard Pipeline
1. **API Boundary**: `@project/sdk` provides React Query hooks (e.g., `useDiscoverFeed()`).
2. **Screen State**: A top-level screen (like `DiscoverFeedScreen`) consumes the query. The screen handles navigation, filtering state, and loading states.
3. **Module Delegation**: The screen passes `FeedModule` items to the `FeedModuleRenderer`.
4. **Structural Rendering**: `FeedModuleRenderer` decides which layout primitive (Grid, River, Rail) to use.
5. **Content Mapping**: The structural layout maps over `ContentUnit` items, passing them to `ContentUnitCard`.
6. **Polymorphic UI**: `ContentUnitCard` renders the final `PersonUnitCard` or `CategoryUnitCard` based on `unit.kind`.
7. **Action Dispatch**: User interactions call SDK mutation hooks, invalidating query caches to trigger automatic re-renders.

## Ownership Boundaries
- **Server**: Owns matching, ranking logic, layout structures (`suggestedStructure`), and media resolution.
- **React Query**: Owns caching, pagination deduplication, and retry logic.
- **Screen**: Owns local ephemeral state (like search queries) and scroll positioning.
- **FeedModuleRenderer**: Owns the contract of converting a server layout instruction into a valid RN layout component.
