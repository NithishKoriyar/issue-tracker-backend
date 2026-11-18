import { query } from '../config/db.js'

// One issue as the API returns it (camelCase), with the assignee and creator
// as small nested objects and the number of comments.
const ISSUE_SELECT = `
  SELECT i.id, i.title, i.description, i.status,
         i.created_at AS "createdAt", i.updated_at AS "updatedAt",
         CASE WHEN a.id IS NULL THEN NULL
              ELSE json_build_object('id', a.id, 'name', a.name) END AS assignee,
         json_build_object('id', c.id, 'name', c.name) AS "createdBy",
         (SELECT COUNT(*)::int FROM comments cm WHERE cm.issue_id = i.id) AS "commentCount"
  FROM issues i
  LEFT JOIN users a ON a.id = i.assigned_to
  JOIN users c ON c.id = i.created_by`

// Builds the WHERE clause for the list filters { assigneeId, unassigned, status }.
// Every value goes in as a $n parameter; the SQL text is fixed strings only.
// Shared by list() and countMatching(), so a page and its total always agree.
function buildWhere({ assigneeId, unassigned, status } = {}) {
  const where = []
  const params = []

  if (assigneeId) {
    params.push(assigneeId)
    where.push(`i.assigned_to = $${params.length}`)
  }
  if (unassigned) where.push('i.assigned_to IS NULL')
  if (status) {
    params.push(status)
    where.push(`i.status = $${params.length}`)
  }

  return {
    clause: where.length ? ` WHERE ${where.join(' AND ')}` : '',
    params,
  }
}

// Newest activity first. `limit` / `offset` select one page.
// The id tie-breaker keeps the order stable, so rows never repeat or go
// missing between pages when several share the same updated_at.
export async function list({ limit, offset, ...filters } = {}) {
  const { clause, params } = buildWhere(filters)

  let sql = `${ISSUE_SELECT}${clause} ORDER BY i.updated_at DESC, i.id DESC`
  if (limit) {
    params.push(limit)
    sql += ` LIMIT $${params.length}`
  }
  if (offset) {
    params.push(offset)
    sql += ` OFFSET $${params.length}`
  }

  const { rows } = await query(sql, params)
  return rows
}

// How many issues match the same filters (for "page 2 of 7").
export async function countMatching(filters = {}) {
  const { clause, params } = buildWhere(filters)
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM issues i${clause}`,
    params,
  )
  return rows[0].total
}

export async function findById(id) {
  const { rows } = await query(`${ISSUE_SELECT} WHERE i.id = $1`, [id])
  return rows[0] ?? null
}

export async function create({
  title,
  description,
  status,
  assignedTo,
  createdBy,
}) {
  const { rows } = await query(
    `INSERT INTO issues (title, description, status, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title, description, status, assignedTo, createdBy],
  )
  return findById(rows[0].id)
}

// API field → column. Only these can be updated.
const UPDATABLE = {
  title: 'title',
  description: 'description',
  status: 'status',
  assignedTo: 'assigned_to',
}

export async function update(id, fields) {
  const sets = []
  const params = []
  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (fields[key] !== undefined) {
      params.push(fields[key])
      sets.push(`${column} = $${params.length}`)
    }
  }
  params.push(id)
  await query(
    `UPDATE issues SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length}`,
    params,
  )
  return findById(id)
}

export async function remove(id) {
  await query('DELETE FROM issues WHERE id = $1', [id])
}

// Dashboard counts, optionally only for one assignee.
export async function counts({ assigneeId } = {}) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'open')::int        AS open,
            COUNT(*) FILTER (WHERE status = 'in_progress')::int AS "inProgress",
            COUNT(*) FILTER (WHERE status = 'closed')::int      AS closed,
            COUNT(*) FILTER (WHERE assigned_to IS NULL)::int    AS unassigned
     FROM issues
     WHERE ($1::int IS NULL OR assigned_to = $1)`,
    [assigneeId ?? null],
  )
  return rows[0]
}
