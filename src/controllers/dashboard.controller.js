import * as dashboardService from '../services/dashboard.service.js'

// GET /api/dashboard/stats   (any logged-in user; scoped by role)
export async function stats(req, res) {
  res.json(await dashboardService.getStats(req.user))
}
