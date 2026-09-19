import { db } from '@project/db'
import { PROFILE_FULL_SELECT } from '../lib/serializers'

export async function bearerAuth(request: any, _reply: any, _params: any) {
  // cookie-first (web); Bearer header fallback (native apps — see packages/sdk/src/client.ts)
  const token =
    request.cookies?.token ??
    request.headers.authorization?.replace('Bearer ', '')

  if (!token) throw { statusCode: 401, message: 'Unauthorized' }

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { profile: { select: PROFILE_FULL_SELECT } } } },
  })

  if (!session || session.expiresAt < new Date()) {
    throw { statusCode: 401, message: 'Session expired' }
  }

  if (session.user.suspendedAt) {
    throw { statusCode: 403, message: 'Account suspended' }
  }

  request.user = session.user
}

// extend bearerAuth with role check — used for admin routes
export async function adminAuth(request: any, reply: any, params: any) {
  await bearerAuth(request, reply, params)
  if (request.user.role !== 'ADMIN') {
    throw { statusCode: 403, message: 'Forbidden' }
  }
}
