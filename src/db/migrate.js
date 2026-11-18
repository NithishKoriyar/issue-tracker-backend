// npm run db:migrate — applies schema.sql. Every statement is idempotent
// (IF NOT EXISTS), so this is safe to run on every deploy.
import { readFile } from 'node:fs/promises'
import { pool } from '../config/db.js'

const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')

try {
  await pool.query(sql)
  console.log('✅ Database schema is up to date')
} catch (err) {
  console.error('❌ Migration failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
