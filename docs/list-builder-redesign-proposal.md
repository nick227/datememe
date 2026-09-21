# List Builder / Poll Redesign Proposal

## Core Design Concept

> **A clean editorial ranking board where finding choices feels lightweight and arranging favorites feels tactile.**
> 
> The builder is a fixed workspace, not a growing form. Options move between stable states; the page geometry does not move.
> 
> **Core Principle:** Visual feedback may change state, but never geometry. This applies to selection, saving, dragging, errors, max-selected limits, and moderation status.

The current list builder behaves like a form that mutates its own layout instead of a stable ranking workspace. This redesign aims to resolve visual instability, improve the speed of creating ranked lists, and establish a premium visual identity.

## Domain Boundaries

To prevent UI code from becoming responsible for business-rule enforcement, we explicitly separate the frontend interaction model from the backend domain logic:
* **Builder UX Contract:** A stable ranking workspace for interacting with options.
* **Poll Publication Contract:** The domain logic governing whether a poll may enter public discovery.

---

## Part 1: Builder UX Contract

### 1. Hard No-Layout-Shift Invariant
Adding, removing, selecting, deselecting, or reordering an option **must not** change the vertical position of the input, fast-pick area, ranking region, or save action.
* The candidate area, selected area, input, and action button should all occupy stable positions.
* The behavior of inserting a giant selected card above the available choices must be eliminated.

### 2. Layout Geometry & Responsive Behavior
**Desktop (Two-Column Layout):**
* **Split:** 55/45 or 60/40 (Left: Discovery / Right: Ranking).
* **Max Content Width:** Configured (e.g., `1024px` or `1200px`) to prevent sprawling on ultrawide monitors.
* **Left Side (Discovery):** Input and options.
* **Right Side (Ranked List):** Keep rank slots visible and sticky while scrolling options. The sticky panel width should remain fixed based on the column split.

**Tablet / Mobile (Stacked Layout):**
To avoid excessive vertical travel while maintaining context, the stack order must be:
1. Question
2. Rank slots (Reserved height)
3. Input
4. Autocomplete
5. Fast picks
6. Sticky save (Done action)

### 3. Reserved Space, Rank Slots, & Empty States
The selected-picks area must exist at full height from the moment the page loads. Instead of `PICKED 0 OF 5`, show the actual rank slots:

**Your top 5**
1. Add your #1
2. Add your #2
3. Add your #3
4. Add your #4
5. Add your #5

Empty states must be visually intentional (e.g., a row of structured empty boxes) rather than blank gray rectangles.

**Scaling Reserved Height:**
Reserve full ranked-slot height for small lists; above a configured threshold, use a fixed-height scrollable ranking region.
* `maxSelections <= 5`: Full reserved height
* `maxSelections > 5`: Fixed-height ranked panel with internal scrolling

### 4. Adding Options & Capacity Limits
* **If empty slots exist:** Place the added option in the next available empty slot.
* **If all slots are full:** Do not silently replace anything. Require the user to explicitly remove or reorder an option first. This avoids accidental rank destruction.
* **Selection State on Fast Picks:** Fast picks must never be removed after selection. The card dimensions (size, padding, text-wrap) must remain identical before and after selection. Only the rank label, border/accent color, and opacity should change (e.g., swapping a `+` for a `#1`). This provides immediate feedback without layout shift.
* Do not force all 5 picks unless the product explicitly requires it. If mandatory, explain that explicitly.

### 5. Reordering & Removing Behavior (With Motion)
Reordering and removing must feel physical. Interactions should use subtle, short animations (150–250ms):
* **Drag-and-Drop:** Primary reorder mechanism. The whole ranked row is selectable, but must feature a **dedicated visible drag handle** so reordering does not conflict with remove/open actions. Keyboard fallback supported.
* **Adding:** New selection smoothly slides into its `#N` slot.
* **Reorder Logic:** Dropping an option smoothly shifts the intervening ranks. Rank numbers update immediately.
* **Fast-pick State Sync:** If a selected fast-pick changes rank due to drag/reorder, its displayed `#N` updates simultaneously.
* **Removal Logic:** Removing an option smoothly compacts lower-ranked items upward. An empty slot returns at the bottom.

