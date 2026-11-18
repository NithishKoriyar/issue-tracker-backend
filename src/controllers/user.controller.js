import * as userService from '../services/user.service.js'

// GET /api/users?search=&role=&limit=   (admin)
export async function list(req, res) {
  res.json({ users: await userService.listUsers(req.validatedQuery) })
}

// GET /api/users/:id   (admin)
export async function get(req, res) {
  res.json({ user: await userService.getUser(req.validatedParams.id) })
}
