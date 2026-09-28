# Deep Dive: DiscoverFeedScreen

`features/discovery/screens/DiscoverFeedScreen.tsx` is an Aggregator screen.

## Complexity Drivers
1. **Filtering**: It handles taxonomy chips and demographic filters. Applying a filter changes the layout mode (inserting an explicit 'Results' section followed by a boundary, rather than pure ambient discovery).
2. **Module Injecting**: The backend sends lists of modules. Discover manually reorders specific ID modules (e.g., `your-favorites`) above the filter chips.
3. **No Flash Scrolling**: Re-fetching triggers scroll resets to offset 0 rather than unmounting the `FlatList` to prevent UI flashes.
