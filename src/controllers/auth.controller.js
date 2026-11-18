import * as authService from '../services/auth.service.js'

// The refresh token lives only in this cookie:
//  httpOnly  → JavaScript can't read it (XSS can't steal it)
//  sameSite  → never sent on cross-site requests (CSRF protection)
//  path      → only sent to /api/auth/* (refresh, logout), not every API call
//  secure    → HTTPS only in production
const REFRESH_COOKIE = 'refreshToken'

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  }
}

function sendSession(res, status, session) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...cookieOptions(),
    expires: session.refreshTokenExpiresAt,
  })
  res
    .status(status)
    .json({ accessToken: session.accessToken, user: session.user })
}

// POST /api/auth/register
export async function register(req, res) {
  sendSession(res, 201, await authService.register(req.body))
}

// POST /api/auth/login   (body.asAdmin = true for admin login)
export async function login(req, res) {
  sendSession(res, 200, await authService.login(req.body))
}

// POST /api/auth/refresh — new access token + rotated refresh cookie
export async function refresh(req, res) {
  try {
    sendSession(
      res,
      200,
      await authService.refresh(req.cookies[REFRESH_COOKIE]),
    )
  } catch (err) {
    // The cookie is useless now — remove it so the browser stops sending it.
    res.clearCookie(REFRESH_COOKIE, cookieOptions())
    throw err
  }
}

// POST /api/auth/logout
export async function logout(req, res) {
  await authService.logout(req.cookies[REFRESH_COOKIE])
  res.clearCookie(REFRESH_COOKIE, cookieOptions())
  res.status(204).end()
}

// GET /api/auth/me
export async function me(req, res) {
  res.json({ user: await authService.me(req.user.id) })
}
