import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import React from 'react'

// Mocks the module `../client` resolves to (src/client.ts) — every hook
// under test imports it via a different relative specifier, but vitest
// matches by resolved file, not literal specifier text.
vi.mock('../../client', () => {
  const ok = async () => ({ data: { data: {} }, error: undefined, response: { status: 200 } })
  const post = async () => ({ data: { data: { matched: false } }, error: undefined, response: { status: 200 } })
  return {
    getApiClient: () => ({ GET: ok, PUT: ok, POST: post, PATCH: ok, DELETE: ok }),
    ApiError: class ApiError extends Error {},
  }
})

import { useUpsertList } from '../useLists'
import { useSwipe } from '../useMatching'
import { useBlockProfile, useUnblockProfile } from '../useSafety'
import { useUpdateMyProfile } from '../useProfiles'

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const spy = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { wrapper, spy }
}

function invalidatedKeys(spy: ReturnType<typeof makeWrapper>['spy']) {
  return spy.mock.calls.map((call) => JSON.stringify((call[0] as { queryKey?: unknown })?.queryKey))
}

// Bug class found live this session (Lists/ranking → taste-graph → Discover
// audit): a mutation's onSuccess invalidated a query key no screen actually
// reads (`useUpsertList` invalidated `['myLists']`, but the real Lists tab
// reads `['listsFeed']` via `useListsFeed()`) — so a real, successfully
// persisted write left the screen showing stale data ("0 lists completed")
// until something unrelated happened to refetch it. Same class was found
// earlier for `useSwipe`/`useBlockProfile`/`useUnblockProfile` only
// invalidating the legacy `['discovery']` key while the live Discover
// screen reads `['discoverFeed']`. These pin the exact keys each live
// screen depends on, so a future edit that drops one silently regresses.
describe('mutation cache invalidation — stale query key regression guard', () => {
  it('useUpsertList invalidates every query key a Lists/Discover screen reads', async () => {
    const { wrapper, spy } = makeWrapper()
    const { result } = renderHook(() => useUpsertList('top-90s-bands'), { wrapper })

    result.current.mutate({ items: [{ entityId: 'e1', rank: 1 }] } as never)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = invalidatedKeys(spy)
    expect(keys).toContain(JSON.stringify(['myLists']))
    expect(keys).toContain(JSON.stringify(['listsFeed']))
    expect(keys).toContain(JSON.stringify(['listsFeedCollection']))
    expect(keys).toContain(JSON.stringify(['discovery']))
    expect(keys).toContain(JSON.stringify(['discoverFeed']))
  })

  it('useSwipe invalidates both the legacy and current Discover feed keys', async () => {
    const { wrapper, spy } = makeWrapper()
    const { result } = renderHook(() => useSwipe(), { wrapper })

    result.current.mutate({ targetProfileId: 'p1', action: 'LIKE' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = invalidatedKeys(spy)
    expect(keys).toContain(JSON.stringify(['discovery']))
    expect(keys).toContain(JSON.stringify(['discoverFeed']))
  })

  it('useBlockProfile and useUnblockProfile both invalidate both Discover feed keys', async () => {
    const { wrapper, spy } = makeWrapper()

    const { result: blockResult } = renderHook(() => useBlockProfile(), { wrapper })
    blockResult.current.mutate('p1')
    await waitFor(() => expect(blockResult.current.isSuccess).toBe(true))
    expect(invalidatedKeys(spy)).toContain(JSON.stringify(['discovery']))
    expect(invalidatedKeys(spy)).toContain(JSON.stringify(['discoverFeed']))

    spy.mockClear()
    const { result: unblockResult } = renderHook(() => useUnblockProfile(), { wrapper })
    unblockResult.current.mutate('p1')
    await waitFor(() => expect(unblockResult.current.isSuccess).toBe(true))
    expect(invalidatedKeys(spy)).toContain(JSON.stringify(['discovery']))
    expect(invalidatedKeys(spy)).toContain(JSON.stringify(['discoverFeed']))
  })

  // Same bug class, found in the same audit pass: `seekingGenders`,
  // `genderIdentity`, and `isDiscoverable` are all editable via
  // `PATCH /profiles/me`, and all three directly determine the viewer's own
  // Discover candidate pool — but the hook only invalidated `['me']`, so
  // changing who you're seeking wouldn't visibly change Discover.
  it('useUpdateMyProfile invalidates both Discover feed keys, not just me', async () => {
    const { wrapper, spy } = makeWrapper()
    const { result } = renderHook(() => useUpdateMyProfile(), { wrapper })

    result.current.mutate({ seekingGenders: ['FEMALE'] } as never)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = invalidatedKeys(spy)
    expect(keys).toContain(JSON.stringify(['me']))
    expect(keys).toContain(JSON.stringify(['discovery']))
    expect(keys).toContain(JSON.stringify(['discoverFeed']))
  })
})
