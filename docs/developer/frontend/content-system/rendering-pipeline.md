# The Rendering Pipeline

When a Feed is rendered:
1. `DiscoverFeedScreen` parses the page data into a list of modules.
2. It maps them into `FeedModuleRenderer`.
3. `FeedModuleRenderer` reads `suggestedStructure` and maps to `<Grid>`, `<River>`, etc.
4. The Grid maps over items and renders `<ContentUnitCard>`.
5. `<ContentUnitCard>` switches on `unit.kind` and renders `<PersonUnitCard>`.
