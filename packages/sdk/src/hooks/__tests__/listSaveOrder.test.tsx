import React, { type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

const { put } = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('../../client', () => ({
  getApiClient: () => ({ PUT: put }),
  ApiError: class ApiError extends Error {},
}))
import { useUpsertList } from '../useLists'

function deferred() {
  let resolve!: (value: any) => void
  const promise = new Promise<any>((done) => { resolve = done })
  return { promise, resolve }
}
const ok = { data: { data: { answerRevision: 2 } }, response: { status: 200 } }

describe('whole-list autosaves', () => {
  it('serializes rapid edits but does not wait for background publication', async () => {
    const first = deferred()
    const refresh = deferred()
    put.mockReset().mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok)
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockImplementation((filters) =>
      filters?.queryKey?.[0] === 'categoryRankings' ? refresh.promise : Promise.resolve(),
    )
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useUpsertList('poll'), { wrapper })
    act(() => {
      result.current.mutate({ items: [{ entityId: 'a', rank: 1 }], isComplete: true })
      result.current.mutate({ items: [{ entityId: 'b', rank: 1 }], isComplete: true })
    })
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    first.resolve(ok)
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categoryRankings', 'poll'] }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData(['rankingTargetRevision', 'poll'])).toBe(2)
    refresh.resolve(undefined)
    expect(put).toHaveBeenCalledTimes(2)
    expect(put.mock.calls[1]![1].body.items).toEqual([{ entityId: 'b', rank: 1 }])
    client.clear()
  })

  it('continues with the newer answer after an earlier save fails', async () => {
    put.mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(ok)
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useUpsertList('poll'), { wrapper })
    act(() => {
      result.current.mutate({ items: [{ entityId: 'a', rank: 1 }], isComplete: true })
      result.current.mutate({ items: [], isComplete: false })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(put).toHaveBeenCalledTimes(2)
    expect(put.mock.calls[1]![1].body.items).toEqual([])
    client.clear()
  })
})