### 6. Search / Autocomplete Interaction
* **Visual Identity:** The input should feel like an additive action, not a filter. It should use clear placeholders, e.g., "Type an artist name...", alongside a visible `+` or "Add" affordance. The input should not be heavily boxed (use whitespace, typography, thin dividers).
* **Overlay Constraints:** Typing opens an anchored suggestion dropdown that visually floats over the page.
  * It must anchor to the input.
  * It must have a capped height with internal scroll.
  * It must remain above both columns on desktop.
  * On mobile, it must still overlay rather than insert rows into the document flow, never resizing the workspace.
* **Keyboard First:** Support "Type → arrows → Enter to add" for rapid list building. Automatically refocus the input after adding.

**Option Resolution Priority & Deduplication:**
Enforce a deterministic resolution flow for typed inputs:
1. Exact existing option?
2. Exact canonical entity?
3. Close entity suggestions
4. New suggestion

*Example:* `Bruno Mars` (Artist · Existing) vs. `Bruno Marz` (Suggest new artist). Autocomplete must visually distinguish between existing entities and new suggestions.

### 7. Autosave, "Done", and Optimistic Updates
* **Semantic Actions:**
  * **Autosave:** Preserve draft state continuously in the background.
  * **Done:** Intentionally exit/complete the editing session (the sticky button should be labeled "Done").
    * *Invariant:* If the user taps "Done" while the latest autosave is still pending, the UI must wait for the save to complete or keep the local draft queued. "Done" must never race the autosave and lose the last change.
  * **Publish:** A separate domain action.
* **Optimistic Error Recovery:** 
  * local reorder → optimistic render → background save
  * save succeeds → `Saved`
  * save fails → retain user's local ordering → show `Couldn't save / Retry` (do not silently snap back).

### 8. Visual Aesthetics & Hierarchy
Establish a strong **Editorial / Ranking Board** identity:
* **Visual Hierarchy (Three Levels):**
  1. Large: Question/title
  2. Medium: Ranked selections (The rank panel should feel 30–40% visually stronger than the fast-pick area)
  3. Small: Fast picks / metadata / save state
* **Color Usage:** Use sparingly. Mostly white/neutral canvas, dark typography, faint gray separators. Use brand color strictly for the active rank number, selected state, hover/focus, and Done button.
* **Artwork:** Make artwork useful, not decorative. Use compact images (artist headshots, movie posters, album covers) for fast recognition because speed matters more than gallery browsing.
* **Fast Picks as Tiles:** The left side must avoid feeling like a CRUD list. Fast picks should be horizontal visual cards or tiles.

### 9. Visual Component Tokens
The builder relies on three reusable anatomical patterns.

**Ranking Board Option**
* Fixed height (e.g., `56px` or `64px`)
* Strong numeric rank (brand color)
* Compact media thumbnail (e.g., `40x40` square or `3:4` poster aspect ratio)
* Thin bottom separator
* One-line primary label
* Dedicated drag handle (left or right aligned)
* Remove control (`×` or trash icon)

**Fast Pick Tile**
* Fixed-height horizontal tile (e.g., `48px` or `56px`)
* Compact artwork
* Primary label
* Optional metadata (one line)
* `+` (unselected) or `#N` (selected) trailing state
* Dimensions and text-wrap remain identical upon selection

**Autocomplete Item**
* Entity artwork
* Canonical label
* Entity type/status
* Optional "new suggestion" visual treatment

---

## Part 2: Poll Publication Contract

The validation rules below govern when a poll is eligible for publication.

### 1. Core Invariants
Publication validation requires:
* Title/question present
* Category/topic assigned
* No duplicate options
* At least one valid ranking/selection rule
* `maxSelections` must never exceed the number of active eligible options.
* Only public/approved options (if moderation exists)

### 2. Minimum Option Configuration
* **Invariant:** A poll must have at least as many active options as its maximum selectable rank count.
* **Formula:** `minimum options = max(5, maxSelections + buffer)`

### 3. Draft vs. Published Invariants & Moderation
* **Discoverability State & Fallback:** Do not conflate lifecycle state with discoverability.
  * `published` + `currently valid` = discoverable
  * `published` + `currently invalid` = not discoverable / needs review
  * `draft` = never published
  * A published poll that drops below its minimum viable option count (e.g., due to moderation) retains its published history identity but becomes undiscoverable until valid again.
* **Immutability of Historical Responses:** Existing responses must remain immutable and interpretable even if an option is later removed, hidden, or moderated. Historical rankings must reference the original option record rather than disappearing.
* **Moderation Constraint:** Pending user suggestions may appear in the creator’s draft immediately, but must not become public poll options until approved.
