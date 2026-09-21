import type { FastifyRequest } from 'fastify'
import { db, AccountRole } from '@project/db'
import { resolveEntitlements, resolveMembership } from './entitlements'
import { PROFILE_FULL_SELECT, serializeUser } from './serializers'

// Route payloads retain their existing OpenAPI validation; identity is always typed.
export type AuthenticatedRequest = FastifyRequest & { body: any; query: any; params: any }

export type Principal = {
  id: string
  profileId: string | null
  role: AccountRole
  isVerified: boolean
  suspendedAt: Date | null
  deletedAt: Date | null
}

declare module 'fastify' {
  interface FastifyRequest { user: Principal }
}

export function sessionToken(request: { cookies?: Record<string, string | undefined>; headers: { authorization?: string } }) {
  return request.cookies?.token ?? /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '')?.[1]
}

export function requireAccountAccess(account: Pick<Principal, 'suspendedAt'>) {
  if (account.suspendedAt) throw { statusCode: 403, message: 'Account suspended' }
}

export function requireRole(principal: Principal, role: AccountRole) {
  requireAccountAccess(principal)
  if (principal.role !== role) throw { statusCode: 403, message: 'Forbidden' }
}

export function requireProfileId(principal: Principal): string {
  if (!principal.profileId) throw { statusCode: 403, message: 'Profile required' }
  return principal.profileId
}

// Bootstrap only. Authentication itself never loads photos or membership.
export async function resolveUserContext(userId: string) {
  const [user, membership, entitlements] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: { select: PROFILE_FULL_SELECT } } }),
    resolveMembership(userId),
    resolveEntitlements(userId),
  ])
  requireAccountAccess(user)
  return {
    ...serializeUser(user),
    account: { suspended: !!user.suspendedAt, deleted: !!user.deletedAt },
    membership,
    entitlements,
  }
}
