import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../client', () => ({
  getApiClient: () => ({ GET: get, POST: post }),
  ApiError: class extends Error {},
}))
import { useCurrentUser, useLogin, useLogout } from '../useAuth'

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

describe('authenticated navigation state', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
  })

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

  it('removes an expired account’s data before another account signs in, including late responses', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(['me'], { id: 'account-a' })
    client.setQueryData(['myLists'], [{ id: 'a-list', items: ['private favorite'] }])
    client.setQueryData(['conversations'], [{ id: 'a-conversation' }])
    client.setQueryData(['messages', 'a-conversation'], [{ body: 'private message' }])
    const authQuery = client.getQueryCache().find({ queryKey: ['me'] })

    let finishOldRequest!: (value: { body: string }[]) => void
    const lateMessages = client.fetchQuery({
      queryKey: ['messages', 'a-conversation'],
      queryFn: () => new Promise<{ body: string }[]>((resolve) => { finishOldRequest = resolve }),
    }).catch(() => undefined)

    get.mockResolvedValueOnce({ error: { error: 'Unauthorized' }, response: { status: 401 } })
    const { result, unmount } = renderHook(() => ({ me: useCurrentUser(), login: useLogin() }), { wrapper })
    expect(result.current.me.data).toEqual({ id: 'account-a' })
    await act(async () => { await result.current.me.refetch() })
    await waitFor(() => expect(result.current.me.data).toBeNull())
    expect(client.getQueryCache().find({ queryKey: ['me'] })).toBe(authQuery)
    expect(client.getQueryData(['myLists'])).toBeUndefined()
    expect(client.getQueryData(['conversations'])).toBeUndefined()
    expect(client.getQueryData(['messages', 'a-conversation'])).toBeUndefined()

    post.mockResolvedValueOnce({ data: { token: 'account-b-token' }, response: { status: 200 } })
    get.mockResolvedValueOnce({ data: { data: { id: 'account-b' } }, response: { status: 200 } })
    await act(async () => {
      await result.current.login.mutateAsync({ email: 'b@example.test', password: 'test-password' })
      // LoginScreen fetches the canonical identity after persisting the new token.
      await client.invalidateQueries({ queryKey: ['me'] })
    })
    await waitFor(() => expect(result.current.me.data).toEqual({ id: 'account-b' }))

    await act(async () => {
      finishOldRequest([{ body: 'late private message' }])
      await lateMessages
    })
    expect(client.getQueryCache().find({ queryKey: ['me'] })).toBe(authQuery)
    expect(client.getQueryData(['myLists'])).toBeUndefined()
    expect(client.getQueryData(['conversations'])).toBeUndefined()
    expect(client.getQueryData(['messages', 'a-conversation'])).toBeUndefined()
    unmount()
    client.clear()
  })

  it('keeps the signed-in identity and cached data on a temporary server failure', async () => {
    const { client, wrapper } = setup()
    client.setQueryData(['me'], { id: 'account-a' })
    client.setQueryData(['myLists'], [{ id: 'a-list' }])
    get.mockResolvedValue({ error: { error: 'Service unavailable' }, response: { status: 503 } })
    const { result, unmount } = renderHook(() => useCurrentUser(), { wrapper })
    expect(result.current.data).toEqual({ id: 'account-a' })
    await act(async () => { await result.current.refetch() })
    expect(result.current.data).toEqual({ id: 'account-a' })
    expect(client.getQueryData(['myLists'])).toEqual([{ id: 'a-list' }])
    unmount()
    client.clear()
  })
})
