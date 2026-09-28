# Naming Conventions

Explicitly reserve suffixes and ban ambiguous names to ensure predictable architecture and file responsibilities.

## Reserved Suffixes

| Suffix | Meaning |
| --- | --- |
| Screen | navigation target |
| View | full presentation with no data ownership |
| Card | standalone item presentation |
| Row | horizontal/list item |
| Section | page composition grouping |
| Layout | geometry for children |
| Controller / useX | feature state/behavior |
| Adapter | pure data transformation |
| Renderer | selects implementation from declared type |
| Shell | structural chrome/slots |
| Skeleton | loading analog |
| Provider | React context provider |

## Banned Ambiguous Names

Do not use ambiguous names unless the meaning genuinely fits. Avoid:

- ThingManager
- ThingHelper
- ThingUtils
- ThingContainer
- CommonThing
- GenericThing
