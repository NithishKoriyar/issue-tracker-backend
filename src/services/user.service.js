import * as userModel from '../models/user.model.js'
import { notFound } from '../utils/apiError.js'

// Admin only (requireAdmin on the routes).

// One page of users with their issue counts, plus the numbers for
// "page 2 of 3". Users page: 10 per page (+ search).
// User picker: role 'user', 5 per page (+ search).
export async function listUsers({
  search,
  role,
  page = 1,
  pageSize = 10,
} = {}) {
  const filters = { search, role }
  const [users, total] = await Promise.all([
    userModel.listWithIssueCounts({
      ...filters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    userModel.countUsers(filters),
  ])
  return {
    users,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
}

// One user — lets the picker show a name for an id that isn't in its
// current results (e.g. /issues?assignee=7 opened from a link).
export async function getUser(id) {
  const user = await userModel.findById(id)
  if (!user) throw notFound('User not found.', 'USER_NOT_FOUND')
  return user
}
