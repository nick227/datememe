# Frontend Rules

The following are the core development laws for the frontend architecture. These rules must be followed to maintain separation of concerns, consistency, and a scalable UI architecture.

FR-01 Screens orchestrate; they do not implement reusable card anatomy.
FR-02 API ContentUnit types never determine geometry directly.
FR-03 Layout selects collection geometry.
FR-04 CardVariant selects item geometry.
FR-05 Content adapters map semantic data into CardModel.
FR-06 Shared card presentations never import feature modules.
FR-07 Module IDs must never select visual implementations.
FR-08 Server media URLs are authoritative.
FR-09 No feature creates a second implementation of an existing visual pattern.
FR-10 New colors, spacing, radius, or typography values require tokens.
FR-11 Query data stays in React Query unless actively edited.
FR-12 Local edited copies must have explicit save/sync ownership.
FR-13 Cross-feature navigation must use a typed navigation helper.
FR-14 Feature-specific components live under features; reusable visual grammar lives under ui.
FR-15 New card types must be implemented by composing existing primitives first.
