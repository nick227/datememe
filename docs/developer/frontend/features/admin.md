# Admin Feature

The Admin domain (`features/admin/`) is the largest single feature directory, acting as the internal tooling dashboard for datememe.

## Responsibilities
- User moderation and metadata lookups.
- Content operations via `runCatalogOperations.ts`.
- Managing taxonomies (`AdminTaxonomyScreen`, `AdminTaxonomyEntityScreen`).
- Managing coupons, grants, and redemptions.

## Core Screens
- `AdminDashboardScreen`: Root entry point.
- `AdminListsScreen` / `AdminContentScreen`: Entity review interfaces.
