import React, { type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createApiClient } from '../../client'
import { useUploadMedia } from '../useMedia'

afterEach(() => vi.unstubAllGlobals())

it('uploads native picker bytes as a named Blob with auth and an automatic multipart boundary', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { url: 'https://staging.test/uploads/photo.webp' } }) })
  vi.stubGlobal('fetch', fetchMock)
  const resolveUploadFile = vi.fn().mockReturnValue(new Blob(['image-bytes'], { type: 'image/jpeg' }))
  createApiClient({ baseUrl: 'https://staging.test', getToken: () => 'qa-token', resolveUploadFile })
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, unmount } = renderHook(() => useUploadMedia(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ uri: 'file:///cache/picker.jpg', name: 'picker.jpg', type: 'image/jpeg' }) })
  expect(resolveUploadFile).toHaveBeenCalledWith('file:///cache/picker.jpg')
  const [url, options] = fetchMock.mock.calls[0]!
  expect(url).toBe('https://staging.test/media/upload')
  expect(options.headers).toEqual({ Authorization: 'Bearer qa-token' })
  const uploaded = options.body.get('file') as File
  expect(uploaded).toBeInstanceOf(Blob)
  expect(uploaded.name).toBe('picker.jpg')
  expect(uploaded.type).toBe('image/jpeg')
  expect(uploaded.size).toBe(11)
  unmount()
  client.clear()
})

it('keeps browser blob uploads working without a native adapter', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ blob: async () => new Blob(['web-image'], { type: 'image/png' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { url: 'https://staging.test/uploads/photo.webp' } }) })
  vi.stubGlobal('fetch', fetchMock)
  createApiClient({ baseUrl: 'https://staging.test' })
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result, unmount } = renderHook(() => useUploadMedia(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ uri: 'blob:test-photo', name: 'web.png', type: 'image/png' }) })
  expect(fetchMock.mock.calls[0]![0]).toBe('blob:test-photo')
  const uploaded = fetchMock.mock.calls[1]![1].body.get('file') as File
  expect(uploaded.type).toBe('image/png')
  expect(uploaded.size).toBe(9)
  unmount()
  client.clear()
})
