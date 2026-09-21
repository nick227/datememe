import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type CreateMessageInput = components['schemas']['CreateMessageInput']

export function useConversations() {
  return useInfiniteQuery({
    queryKey: ['conversations'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/conversations', {
        params: { query: { cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
  })
}

// `poll` is left off by default (used by other screens/tests that just need
// history) and turned on only by the open thread screen, and only while it's
// actually focused — see ConversationScreen. React Query's refetchInterval
// re-fetches whichever pages are already in the cache in place, so this
// doesn't reset scroll position or touch cursor-based pagination.
export function useMessages(conversationId: string | undefined, opts: { poll?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/conversations/{conversationId}/messages', {
        params: { path: { conversationId: conversationId! }, query: { cursor: pageParam, limit: 30 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: !!conversationId,
    refetchInterval: opts.poll ? 4000 : false,
  })
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateMessageInput) => {
      const { data, error, response } = await getApiClient().POST(
        '/conversations/{conversationId}/messages',
        { params: { path: { conversationId } }, body },
      )
      if (error) throw new ApiError(response.status, (error as any).error, (error as any).code)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

// Takes the conversation id at mutate-time (not hook-construction time) so
// one hook instance can serve a whole list of rows — ConversationsScreen
// unmatches whichever row the user swiped, not a single fixed conversation.
export function useUnmatchConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error, response } = await getApiClient().DELETE('/conversations/{conversationId}', {
        params: { path: { conversationId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['discoverFeed'] })
    },
  })
}

export function useMarkAsRead(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error, response } = await getApiClient().POST(
        '/conversations/{conversationId}/read',
        { params: { path: { conversationId } } },
      )
      if (error) throw new ApiError(response.status, (error as any).error, (error as any).code)
      return data!.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
