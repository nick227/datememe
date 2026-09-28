# Deep Dive: FeedModuleRenderer

`ui/content/FeedModuleRenderer.tsx` is the switchboard of the application.

## Responsibility
It takes a `FeedModule` from the server and outputs a structural React Component (`Grid`, `River`, etc.).

## The Overrides
While it generally respects `module.suggestedStructure`, it applies hardcoded UI overrides when necessary:
- **`results` zone**: Unconditionally uses `<River>` for predictable vertical scanning.
- **Tech Stack (`site-picks-tech`)**: Overrides stretched rivers to force a compact `<Grid>` shape.
- **Personal History**: Detects `your-favorites` / `your-lists` and outputs a collapsed `<PersonalHistorySummary>`.
