import { query } from '../config/db.js'

// Columns safe to send to the client (camelCase for the JSON API).
// password_hash is deliberately NOT here.
const PUBLIC_COLUMNS = `id, name, email, role, created_at AS "createdAt"`

export async function findById(id) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export async function findByEmail(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = $1`,
    [email],
  )
  return rows[0] ?? null
}

// Login only: includes the password hash so the service can verify it.
export async function findByEmailWithPassword(email) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS}, password_hash AS "passwordHash"
     FROM users WHERE email = $1`,
    [email],
  )
  return rows[0] ?? null
}

// Escape LIKE's wildcards so a search for "50%" or "a_b" matches those exact
// characters instead of "anything". (Backslash is ILIKE's default escape.)
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&')

// WHERE clause for the user filters, shared by the list and the count so a
// page and its total always agree.
//  search → matches anywhere in the name or email, case-insensitive
//  role   → only 'user' or only 'admin' accounts (the picker asks for 'user')
// Values go in as $n parameters; the SQL text is fixed strings only.
function buildUserWhere({ search, role } = {}) {
  const params = []
  const conditions = []
  if (search) {
    params.push(`%${escapeLike(search)}%`)
    conditions.push(
      `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`,
    )
  }
  if (role) {
    params.push(role)
    conditions.push(`u.role = $${params.length}`)
  }
  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

// A user + how many issues they hold, by status. Shared by the queries below.
const USER_WITH_COUNTS_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.created_at AS "createdAt",
         json_build_object(
           'total',      COUNT(i.id)::int,
           'open',       COUNT(i.id) FILTER (WHERE i.status = 'open')::int,
           'inProgress', COUNT(i.id) FILTER (WHERE i.status = 'in_progress')::int,
           'closed',     COUNT(i.id) FILTER (WHERE i.status = 'closed')::int
         ) AS "issueCounts"
  FROM users u
  LEFT JOIN issues i ON i.assigned_to = u.id`

// Users page and the user picker: users with their issue counts.
// `limit` / `offset` select one page (omit both → everyone).
// ORDER BY ends with the id so pages never overlap or skip a row.
export async function listWithIssueCounts({ limit, offset, ...filters } = {}) {
  const { clause: where, params } = buildUserWhere(filters)
  let limitClause = ''
  if (limit) {
    params.push(limit)
    limitClause = `LIMIT $${params.length}`
  }
  if (offset) {
    params.push(offset)
    limitClause += ` OFFSET $${params.length}`
  }

  const { rows } = await query(
    `${USER_WITH_COUNTS_SELECT}
     ${where}
     GROUP BY u.id
     ORDER BY u.role, u.name, u.id
     ${limitClause}`,
    params,
  )
  return rows
}

// Dashboard "Issues by user": the regular users carrying the most work right
// now — most unfinished (open + in progress) issues first, then most issues
// overall. People with no issues at all are left out.
export async function listBusiestUsers(limit) {
  const { rows } = await query(
    `${USER_WITH_COUNTS_SELECT}
     WHERE u.role = 'user'
     GROUP BY u.id
     HAVING COUNT(i.id) > 0
     ORDER BY COUNT(i.id) FILTER (WHERE i.status <> 'closed') DESC,
              COUNT(i.id) DESC,
              u.name, u.id
     LIMIT $1`,
    [limit],
  )
  return rows
}

// How many users match the same filters (for "page 2 of 3").
export async function countUsers(filters = {}) {
  const { clause, params } = buildUserWhere(filters)
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM users u ${clause}`,
    params,
  )
  return rows[0].total
}

export async function create({ name, email, passwordHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role],
  )
  return rows[0]
}
