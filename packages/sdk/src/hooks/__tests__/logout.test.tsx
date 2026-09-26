import React, { type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../client', () => ({
  getApiClient: () => ({ GET: get, POST: post }),
  ApiError: class extends Error {},
}))
import { useCurrentUser, useLogout } from '../useAuth'

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

describe('authenticated navigation state', () => {
  it('notifies the mounted user observer on logout and removes private cached data', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(['me'], { id: 'previous-user' })
    client.setQueryData(['messages', 'private-chat'], [{ body: 'private' }])
    post.mockResolvedValue({ response: { status: 200 } })
    const { result, unmount } = renderHook(() => ({ me: useCurrentUser(), logout: useLogout() }), { wrapper })
    expect(result.current.me.data).toEqual({ id: 'previous-user' })
    await act(async () => { await result.current.logout.mutateAsync() })
    await waitFor(() => expect(result.current.me.data).toBeNull())
    expect(client.getQueryData(['messages', 'private-chat'])).toBeUndefined()
    unmount()
    client.clear()
  })

  it('drops the cached signed-in identity when the server expires the session', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(['me'], { id: 'expired-user' })
    get.mockResolvedValue({ error: { error: 'Unauthorized' }, response: { status: 401 } })
    const { result, unmount } = renderHook(() => useCurrentUser(), { wrapper })
    expect(result.current.data).toEqual({ id: 'expired-user' })
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.data).toBeNull())
    unmount()
    client.clear()
  })
})
