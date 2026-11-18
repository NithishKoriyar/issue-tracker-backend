import * as commentModel from '../models/comment.model.js'
import { getIssue } from './issue.service.js'

// Comments follow the issue's access rule: admin, or the issue's assignee.
// getIssue() throws 404 for everyone else.

export async function listComments(actor, issueId) {
  await getIssue(actor, issueId)
  return commentModel.listByIssue(issueId)
}

export async function addComment(actor, issueId, body) {
  await getIssue(actor, issueId)
  return commentModel.create({ issueId, userId: actor.id, body })
}
