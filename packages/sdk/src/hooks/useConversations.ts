import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

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

export function useMessages(conversationId: string | undefined) {
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
  })
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { body: string }) => {
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
