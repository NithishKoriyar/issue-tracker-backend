import { Router } from 'express'
import * as userController from '../controllers/user.controller.js'
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import { listUsersQuery, userIdParams } from '../validators/user.validator.js'

// Mounted at /api/users — admin only.
export const userRouter = Router()

userRouter.use(requireAuth, requireAdmin)

userRouter.get('/', validate({ query: listUsersQuery }), userController.list)
userRouter.get('/:id', validate({ params: userIdParams }), userController.get)
