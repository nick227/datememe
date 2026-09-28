# Admin → Lists: roadmap

*2026-09-28. Phase 1 **built** (commits `dc76c20`, `1b03b75`, `bb5ce7c`, `8a91283`).*

**Built vs spec:**
- **Cover suggestion runs in the server process, not a worker job.** The worker has no access to the cover libraries or the uploads volume. The state lives in `metadata.coverSuggest`, the app polls it, and a run interrupted by a restart shows as failed after 10 minutes.
- **Values reorder with ↑/↓, no drag yet.**
- **"Hidden · Never published" applies only to lists created in Admin.** Older lists predate `firstLiveAt`.
- **Other agents' subject dedupe:** each new cover decision records its `cover.subject`. Covers chosen before Phase 1 only have one if `covers:improve --apply` has been run since.

## Goal

Admin → Lists should be an operational tool, not a mini CMS.

**Phase 1 acceptance test:** an admin can do all of the following without touching SQL, scripts or taxonomy internals:
- find any production list in seconds,
- see what users see,
- fix its text, values or cover,
- hide or show it,
- create a basic new list.

Phase 1 is **two screens and one sheet**: **Lists**, **List edit** and **Change cover**. The automation we've built (cover finding, scoring, dedupe, card crops, rankings) runs underneath and shows up as good defaults the admin can override.

---

## 1. Today

| Screen | What it does | Problem |
|---|---|---|
| **Lists** (`AdminListsScreen`) | A flat list of every definition, live and retired: name, "Scope: {type}", Archived pill | No search, sort, filter or cover. You can't see which lists need work. |
| **List detail** (`AdminListDetailScreen`, 629 lines) | Every `Category` column side by side (slug, entity type, parent constraint, min/max, ordering, match signal, premium, active), an image picker and a values editor | Built for engineers. The image picker crops **1:1**; list cards are **3:4**. |
| **Content Factory** (`AdminContent*`) | Concepts → list ideas → drafts → values → publish | Local-only: `CatalogService.writable()` refuses production. It keeps a second set of objects (Concept, CategoryDraft, EntityCandidate, GenerationOperation). |

Production lists are published today through `catalog/lists/*.json` → `pnpm prod:publish-catalog`, run from a laptop.

---

## 2. Decisions (locked)

1. **Hidden replaces Draft.** New lists start Hidden (`isActive=false`); there is no draft object. A list that has never been live shows **Hidden · Never published**. This is derived, not a new state: it's true when the list has no completed `List` rows and no `metadata.firstLiveAt`, which we stamp the first time it goes Live.
2. **The database is the operational truth.** Catalog files stay the bulk-creation path, but the importer must not overwrite lists edited in Admin. It already never rewrites text or order on an existing list. It *does* re-add file values that are missing from the list, so **a value an admin removed would come back** on the next `catalog:publish`. Fix: admin edits stamp `metadata.adminEditedAt`, and the importer adds no values to a list that has one, only reporting "file differs".
3. **Auto-cover: yes.** A new list gets a cover automatically once it has enough content, provided the best candidate clears the same bar as `covers:backfill` (score ≥ 72, relevance ≥ 7, distinct). The admin can change it afterward.
4. **Takes are shown now.** `Category.popularityCount` (completed lists, kept by the rankings rebuild) tells dead lists from live ones at a glance.
5. **Value type is read-only on existing lists.** Picking one is allowed only when creating a list, and only from existing types; creating a new type stays in Taxonomy.
6. **Content Factory is left alone in Phase 1.** Its Admin navigation entry is removed once the new List page covers ordinary editing. Its tables stay.
7. **New values from + Add are deduped and traceable, not pending.** A `PENDING` entity is visible only to its submitter (`serializeListForViewer`, docs §5.3), so a pending value would vanish from the list for every user. Instead:
   - + Add first runs the same exact/alias/fuzzy match that user submissions use, and offers the existing value.
   - Only then does it create an `APPROVED` entity tagged `metadata.origin = {by: 'admin', userId, listId, at}`, so admin-created values can be listed and reviewed in Taxonomy later.
8. **Cover is never a hard blocker.** Going Live needs a cover *or* an explicit **No cover** (the placeholder). If Openverse or the model is unavailable, the admin can still publish.

---

## 3. Phase 1 UI

### 3.1 Lists

