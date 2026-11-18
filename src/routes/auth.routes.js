import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'
import { authLimiter } from '../middlewares/rateLimit.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { loginSchema, registerSchema } from '../validators/auth.validator.js'

// Mounted at /api/auth
export const authRouter = Router()

authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  authController.register,
)
authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  authController.login,
)
authRouter.post('/refresh', authController.refresh)
authRouter.post('/logout', authController.logout)
authRouter.get('/me', requireAuth, authController.me)
