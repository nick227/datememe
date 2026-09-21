import { db } from '@project/db'
import { requireAccountAccess, requireRole, sessionToken } from '../lib/userContext'

// Two parameters work with both native Fastify and OpenAPI glue hooks.
export async function bearerAuth(request: any, _reply: any) {
  const token = sessionToken(request)
  if (!token) throw { statusCode: 401, message: 'Unauthorized' }
  const session = await db.session.findUnique({
    where: { token },
    select: { expiresAt: true, user: { select: {
      id: true, role: true, isVerified: true, suspendedAt: true, deletedAt: true,
      profile: { select: { id: true } },
    } } },
  })
  if (!session || session.expiresAt <= new Date()) throw { statusCode: 401, message: 'Session expired' }
  requireAccountAccess(session.user)
  const { profile, ...identity } = session.user
  request.user = { ...identity, profileId: profile?.id ?? null }
}

export async function adminAuth(request: any, reply: any) {
  await bearerAuth(request, reply)
  requireRole(request.user, 'ADMIN')
}
