import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/auth/me')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.data
    },
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data, error, response } = await getApiClient().POST('/auth/login', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      email: string
      password: string
      username: string
      displayName: string
      birthdate: string
    }) => {
      const { data, error, response } = await getApiClient().POST('/auth/register', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await getApiClient().POST('/auth/logout')
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.clear()
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (body: { email: string }) => {
      const { error, response } = await getApiClient().POST('/auth/forgot-password', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (body: { email: string; token: string; newPassword: string }) => {
      const { error, response } = await getApiClient().POST('/auth/reset-password', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
  })
}

export function useSendVerificationEmail() {
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await getApiClient().POST('/auth/send-verification')
      if (error) throw new ApiError(response.status, (error as any).error)
    },
  })
}

export function useVerifyEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { token: string }) => {
      const { error, response } = await getApiClient().POST('/auth/verify-email', { body })
      if (error) throw new ApiError(response.status, (error as any).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
