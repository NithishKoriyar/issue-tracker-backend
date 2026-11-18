import * as userModel from '../models/user.model.js'

// Admin only (requireAdmin on the route): every user with their issue counts.
// Used by the Users page and the assign dropdown.
export function listUsers() {
  return userModel.listWithIssueCounts()
}
