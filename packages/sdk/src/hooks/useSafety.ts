import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type ReportInput = components['schemas']['ReportInput']

export function useBlockedProfiles() {
  return useQuery({
    queryKey: ['blockedProfiles'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/blocks')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
  })
}

export function useBlockProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (blockedProfileId: string) => {
      const { error, response } = await getApiClient().POST('/blocks', { body: { blockedProfileId } })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockedProfiles'] })
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useUnblockProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error, response } = await getApiClient().DELETE('/blocks/{profileId}', {
        params: { path: { profileId } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockedProfiles'] })
      queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: async (body: ReportInput) => {
      const { data, error, response } = await getApiClient().POST('/reports', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
  })
}
