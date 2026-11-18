import { query } from '../config/db.js'

// Every function takes the SHA-256 hash of a refresh token — the raw token
// itself is never stored or queried.

export async function create({ userId, tokenHash, expiresAt }) {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  )
}

// Atomically "use up" a token: succeeds only if it is still valid (not revoked,
// not expired). Two simultaneous refreshes with the same token can't both win —
// only one UPDATE matches the row. Returns { userId } or null.
export async function consume(tokenHash) {
  const { rows } = await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
     RETURNING user_id AS "userId"`,
    [tokenHash],
  )
  return rows[0] ?? null
}

// Used to explain WHY consume() failed: unknown, revoked or expired.
export async function findByHash(tokenHash) {
  const { rows } = await query(
    `SELECT user_id AS "userId", expires_at AS "expiresAt", revoked_at AS "revokedAt"
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  )
  return rows[0] ?? null
}

// Logout: revoke just this session's token.
export async function revoke(tokenHash) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  )
}

// Reuse detected (likely a stolen token): end every session of this user.
export async function revokeAllForUser(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  )
}

// Housekeeping on login: drop this user's expired rows. Revoked-but-unexpired
// rows are kept, because reuse detection needs them.
export async function deleteExpiredForUser(userId) {
  await query(
    `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < now()`,
    [userId],
  )
}
