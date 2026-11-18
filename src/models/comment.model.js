import { query } from '../config/db.js'

const COMMENT_SELECT = `
  SELECT cm.id, cm.body, cm.created_at AS "createdAt",
         json_build_object('id', u.id, 'name', u.name, 'role', u.role) AS author
  FROM comments cm
  JOIN users u ON u.id = cm.user_id`

// Oldest first, like a conversation.
export async function listByIssue(issueId) {
  const { rows } = await query(
    `${COMMENT_SELECT} WHERE cm.issue_id = $1 ORDER BY cm.created_at, cm.id`,
    [issueId],
  )
  return rows
}

export async function create({ issueId, userId, body }) {
  const { rows } = await query(
    `INSERT INTO comments (issue_id, user_id, body) VALUES ($1, $2, $3) RETURNING id`,
    [issueId, userId, body],
  )
  const created = await query(`${COMMENT_SELECT} WHERE cm.id = $1`, [
    rows[0].id,
  ])
  return created.rows[0]
}
