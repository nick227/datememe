# State Management

We minimize local state. The vast majority of the app state is remote state.

- **Remote State**: Handled entirely by `@tanstack/react-query`. Caches are invalidated via mutation success blocks.
- **Local State**: `useState` is reserved for ephemeral UI interactions:
  - Text input (Search queries before submission).
  - Open/closed status of bottom sheets (`useActionSheet`).
  - Active chip selections before applying filters.
- **No Redux / Global Stores**: There is no global frontend state container. `useCurrentUser` handles session state directly through Query Cache.
