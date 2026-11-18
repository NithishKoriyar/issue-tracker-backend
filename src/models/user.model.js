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

// Admin Users page + dashboard: every user with how many issues they hold.
export async function listWithIssueCounts() {
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
     GROUP BY u.id
     ORDER BY u.role, u.name`,
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
