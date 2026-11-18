import { Router } from 'express'
import * as commentController from '../controllers/comment.controller.js'
import * as issueController from '../controllers/issue.controller.js'
import { requireAdmin, requireAuth } from '../middlewares/auth.middleware.js'
import { validate } from '../middlewares/validate.middleware.js'
import {
  createCommentSchema,
  createIssueSchema,
  issueIdParams,
  listIssuesQuery,
  updateIssueSchema,
  updateStatusSchema,
} from '../validators/issue.validator.js'

// Mounted at /api/issues. Every route needs a logged-in user.
// requireAdmin guards admin-only actions; "admin or assignee" is checked in
// the service, because it depends on the issue itself.
export const issueRouter = Router()

issueRouter.use(requireAuth)

issueRouter.get('/', validate({ query: listIssuesQuery }), issueController.list)
issueRouter.post(
  '/',
  requireAdmin,
  validate({ body: createIssueSchema }),
  issueController.create,
)
issueRouter.get(
  '/:id',
  validate({ params: issueIdParams }),
  issueController.get,
)
issueRouter.patch(
  '/:id',
  requireAdmin,
  validate({ params: issueIdParams, body: updateIssueSchema }),
  issueController.update,
)
issueRouter.patch(
  '/:id/status',
  validate({ params: issueIdParams, body: updateStatusSchema }),
  issueController.updateStatus,
)
issueRouter.delete(
  '/:id',
  requireAdmin,
  validate({ params: issueIdParams }),
  issueController.remove,
)

// Comments on an issue
issueRouter.get(
  '/:id/comments',
  validate({ params: issueIdParams }),
  commentController.list,
)
issueRouter.post(
  '/:id/comments',
  validate({ params: issueIdParams, body: createCommentSchema }),
  commentController.create,
)
