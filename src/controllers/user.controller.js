import * as userService from '../services/user.service.js'

// GET /api/users?search=&role=&page=&pageSize=   (admin)
// → { users, pagination: { page, pageSize, total, totalPages } }
export async function list(req, res) {
  res.json(await userService.listUsers(req.validatedQuery))
}

// GET /api/users/:id   (admin)
export async function get(req, res) {
  res.json({ user: await userService.getUser(req.validatedParams.id) })
}
