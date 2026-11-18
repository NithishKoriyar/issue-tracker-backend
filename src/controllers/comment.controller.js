import * as commentService from '../services/comment.service.js'

// GET /api/issues/:id/comments   (admin or assignee)
export async function list(req, res) {
  res.json({
    comments: await commentService.listComments(
      req.user,
      req.validatedParams.id,
    ),
  })
}

// POST /api/issues/:id/comments   (admin or assignee)
export async function create(req, res) {
  res.status(201).json({
    comment: await commentService.addComment(
      req.user,
      req.validatedParams.id,
      req.body.body,
    ),
  })
}