```
Lists                                      + New

[ Search lists…                              ]

[ All ] [ Live ] [ Hidden ] [ Needs attention ]
Group ▾                                  Sort ▾

▯  Favorite Superheroes                   Live
   Film & TV · 18 values · 42 takes

▯  Green Flags                            Live
   Dating · 14 values · 9 takes

▯  Late-Night Snack                   ⚠ Cover
   Food & Drink · 12 values · 0 takes
```

- **Search:** title, question and slug, as you type.
- **Chips:**
  - All / Live / Hidden / Needs attention.
  - **Needs attention** means any of:
    - no cover decision;
    - fewer values than the list's max picks;
    - failed cover automation — the new `COVER_SUGGEST` job records `metadata.coverSuggest = {status, error, at}`, so this costs nothing extra.
  - A weak-cover signal can join later if it proves useful.
- **Group ▾:** filter by `CategoryGroup`.
- **Sort ▾:** Recently updated (default) · A–Z · Most taken.
- **Row contents:**
  - thumbnail (the 3:4 card),
  - title,
  - group,
  - value count,
  - takes,
  - **one** badge: Live, Hidden, Hidden · Never published, or the single most important problem (⚠ Cover, ⚠ Values, ⚠ Cover failed).
- Tapping a row opens **List edit**; **+ New** opens the same page, empty.

### 3.2 List edit

```
← Favorite Superheroes            Live ●   Save

COVER
[ 3:4 preview ]    Wonder Woman figurine
                   CC0 · Openverse
                   [ Change ]

TEXT
Title       [ Favorite Superheroes             ]
Question    [ Who are your favorite...         ]
Group       [ Film & TV                     ▾ ]

VALUES (18)                              [+ Add]
≡ Spider-Man                                  ×
≡ Batman                                      ×
≡ Wonder Woman                                ×
…

VISIBILITY
Live on app                                [ ON ]

▸ Advanced
```

- **Cover:** the real app card (`imageCardUrl`) with its attribution. **Change** opens the sheet (3.3).
- **Text:** Title (`shortLabel`), Question (`prompt`), Group.
- **Values:**
  - The ordered curated list, with drag to reorder (↑/↓ fallback) and × to remove.
  - **+ Add** searches existing values of the list's type. If nothing fits, it creates a new one by name, after the duplicate check in decision 7, and labels it "new" in the row.
  - No AI suggestions in Phase 1.
- **Visibility:**
  - Live on app (`isActive`).
  - Turning Live on runs a check: title, question, at least the max-picks number of values, and a cover **or** an explicit No cover. Anything missing is shown inline.
- **Advanced**, collapsed:
  - slug,
  - ranked / unranked,
  - min / max picks,
  - counts toward matching,
  - value type (read-only).
- **Saving:**
  - One **Save** covers Text, Visibility and Advanced.
  - Values and Cover save as their own actions.
  - Any save stamps `metadata.adminEditedAt` (decision 2).

### 3.3 Change cover

```
Change cover                                 ✕

Suggested

[ image ] [ image ] [ image ]
[ image ] [ image ] [ image ]

                          [ Use this cover ]

[ Upload ]
[ No cover ]
[ Revert previous ]
```

- **Suggested:**
  - The top 6 candidates from the existing cover automation for this list, shown as 3:4 crops with their attribution; the best one is preselected.
  - They are already duplicate-safe: no image or near-image of another list, and no repeat of another list's subject.
  - The first load takes ~20–40 s, so the sheet shows progress, and results are cached per list.
- **Use this cover:** records the decision and imports the image. The page updates when the card variant is ready.
- **Upload:** pick a photo, crop to **3:4**, and it becomes the cover.
- **No cover:** an explicit choice; users see the placeholder.
- **Revert previous:** restores `cover.replaced`.
- Deliberately **not** in Phase 1: free-text search, "used by X" indicators, scores or explanations.

### 3.4 New list

This is the same page as List edit, starting Hidden:

```
Title · Question · Group · Value type (existing only) · Values (+ Add) · Cover · Live
```

- Values are added manually.
- The cover is filled in automatically once the list has enough values (decision 3).
- If suggestion fails or finds nothing good, the list shows ⚠ Cover failed. The admin can retry, upload, or choose No cover and go Live anyway (decision 8).
- The admin turns it Live when ready.
- There are no concepts, drafts or operations screens.

---

## 4. Under the covers

