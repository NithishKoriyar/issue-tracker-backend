import jwt from 'jsonwebtoken'
import { verifyAccessToken } from '../services/token.service.js'
import { forbidden, unauthorized } from '../utils/apiError.js'

// Requires "Authorization: Bearer <access token>". Sets req.user = { id, role }.
// An expired token gets the specific code TOKEN_EXPIRED — the frontend reacts
// to exactly that code by refreshing the session and retrying the request.
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Authentication required.', 'UNAUTHORIZED')
  }

  try {
    const payload = verifyAccessToken(token)
    req.user = { id: Number(payload.sub), role: payload.role }
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw unauthorized('Access token expired.', 'TOKEN_EXPIRED')
    }
    throw unauthorized('Invalid access token.', 'INVALID_TOKEN')
  }

  next()
}

// Use after requireAuth on admin-only routes.
export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    throw forbidden('Only admins can do this.', 'FORBIDDEN')
  }
  next()
}
