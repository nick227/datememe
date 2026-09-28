# Loading, Error, and Empty States

## Loading Skeletons
We avoid spinners where possible. Instead, we use `Skeleton` and `CardSkeleton` components matching the dimensions of the final layout.
- For feed screens, the skeleton blocks are mounted while `feed.isLoading` is true.

## Empty States
`EmptyState.tsx` receives a `title` and `subtitle`. It is rendered by the parent screen when data arrays return empty. 

## Error States
`ErrorState.tsx` must be provided an `onRetry` callback tied to the react-query `.refetch()` method.
