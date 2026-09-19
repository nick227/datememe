import { useMutation } from '@tanstack/react-query'
import { getClientConfig, ApiError } from '../client'
import type { components } from '../generated/types'

type MediaResult = components['schemas']['MediaResult']

/** The shape React Native's FormData expects for a picked file — not a browser File object. */
export interface UploadableFile {
  uri: string
  name: string
  type: string
}

/**
 * `openapi-fetch` has no multipart support, so this is the one hook that bypasses
 * it and talks to `/media/upload` with a raw `fetch` + `FormData` instead — still
 * using the same base URL and auth (Bearer for native, cookie for web) as everything
 * else, via `getClientConfig()`.
 */
export function useUploadMedia() {
  return useMutation({
    mutationFn: async (file: UploadableFile): Promise<MediaResult> => {
      const { baseUrl, getToken } = getClientConfig()

      const body = new FormData()
      if (file.uri.startsWith('blob:') || file.uri.startsWith('data:')) {
        // Web (incl. Expo web): the picker hands back a blob:/data: URI, and a real
        // browser FormData needs an actual Blob. React Native's FormData special-cases
        // the {uri,name,type} shape below, but only on native — this branch is decided
        // by the URI scheme alone so the SDK never has to import 'react-native'.
        const blob = await (await fetch(file.uri)).blob()
        body.append('file', blob, file.name)
      } else {
        body.append('file', file as unknown as Blob)
      }

      const headers: Record<string, string> = {}
      const token = getToken?.()
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(`${baseUrl}/media/upload`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body,
      })
      const json = await response.json()

      if (!response.ok) {
        throw new ApiError(response.status, json.error ?? `Upload failed (${response.status})`)
      }
      return json.data
    },
  })
}
