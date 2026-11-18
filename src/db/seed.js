// npm run db:seed — safe to run on every deploy.
//  1. Creates the admin account from ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD
//     (skipped if that email already exists — an existing password is never overwritten).
//  2. Adds demo users, issues and comments, but ONLY when there are no issues yet.
import bcrypt from 'bcryptjs'
import { pool } from '../config/db.js'

const BCRYPT_ROUNDS = 10

// Demo accounts for reviewers (documented in the README).
const DEMO_USER_PASSWORD = 'User@12345'
const DEMO_USERS = [
  { name: 'Asha Rao', email: 'asha@example.com' },
  { name: 'Vikram Nair', email: 'vikram@example.com' },
]

const adminName = process.env.ADMIN_NAME || 'Admin'
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD

if (!adminEmail || !adminPassword) {
  console.error(
    '❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin',
  )
  process.exit(1)
}

// Insert a user unless the email exists; return its id either way.
async function upsertUser(client, { name, email, password, role }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    [name, email, passwordHash, role],
  )
  const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [
    email,
  ])
  return rows[0].id
}

const client = await pool.connect()
try {
  await client.query('BEGIN')

  const adminId = await upsertUser(client, {
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin',
  })
  console.log(`✅ Admin ready: ${adminEmail}`)

  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM issues',
  )
  if (rows[0].count > 0) {
    console.log('ℹ️  Issues already exist — demo data skipped')
  } else {
    const demo = { password: DEMO_USER_PASSWORD, role: 'user' }
    const ashaId = await upsertUser(client, { ...DEMO_USERS[0], ...demo })
    const vikramId = await upsertUser(client, { ...DEMO_USERS[1], ...demo })

    const issues = [
      [
        'Login page shows a blank screen on Safari',
        'Reported by two customers on Safari 17. Chrome works fine.',
        'in_progress',
        ashaId,
      ],
      [
        "Dashboard counts don't refresh after closing an issue",
        'The Closed count only updates after a full page reload.',
        'open',
        ashaId,
      ],
      [
        'Add pagination to the issues list',
        'The list gets slow past a few hundred issues.',
        'open',
        vikramId,
      ],
      [
        'Password reset email has a broken link',
        'The link points to the staging domain.',
        'closed',
        vikramId,
      ],
      [
        'Export issues to CSV',
        'Managers want a weekly export for reporting.',
        'open',
        null,
      ],
      [
        'Typo on the registration page',
        '"Pasword" should be "Password".',
        'closed',
        ashaId,
      ],
    ]

    const issueIds = []
    for (const [title, description, status, assignedTo] of issues) {
      const res = await client.query(
        `INSERT INTO issues (title, description, status, created_by, assigned_to)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [title, description, status, adminId, assignedTo],
      )
      issueIds.push(res.rows[0].id)
    }

    const comments = [
      [issueIds[0], ashaId, 'Reproduced on Safari 17. Looking into it now.'],
      [
        issueIds[0],
        adminId,
        'Thanks — please treat this one as high priority.',
      ],
      [
        issueIds[3],
        vikramId,
        'Fixed the URL template and verified the email on staging.',
      ],
    ]
    for (const [issueId, userId, body] of comments) {
      await client.query(
        'INSERT INTO comments (issue_id, user_id, body) VALUES ($1, $2, $3)',
        [issueId, userId, body],
      )
    }

    console.log(
      `✅ Demo data: ${DEMO_USERS.length} users (password ${DEMO_USER_PASSWORD}), ${issues.length} issues, ${comments.length} comments`,
    )
  }

  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK')
  console.error('❌ Seed failed:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
