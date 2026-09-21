import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type UpdateEntitlementPolicyInput = components['schemas']['AdminUpdateEntitlementPolicyInput']
type CreateMembershipGrantInput = components['schemas']['AdminCreateMembershipGrantInput']
type CreateSignupPromotionInput = components['schemas']['AdminCreateSignupPromotionInput']
type UpdateSignupPromotionInput = components['schemas']['AdminUpdateSignupPromotionInput']
type CreateGlobalMembershipWindowInput = components['schemas']['AdminCreateGlobalMembershipWindowInput']
type UpdateGlobalMembershipWindowInput = components['schemas']['AdminUpdateGlobalMembershipWindowInput']
type CreateCouponCodeInput = components['schemas']['AdminCreateCouponCodeInput']
type UpdateCouponCodeInput = components['schemas']['AdminUpdateCouponCodeInput']

// Phase 7 — Member Features, grants, signup promotions, global windows,
// coupons/redemptions, and membership reporting. Mirrors the "one hook per
// /admin/* route" convention from useAdmin.ts, split into its own file
// since this is a whole product area, not a handful of routes.

// ── Member Features (entitlement policy) ─────────────────
export function useAdminEntitlementPolicy() {
  return useQuery({
    queryKey: ['admin', 'entitlementPolicy'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/entitlements')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useAdminUpdateEntitlementPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateEntitlementPolicyInput) => {
      const { data, error, response } = await getApiClient().PUT('/admin/membership/entitlements', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'entitlementPolicy'] }),
  })
}

// ── Grants ────────────────────────────────────────────────
export function useAdminMembershipGrants(userId?: string) {
  return useInfiniteQuery({
    queryKey: ['admin', 'membershipGrants', userId ?? null],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/grants', {
        params: { query: { userId, cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

function useInvalidateMembership() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'membershipGrants'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'membershipOverview'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'effectiveMembers'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'user'] })
  }
}

export function useAdminCreateMembershipGrant() {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: async (input: CreateMembershipGrantInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/membership/grants', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.grant
    },
    onSuccess: invalidate,
  })
}

export function useAdminRevokeMembershipGrant() {
  const invalidate = useInvalidateMembership()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error, response } = await getApiClient().POST('/admin/membership/grants/{id}/revoke', {
        params: { path: { id } },
        body: { reason },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.grant
    },
    onSuccess: invalidate,
  })
}

// ── Signup promotions ────────────────────────────────────
export function useAdminSignupPromotions() {
  return useQuery({
    queryKey: ['admin', 'signupPromotions'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/signup-promotions')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.signupPromotions
    },
  })
}

export function useAdminCreateSignupPromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSignupPromotionInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/membership/signup-promotions', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.signupPromotion
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'signupPromotions'] }),
  })
}

export function useAdminUpdateSignupPromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateSignupPromotionInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/membership/signup-promotions/{id}', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.signupPromotion
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'signupPromotions'] }),
  })
}

// ── Global membership windows ────────────────────────────
export function useAdminGlobalMembershipWindows() {
  return useQuery({
    queryKey: ['admin', 'globalMembershipWindows'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/global-windows')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.globalWindows
    },
  })
}

export function useAdminCreateGlobalMembershipWindow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateGlobalMembershipWindowInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/membership/global-windows', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.globalWindow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'globalMembershipWindows'] }),
  })
}

export function useAdminUpdateGlobalMembershipWindow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateGlobalMembershipWindowInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/membership/global-windows/{id}', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.globalWindow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'globalMembershipWindows'] }),
  })
}

// ── Coupons ───────────────────────────────────────────────
export function useAdminCouponCodes() {
  return useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/coupons')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.coupons
    },
  })
}

export function useAdminCreateCouponCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateCouponCodeInput) => {
      const { data, error, response } = await getApiClient().POST('/admin/membership/coupons', { body: input })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.coupon
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  })
}

export function useAdminUpdateCouponCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateCouponCodeInput & { id: string }) => {
      const { data, error, response } = await getApiClient().PUT('/admin/membership/coupons/{id}', {
        params: { path: { id } },
        body,
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.coupon
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  })
}

export function useAdminCouponRedemptions(couponId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'couponRedemptions', couponId],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/coupons/{id}/redemptions', {
        params: { path: { id: couponId! } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!.redemptions
    },
    enabled: !!couponId,
  })
}

// ── Reporting ────────────────────────────────────────────
export function useAdminMembershipOverview() {
  return useQuery({
    queryKey: ['admin', 'membershipOverview'],
    queryFn: async () => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/overview')
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}

export function useAdminEffectiveMembers() {
  return useInfiniteQuery({
    queryKey: ['admin', 'effectiveMembers'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await getApiClient().GET('/admin/membership/members', {
        params: { query: { cursor: pageParam, limit: 20 } },
      })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

// ── Consumer ─────────────────────────────────────────────
export function useRedeemCoupon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error, response } = await getApiClient().POST('/membership/redeem-coupon', { body: { code } })
      if (error) throw new ApiError(response.status, (error as any).error, (error as any).code)
      return data!
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}
