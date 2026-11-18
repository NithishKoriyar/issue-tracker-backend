import * as issueModel from '../models/issue.model.js'
import { badRequest, notFound } from '../utils/apiError.js'

// `actor` is the logged-in user from requireAuth: { id, role }.
const isAdmin = (actor) => actor.role === 'admin'

// Admin sees every issue (optionally filtered); a user only their own.
export async function listIssues(actor, { status, assignee } = {}) {
  if (!isAdmin(actor)) {
    return issueModel.list({ assigneeId: actor.id, status })
  }
  return issueModel.list({
    status,
    assigneeId: typeof assignee === 'number' ? assignee : undefined,
    unassigned: assignee === 'unassigned',
  })
}

// The single access rule for one issue: admin, or the person it's assigned to.
// Anyone else gets 404, so a user can't even learn that the issue exists.
export async function getIssue(actor, id) {
  const issue = await issueModel.findById(id)
  if (!issue || (!isAdmin(actor) && issue.assignee?.id !== actor.id)) {
    throw notFound('Issue not found.', 'ISSUE_NOT_FOUND')
  }
  return issue
}

// assigned_to is a foreign key: an id that isn't a user fails with 23503.
async function withAssigneeCheck(operation) {
  try {
    return await operation()
  } catch (err) {
    if (err.code === '23503') {
      throw badRequest(
        'The selected assignee does not exist.',
        'ASSIGNEE_NOT_FOUND',
      )
    }
    throw err
  }
}

// Admin only (enforced by requireAdmin on the route).
export async function createIssue(actor, data) {
  return withAssigneeCheck(() =>
    issueModel.create({ ...data, createdBy: actor.id }),
  )
}

// Admin only.
export async function updateIssue(actor, id, data) {
  await getIssue(actor, id)
  return withAssigneeCheck(() => issueModel.update(id, data))
}

// Admin, or the assignee of this issue.
export async function updateStatus(actor, id, status) {
  await getIssue(actor, id)
  return issueModel.update(id, { status })
}

// Admin only. Comments go with it (ON DELETE CASCADE).
export async function deleteIssue(actor, id) {
  await getIssue(actor, id)
  await issueModel.remove(id)
}
