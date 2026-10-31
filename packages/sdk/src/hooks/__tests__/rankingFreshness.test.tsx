import React, { type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../client', () => ({ getApiClient: () => ({ GET: get }), ApiError: class ApiError extends Error {} }))
import { useCategoryRankings } from '../useRankings'

const response = (resultsRevision: number, isUpdating = false) => ({ data: { data: { resultsRevision, isUpdating } }, response: { status: 200 } })

describe('ranking publication acknowledgements', () => {
  it('never treats an older successful GET as acknowledgement of the saved vote', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['rankingTargetRevision', 'poll'], 7)
    get.mockReset().mockResolvedValue(response(6))
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCategoryRankings('poll'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isUpdating).toBe(true)
    get.mockResolvedValue(response(7))
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.isUpdating).toBe(false))
    // Another user's answer can make the community snapshot pending again.
    get.mockResolvedValue(response(7, true))
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.isUpdating).toBe(true))
    get.mockRejectedValue(new Error('offline'))
    await act(async () => { await result.current.refetch() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.isUpdating).toBe(true)
    expect(result.current.data?.resultsRevision).toBe(7)
    client.clear()
  })
})
