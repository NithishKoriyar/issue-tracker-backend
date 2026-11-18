import bcrypt from 'bcryptjs'
import * as userModel from '../models/user.model.js'
import * as refreshTokenModel from '../models/refreshToken.model.js'
import * as tokenService from './token.service.js'
import { conflict, forbidden, unauthorized } from '../utils/apiError.js'

const BCRYPT_ROUNDS = 10

// Two tabs reloading at the same moment both send the same refresh cookie:
// one rotates it, the other arrives a moment later with the now-revoked token.
// Reuse within this window is treated as that harmless race, not as theft.
const REUSE_GRACE_MS = 30_000

// A real bcrypt hash: comparing against it when the email doesn't exist makes
// "unknown email" take as long as "wrong password" (no account-probing by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS)

// Creates a new session: a refresh token row in the DB + a fresh access token.
// The controller puts refreshToken in the httpOnly cookie.
async function createSession(user) {
  const refreshToken = tokenService.generateRefreshToken()
  const refreshTokenExpiresAt = tokenService.refreshTokenExpiresAt()

  await refreshTokenModel.create({
    userId: user.id,
    tokenHash: tokenService.hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  })

  return {
    user,
    accessToken: tokenService.signAccessToken(user),
    refreshToken,
    refreshTokenExpiresAt,
  }
}

export async function register({ name, email, password }) {
  if (await userModel.findByEmail(email)) {
    throw conflict('An account with this email already exists.', 'EMAIL_TAKEN')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  let user
  try {
    // Role is always 'user' — never taken from the request.
    user = await userModel.create({ name, email, passwordHash, role: 'user' })
  } catch (err) {
    // Two sign-ups with the same email at the same moment: UNIQUE catches it.
    if (err.code === '23505') {
      throw conflict(
        'An account with this email already exists.',
        'EMAIL_TAKEN',
      )
    }
    throw err
  }

  return createSession(user)
}

export async function login({ email, password, asAdmin }) {
  const record = await userModel.findByEmailWithPassword(email)
  const passwordOk = await bcrypt.compare(
    password,
    record?.passwordHash ?? DUMMY_HASH,
  )

  // Same message for "no such email" and "wrong password".
  if (!record || !passwordOk) {
    throw unauthorized('Invalid email or password.', 'INVALID_CREDENTIALS')
  }

  // Admin login (/login?mode=admin): refuse non-admins BEFORE creating a session.
  if (asAdmin && record.role !== 'admin') {
    throw forbidden("This account doesn't have admin access.", 'NOT_ADMIN')
  }

  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...user } = record
  await refreshTokenModel.deleteExpiredForUser(user.id)
  return createSession(user)
}

// Rotation: the presented refresh token is used up and replaced by a new one.
export async function refresh(rawToken) {
  if (!rawToken) {
    throw unauthorized('Not logged in.', 'NO_REFRESH_TOKEN')
  }

  const tokenHash = tokenService.hashToken(rawToken)
  const consumed = await refreshTokenModel.consume(tokenHash)

  if (!consumed) {
    const existing = await refreshTokenModel.findByHash(tokenHash)

    if (!existing) {
      throw unauthorized(
        'Session not found. Please log in again.',
        'INVALID_REFRESH_TOKEN',
      )
    }

    if (existing.revokedAt) {
      // An already-used token came back. Outside the grace window that means
      // someone else holds a copy (stolen cookie) → end every session of this user.
      const revokedMsAgo = Date.now() - existing.revokedAt.getTime()
      if (revokedMsAgo > REUSE_GRACE_MS) {
        await refreshTokenModel.revokeAllForUser(existing.userId)
      }
      throw unauthorized(
        'Session is no longer valid. Please log in again.',
        'REFRESH_TOKEN_REUSED',
      )
    }

    throw unauthorized(
      'Session expired. Please log in again.',
      'REFRESH_TOKEN_EXPIRED',
    )
  }

  const user = await userModel.findById(consumed.userId)
  if (!user) {
    throw unauthorized('Account no longer exists.', 'INVALID_REFRESH_TOKEN')
  }

  return createSession(user)
}

export async function logout(rawToken) {
  if (rawToken) {
    await refreshTokenModel.revoke(tokenService.hashToken(rawToken))
  }
}

export async function me(userId) {
  const user = await userModel.findById(userId)
  if (!user) throw unauthorized('Account no longer exists.', 'UNAUTHORIZED')
  return user
}
