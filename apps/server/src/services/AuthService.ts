import { db } from '@project/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { PROFILE_INCLUDE } from '../lib/serializers'
import { generateOtp, sendEmail } from '../lib/email'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const MIN_AGE_YEARS = 18
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000 // 15 minutes — short-lived since it's a brute-forceable 6-digit code
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export class AuthService {
  async register(data: {
    email: string
    password: string
    username: string
    displayName: string
    birthdate: string
  }) {
    const birthdate = new Date(data.birthdate)
    const age = (Date.now() - birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (age < MIN_AGE_YEARS) throw { statusCode: 400, message: `Must be at least ${MIN_AGE_YEARS} years old` }

    const hash = await bcrypt.hash(data.password, 12)
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash: hash,
        profile: {
          create: {
            username: data.username,
            displayName: data.displayName,
            birthdate,
          },
        },
      },
      include: { profile: { include: PROFILE_INCLUDE } },
    })
    const session = await this._createSession(user.id)
    return { user, token: session.token }
  }

  async login(data: { email: string; password: string }) {
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { profile: { include: PROFILE_INCLUDE } },
    })
    if (!user || !user.passwordHash) throw { statusCode: 401, message: 'Invalid credentials' }

    const valid = await bcrypt.compare(data.password, user.passwordHash)
    if (!valid) throw { statusCode: 401, message: 'Invalid credentials' }

    if (user.suspendedAt) throw { statusCode: 403, message: 'Account suspended' }

    const session = await this._createSession(user.id)
    return { user, token: session.token }
  }

  async logout(token: string) {
    await db.session.deleteMany({ where: { token } })
  }

  /** Always succeeds from the caller's perspective, even for an unknown email — see docs on the /auth/forgot-password route. */
  async requestPasswordReset(email: string) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) return

    const token = generateOtp()
    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
    })
    await sendEmail(email, 'Your password reset code', `Your code is ${token}. It expires in 15 minutes.`)
  }

  async resetPassword(data: { email: string; token: string; newPassword: string }) {
    const user = await db.user.findUnique({ where: { email: data.email } })
    // Same error for "no such user" and "wrong code" — don't leak which one it was.
    const invalid = { statusCode: 400, message: 'Invalid or expired code' }
    if (!user) throw invalid

    const resetToken = await db.passwordResetToken.findFirst({
      where: { userId: user.id, token: data.token, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!resetToken) throw invalid

    const hash = await bcrypt.hash(data.newPassword, 12)
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
      db.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      // Resetting a password is a strong enough security event to force re-login everywhere.
      db.session.deleteMany({ where: { userId: user.id } }),
    ])
  }

  async sendVerificationEmail(userId: string) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
    if (user.isVerified) return

    const token = generateOtp()
    await db.emailVerificationToken.create({
      data: { userId, token, expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
    })
    await sendEmail(user.email, 'Verify your email', `Your verification code is ${token}. It expires in 24 hours.`)
  }

  async verifyEmail(userId: string, token: string) {
    const verificationToken = await db.emailVerificationToken.findFirst({
      where: { userId, token, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!verificationToken) throw { statusCode: 400, message: 'Invalid or expired code' }

    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { isVerified: true } }),
      db.emailVerificationToken.update({ where: { id: verificationToken.id }, data: { usedAt: new Date() } }),
    ])
  }

  private async _createSession(userId: string) {
    return db.session.create({
      data: {
        userId,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    })
  }
}
