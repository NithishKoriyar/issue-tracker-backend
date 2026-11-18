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

// Users page, dashboard and the user picker: users with how many issues they hold.
//  search → matches anywhere in the name or email, case-insensitive
//  role   → only 'user' or only 'admin' accounts (the picker asks for 'user')
//  limit  → at most N rows (the picker shows 5 before you type)
// Values go in as $n parameters; the SQL text is fixed strings only.
export async function listWithIssueCounts({ search, role, limit } = {}) {
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
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  let limitClause = ''
  if (limit) {
    params.push(limit)
    limitClause = `LIMIT $${params.length}`
  }

  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at AS "createdAt",
            json_build_object(
              'total',      COUNT(i.id)::int,
              'open',       COUNT(i.id) FILTER (WHERE i.status = 'open')::int,
              'inProgress', COUNT(i.id) FILTER (WHERE i.status = 'in_progress')::int,
              'closed',     COUNT(i.id) FILTER (WHERE i.status = 'closed')::int
            ) AS "issueCounts"
     FROM users u
     LEFT JOIN issues i ON i.assigned_to = u.id
     ${where}
     GROUP BY u.id
     ORDER BY u.role, u.name, u.id
     ${limitClause}`,
    params,
  )
  return rows
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
