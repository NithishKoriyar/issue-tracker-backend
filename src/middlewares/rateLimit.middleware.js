import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

// Brute-force protection for login and register: 10 attempts per 15 minutes.
// Keyed by IP + email, so one person mistyping their password can't lock out
// everyone else behind the same IP (offices, mobile networks, proxies).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '')
      .trim()
      .toLowerCase()}`,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many attempts. Please wait a few minutes and try again.',
      },
    })
  },
})
