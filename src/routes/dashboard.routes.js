import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

// Mounted at /api/dashboard — any logged-in user, data scoped by role.
export const dashboardRouter = Router()

dashboardRouter.get('/stats', requireAuth, dashboardController.stats)
