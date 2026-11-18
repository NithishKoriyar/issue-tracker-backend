import * as userModel from '../models/user.model.js'
import { notFound } from '../utils/apiError.js'

// Admin only (requireAdmin on the routes).

// Users with their issue counts. Users page: everyone (+ search).
// User picker: role 'user', limit 5 (+ search).
export function listUsers({ search, role, limit } = {}) {
  return userModel.listWithIssueCounts({ search, role, limit })
}

// One user — lets the picker show a name for an id that isn't in its
// current results (e.g. /issues?assignee=7 opened from a link).
export async function getUser(id) {
  const user = await userModel.findById(id)
  if (!user) throw notFound('User not found.', 'USER_NOT_FOUND')
  return user
}
