import { AuthService } from '../services/AuthService'
import { serializeUser } from '../lib/serializers'

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

export async function register(request: any, reply: any) {
  const { user, token } = await authService.register(request.body)
  reply.setCookie('token', token, COOKIE)
  return reply.status(201).send({ data: serializeUser(user), token })
}

export async function login(request: any, reply: any) {
  const { user, token } = await authService.login(request.body)
  reply.setCookie('token', token, COOKIE)
  return reply.send({ data: serializeUser(user), token })
}

export async function logout(request: any, reply: any) {
  const token = request.cookies?.token ?? request.headers.authorization?.replace('Bearer ', '')
  if (token) await authService.logout(token)
  reply.clearCookie('token', { path: '/' })
  return reply.send({ data: null })
}

export async function getCurrentUser(request: any, reply: any) {
  return reply.send({ data: serializeUser(request.user) })
}

export async function forgotPassword(request: any, reply: any) {
  await authService.requestPasswordReset(request.body.email)
  return reply.send({ data: null })
}

export async function resetPassword(request: any, reply: any) {
  await authService.resetPassword(request.body)
  return reply.send({ data: null })
}

export async function sendVerificationEmail(request: any, reply: any) {
  await authService.sendVerificationEmail(request.user.id)
  return reply.send({ data: null })
}

export async function verifyEmail(request: any, reply: any) {
  await authService.verifyEmail(request.user.id, request.body.token)
  return reply.send({ data: null })
}

export async function registerPushToken(request: any, reply: any) {
  await authService.registerPushToken(request.user.id, request.body.token, request.body.platform)
  return reply.send({ data: null })
}
