# UI test IDs

React Native components use `testID` (capital ID). On web, React Native Web exposes these as `data-testid`.

- Every screen has `screen.<kebab-case-screen-name>` on its `ScreenContainer`, including alternate loading/error returns. Discovery uses `screen.discover`.
- Controls use a screen prefix and purpose, e.g. `login.email`, `login.submit`, `list-builder.done`, `conversation.compose`, `conversation.send`.
- Record-specific controls use stable data IDs, e.g. `list-builder.item.<entityId>.remove`, `conversation.message.<messageId>`, `admin-grants.revoke.<grantId>`.
- Tabs use `tab.lists`, `tab.discover`, and `tab.messages`. The global avatar is `header.profile`. Screen header actions use `<screen>.header.back` or `.close`.
- Select fields put the base ID on the trigger; append `.dialog`, `.close`, or `.option.<value>` for their other controls.
- Error states expose `<screen>.error` and `.error.retry`; empty states use `<screen>.empty`. Feed loading roots use `categories.loading` and `discover.loading`.
- Action sheets expose `<screen>.dialog`; their button configs carry explicit `testID` values. Keep those IDs stable when changing button text.
- Quick Picks has `quick-picks.active-card` for the top gesture target and `quick-picks.match-dialog` for the match overlay. Its nested profile card and actions use `discover.profile.<profileId>` and suffixes such as `.like` and `.pass`.
- Content modules expose `feed.module.<moduleId>`. Scope category/person card selectors to a module when the same record appears in multiple sections. Scope shared selectors to the visible screen when navigation retains other screens.
- Gallery controls use `edit-profile.gallery-slot.<index>` deliberately to identify a position; these are not photo identities. `edit-profile.avatar` and `edit-profile.add-photo` identify the other pickers.

Shared buttons, screen containers, select fields, navigation headers, photo pickers, and states forward optional IDs to native elements. `TextField` forwards native input props directly. Place IDs on the actionable element, not its label or icon. Do not derive IDs at runtime from displayed copy, names, or ranks. Skip purely decorative elements. Prefer accessible role/name queries where they describe the interaction clearly.

Use `rg 'testID' apps/mobile/src` to find exact selectors at their call sites. For virtualized lists, scroll an item into view before locating it. A screen ID confirms the screen is mounted; wait for a specific control or state when asserting readiness.

## Overlay internals

- Shared action sheets retain their base content ID and expose `.modal`, `.overlay`, `.title`, and `.message`. Menu and confirmation actions retain their explicit button IDs. Overlay IDs identify the backdrop container, not a dismiss action.
- Select sheets retain `.dialog`, `.close`, and `.option.<value>` and additionally expose `.modal`, `.overlay`, `.title`, and `.options` (the scrollable list). The empty-string option retains the literal `.option.` suffix.
- The curated AI slide-up uses `admin-list-detail.generate-dialog`, with `.modal`, `.overlay`, `.title`, `.close`, `.prompt-step`, and `.review-step`. Existing prompt/generate/approve/discard IDs remain unchanged.
- AI draft rows have `admin-list-detail.generate-dialog.candidate-slot.<index>` because unsaved candidates have no record IDs. Scope the existing `admin-list-detail.candidate` input and `.generate-dialog.candidate.move-up`, `.move-down`, or `.remove` controls to that row. Slots identify current positions; query again after reordering or removal.
- Curated selections use `admin-list-detail.selected.<entityId>` and `.move-up`, `.move-down`, `.remove`; available rows expose `admin-list-detail.entity.<entityId>.add`. Curated feedback uses `admin-list-detail.curated-dialog` and `.ok`.
- Autocomplete exposes `list-builder.suggestions.results` for scrolling; suggestion actions retain their entity-based IDs. The match overlay adds `quick-picks.match-dialog.content`, `.title`, and `.message`; its existing action IDs remain unchanged.

Native operating-system photo pickers are outside the React Native test-ID tree.
