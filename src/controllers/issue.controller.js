import * as issueService from '../services/issue.service.js'

// req.user           → from requireAuth
// req.validatedParams / req.validatedQuery / req.body → from validate()

// GET /api/issues?status=&assignee=
export async function list(req, res) {
  res.json({
    issues: await issueService.listIssues(req.user, req.validatedQuery),
  })
}

// GET /api/issues/:id
export async function get(req, res) {
  res.json({
    issue: await issueService.getIssue(req.user, req.validatedParams.id),
  })
}

// POST /api/issues   (admin)
export async function create(req, res) {
  res
    .status(201)
    .json({ issue: await issueService.createIssue(req.user, req.body) })
}

// PATCH /api/issues/:id   (admin)
export async function update(req, res) {
  res.json({
    issue: await issueService.updateIssue(
      req.user,
      req.validatedParams.id,
      req.body,
    ),
  })
}

// PATCH /api/issues/:id/status   (admin or assignee)
export async function updateStatus(req, res) {
  res.json({
    issue: await issueService.updateStatus(
      req.user,
      req.validatedParams.id,
      req.body.status,
    ),
  })
}

// DELETE /api/issues/:id   (admin)
export async function remove(req, res) {
  await issueService.deleteIssue(req.user, req.validatedParams.id)
  res.status(204).end()
}
