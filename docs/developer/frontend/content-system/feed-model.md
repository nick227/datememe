# The Feed Model

The API provides data in `FeedModule` structures:
- `module.id`: Unique identifier (e.g., `people-grid-compatible`).
- `module.title`: Display title.
- `module.suggestedStructure`: `grid` | `rail` | `river` | `spotlight`.
- `module.items`: Array of `ContentUnit`s.

The frontend must obey this structure to enable server-side A/B testing of layouts.