```
          ┌──────────── Admin UI (apps/mobile) ────────────┐
          │  Lists · List edit · Change cover · New list   │
          └───────────────┬────────────────────┬───────────┘
                          │ API (server)       │ job (worker)
   ┌──────────────────────┼────────────────────┼──────────────────────┐
   │ Category CRUD +      │ Cover decision     │ COVER_SUGGEST        │
   │ curated values       │ Category.metadata  │  briefs → Openverse  │
   │ (ListService /       │   .cover (+replaced)│  → size/host/word   │
   │  adminCategories)    │        │           │    filters           │
   │                      │        ▼           │  → dark/blur/cut-out │
   │                      │ Media import       │  → phash + subject   │
   │                      │ (server container) │    dedupe            │
   │                      │  3:4 attention crop│  → vision score      │
   │                      │  quality + dhash   │ RANKINGS_REBUILD     │
   │                      │                    │  (takes, #1)         │
   └──────────────────────┴────────────────────┴──────────────────────┘
```

| Automation | Code | Where the admin meets it |
|---|---|---|
| Cover candidates and scoring | `lib/openverse`, `lib/coverScoring`, `scripts/covers-auto` | Suggested grid; auto-cover on new lists |
| Image checks, dedupe, 3:4 card | `lib/coverImage`, `TaxonomyMediaService.coverExtras` | Previews are the real card; no duplicate covers |
| One cover per list, never shared | `lib/categoryCovers`, media audit | Invisible; guaranteed |
| Takes and #1 | worker `RANKINGS_REBUILD` (15 min) | Takes on each row |
| Bulk AI-authored batches | `catalog/lists/*.json`, `prod:publish-catalog` | Lists appear; admin edits are never overwritten |

### Backend work Phase 1 needs

1. **Admin list endpoint.**
   - Takes `q`, `status`, `groupId`, `sort` and pagination.
   - Returns per row: `imageCardUrl`, `coverStatus`, `valueCount`, `takes` and `neverPublished`.
   - Today's endpoint returns every list with every media asset.
2. **Cover decisions from Admin write `metadata.cover`.** **Bug today:** admin uploads don't, so the next media-sync restores the old approved cover. Every path (suggested, upload, none, revert) writes the decision and keeps `replaced`.
3. **3:4 upload crop.** It's currently 1:1.
4. **One-list cover suggestion.** Extract `covers-auto`'s per-list logic into a function the API and worker can call. It runs as a `COVER_SUGGEST` job with cached results, records its outcome in `metadata.coverSuggest`, and is also used for auto-cover on new lists.
5. **Importer respects admin edits** (decision 2).
6. **`firstLiveAt` stamp.** Written the first time a list goes Live.
7. **+ Add with duplicate check and `metadata.origin`** (decision 7). This reuses `TaxonomyService`'s submission matching.

Openverse allows ~200 anonymous searches a day, and each list's suggestion uses 4. That's fine for Phase 1 with caching. Register an Openverse API key before this is used heavily.

---

## 5. Roadmap

| Phase | Scope |
|---|---|
| **1: Operational POC** | Sections 3–4 above. Remove the Content Factory nav entry at the end. |
| **2: Assist** | Suggest values (AI checklist, person in the loop), Suggest a list, creating a new value type from New list, free-text cover search with "used by X", Content Factory screens and tables retired. |
| **3: Metrics** | Per list: takes over time, completion rate, where people abandon, top picks and #1 trend, match contribution, cover click-through. Usage-based "Needs attention" (e.g. rarely finished). |
| **Later** | Bulk hide/move, weak-cover sort, value images if they come back. |

---

## Appendix: files involved

- **Mobile:**
  - `apps/mobile/src/features/admin/screens/AdminListsScreen.tsx`, `AdminListDetailScreen.tsx`
  - `components/AdminImagePicker.tsx`
  - `navigation/AdminStack.tsx`
  - The Admin dashboard's Content Factory entry
- **Server:**
  - `handlers/adminCategories.ts`, `services/ListImporterService.ts`, `services/TaxonomyMediaService.ts`
  - `lib/coverImage.ts`, `lib/coverScoring.ts`, `lib/openverse.ts`, `lib/categoryCovers.ts`
  - `scripts/covers-auto.ts`, `scripts/media-sync.ts`
- **Worker:** `apps/worker/src/jobs/RankingsRebuildJob.ts` (the pattern for `CoverSuggestJob`).
- **Spec:** `packages/api-spec/openapi.yaml`, then `pnpm sdk:generate`.
