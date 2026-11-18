import pg from 'pg'

// One shared connection pool for the whole app.
// SSL: add ?sslmode=require to DATABASE_URL only when connecting to a remote
// database over the public internet. Railway's private network doesn't need it.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

// An idle client erroring (e.g. the DB restarted) must not crash the API.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message)
})

// Always use parameters ($1, $2 …) — never build SQL with string concatenation.
export const query = (text, params) => pool.query(text, params)
