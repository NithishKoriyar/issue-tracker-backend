import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

// ---- Access token: short-lived JWT, sent as "Authorization: Bearer <token>" ----

export function signAccessToken(user) {
  return jwt.sign({ role: user.role }, process.env.JWT_ACCESS_SECRET, {
    subject: String(user.id),
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
    algorithm: 'HS256',
  })
}

// Throws jwt.TokenExpiredError / jwt.JsonWebTokenError on a bad token.
// Pinning the algorithm stops "alg: none" style attacks.
export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  })
}

// ---- Refresh token: long random value, lives in an httpOnly cookie ----

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('base64url')
}

// The DB stores only this hash, so a database leak doesn't leak sessions.
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function refreshTokenExpiresAt() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}
