import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { dashboardRouter } from './dashboard.routes.js'
import { issueRouter } from './issue.routes.js'
import { userRouter } from './user.routes.js'

// Every API route, mounted under /api in app.js.
export const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/issues', issueRouter)
apiRouter.use('/users', userRouter)
apiRouter.use('/dashboard', dashboardRouter)
