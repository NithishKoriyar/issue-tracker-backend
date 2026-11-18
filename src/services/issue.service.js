import * as issueModel from '../models/issue.model.js'
import { badRequest, notFound } from '../utils/apiError.js'

// `actor` is the logged-in user from requireAuth: { id, role }.
const isAdmin = (actor) => actor.role === 'admin'

// Admin sees every issue (optionally filtered); a user only their own.
// Returns one page plus the numbers the UI needs for "page 2 of 7".
export async function listIssues(
  actor,
  { status, assignee, page = 1, pageSize = 10 } = {},
) {
  const filters = isAdmin(actor)
    ? {
        status,
        assigneeId: typeof assignee === 'number' ? assignee : undefined,
        unassigned: assignee === 'unassigned',
      }
    : // A user's own issues only — any assignee filter they send is ignored.
      { status, assigneeId: actor.id }

  const [issues, total] = await Promise.all([
    issueModel.list({
      ...filters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    issueModel.countMatching(filters),
  ])

  return {
    issues,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  }
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
