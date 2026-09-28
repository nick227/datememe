# Deep Dive: ListBuilderScreen

`features/lists/screens/ListBuilderScreen.tsx` is the interaction heavyweight of the app.

## Architecture
- **Dual Pane**: Left pane handles Search, Tag chips, and Fast Picks. Right pane is the reorderable `RankingBoard`.
- **Debounced Interaction**: The autocomplete query uses a 50ms debounce before hitting the `useCategoryEntities` query to prevent UI stutter.
- **Optimistic UI / Background Sync**: User choices (`picked`) are local state. A background `setTimeout` syncs the array to the server via `useUpsertList` continuously.
- **Error Boundaries**: Inline error banners allow retrying without destroying the user's reorder progress.
