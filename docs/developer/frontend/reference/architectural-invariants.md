# Architectural Invariants

Do not break these rules without team consensus:
1. **Server Owns Safe Media Selection**: Frontend shouldn't invent fallback media relationships.
2. **Feeds Use Generic ContentUnit**: Do not create bespoke payload structures for lists of entities. Use the existing API feed contract.
3. **Capabilities Determine Allowed Actions**: The UI responds to capability flags sent by the API; it does not duplicate permission logic.
4. **No Vertical Reflows in Fixed Layouts**: Fixed-layout interactions (like `ListBuilderScreen`) must not cause vertical reflows on keyboard interactions.
5. **No Duplicating Shared Content Rendering**: Feature code must not duplicate shared UI iteration loops. Always pass a `FeedModule` into `FeedModuleRenderer`.
