# API & React Query Contracts

The frontend uses an auto-generated or strictly typed SDK (`@project/sdk`) representing our trpc/REST boundaries.

- **Pagination**: Feeds use `useInfiniteQuery`. Screens handle `onEndReached` to trigger `.fetchNextPage()`.
- **Invalidation**: When a user acts (e.g., adds an entity to a list), the mutation's `onSuccess` callback invalidates the relevant list queries (`queryClient.invalidateQueries(['lists'])`).
