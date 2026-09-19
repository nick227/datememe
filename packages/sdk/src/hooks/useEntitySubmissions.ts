import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useSubmitEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { entityTypeId: string; rawText: string }) => {
      const { data, error, response } = await getApiClient().POST('/entity-submissions', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    onSuccess: (_result, variables) => {
      // the new PENDING entity should show up immediately in the submitter's own autocomplete
      queryClient.invalidateQueries({ queryKey: ['categoryEntities'] })
    },
  })
}
