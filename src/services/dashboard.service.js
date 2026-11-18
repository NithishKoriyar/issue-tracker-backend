import * as issueModel from '../models/issue.model.js'
import * as userModel from '../models/user.model.js'

const RECENT_LIMIT = 5 // "Recently updated" card
const BUSIEST_LIMIT = 5 // "Issues by user" card (full list: the Users page)

// One endpoint, scoped by role:
//  admin → counts over ALL issues + the 5 busiest users + latest activity
//  user  → counts over THEIR issues + their latest activity
export async function getStats(actor) {
  if (actor.role === 'admin') {
    const [totals, byUser, recentIssues] = await Promise.all([
      issueModel.counts(),
      userModel.listBusiestUsers(BUSIEST_LIMIT),
      issueModel.list({ limit: RECENT_LIMIT }),
    ])
    return { totals, byUser, recentIssues }
  }

  const [counts, recentIssues] = await Promise.all([
    issueModel.counts({ assigneeId: actor.id }),
    issueModel.list({ assigneeId: actor.id, limit: RECENT_LIMIT }),
  ])
  // "Unassigned" means nothing for a user's own issues.
  // eslint-disable-next-line no-unused-vars
  const { unassigned, ...totals } = counts
  return { totals, recentIssues }
}
