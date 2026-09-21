import type { AuthenticatedRequest } from '../lib/userContext'
import { AuthService } from '../services/AuthService'
import { resolveUserContext, sessionToken } from '../lib/userContext'

const authService = new AuthService()

const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // Production: mobile clients use the Bearer token (see AuthResponse.token), not this
  // cookie, so cross-site cookie semantics only matter for the Expo *web* target.
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
}

export async function register(request: AuthenticatedRequest, reply: any) {
  const { user, token } = await authService.register(request.body)
  reply.setCookie('token', token, COOKIE)
  return reply.status(201).send({ data: await resolveUserContext(user.id), token })
}

export async function login(request: AuthenticatedRequest, reply: any) {
  const { user, token } = await authService.login(request.body)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: await resolveUserContext(user.id), token })
}

export async function logout(request: AuthenticatedRequest, reply: any) {
  const token = sessionToken(request)
  if (token) await authService.logout(token)
  reply.clearCookie('token', { path: '/' })
  return reply.send({ data: null })
}

export async function getCurrentUser(request: AuthenticatedRequest, reply: any) {
  return reply.send({ data: await resolveUserContext(request.user.id) })
}

export async function forgotPassword(request: AuthenticatedRequest, reply: any) {
  await authService.requestPasswordReset(request.body.email)
  return reply.send({ data: null })
}

export async function resetPassword(request: AuthenticatedRequest, reply: any) {
  await authService.resetPassword(request.body)
  return reply.send({ data: null })
}

export async function sendVerificationEmail(request: AuthenticatedRequest, reply: any) {
  await authService.sendVerificationEmail(request.user.id)
  return reply.send({ data: null })
}

export async function verifyEmail(request: AuthenticatedRequest, reply: any) {
  await authService.verifyEmail(request.user.id, request.body.token)
  return reply.send({ data: null })
}

export async function registerPushToken(request: AuthenticatedRequest, reply: any) {
  await authService.registerPushToken(request.user.id, request.body.token, request.body.platform)
  return reply.send({ data: null })
}
