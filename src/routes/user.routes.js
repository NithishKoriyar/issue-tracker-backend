import { Router } from 'express'
import * as userController from '../controllers/user.controller.js'
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js'

// Mounted at /api/users — admin only.
export const userRouter = Router()

userRouter.get('/', requireAuth, requireAdmin, userController.list)
