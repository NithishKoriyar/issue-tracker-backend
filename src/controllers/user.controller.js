import * as userService from '../services/user.service.js'

// GET /api/users   (admin)
export async function list(_req, res) {
  res.json({ users: await userService.listUsers() })
}
