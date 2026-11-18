// Seeds the admin account and the demo data.
//
//   npm run db:seed        Safe on every deploy (Railway runs it before each one).
//                          1. Creates the admin from ADMIN_NAME / ADMIN_EMAIL /
//                             ADMIN_PASSWORD (an existing account is never changed).
//                          2. Adds the demo users, issues and comments ONLY when there
//                             are no issues yet — so issues deleted later never return.
//
//   npm run db:seed:demo   Local helper for a database that already has data: adds any
//                          demo user (matched by email) or demo issue (matched by title)
//                          that is missing. Running it again adds nothing new.
import bcrypt from 'bcryptjs'
import { pool } from '../config/db.js'

const BCRYPT_ROUNDS = 10
const FORCE_DEMO = process.argv.includes('--demo')

// ---- Demo data (documented in the README) ---------------------------------

// Every demo account uses this password.
const DEMO_USER_PASSWORD = 'User@12345'

const DEMO_USERS = [
  { name: 'Asha Rao', email: 'asha@example.com' },
  { name: 'Vikram Nair', email: 'vikram@example.com' },
  { name: 'Priya Sharma', email: 'priya@example.com' },
  { name: 'Arjun Mehta', email: 'arjun@example.com' },
  { name: 'Neha Kulkarni', email: 'neha@example.com' },
  { name: 'Rohan Desai', email: 'rohan@example.com' },
  { name: 'Kavya Iyer', email: 'kavya@example.com' },
  { name: 'Aditya Joshi', email: 'aditya@example.com' },
  { name: 'Sneha Patil', email: 'sneha@example.com' },
  { name: 'Varun Bhat', email: 'varun@example.com' },
  { name: 'Meera Pillai', email: 'meera@example.com' },
  { name: 'Karthik Reddy', email: 'karthik@example.com' },
  { name: 'Ananya Gupta', email: 'ananya@example.com' },
  { name: 'Siddharth Menon', email: 'siddharth@example.com' },
  { name: 'Divya Shenoy', email: 'divya@example.com' },
  { name: 'Farhan Ali', email: 'farhan@example.com' },
  { name: 'Ishita Banerjee', email: 'ishita@example.com' },
  { name: 'Manoj Hegde', email: 'manoj@example.com' },
  { name: 'Pooja Shetty', email: 'pooja@example.com' },
  { name: 'Nikhil Kamath', email: 'nikhil@example.com' },
]

// assignee = a demo user's email, or null for unassigned.
// 10 open · 5 in progress · 5 closed · 3 unassigned.
const DEMO_ISSUES = [
  {
    title: 'Login page shows a blank screen on Safari',
    description: 'Reported by two customers on Safari 17. Chrome works fine.',
    status: 'in_progress',
    assignee: 'asha@example.com',
  },
  {
    title: "Dashboard counts don't refresh after closing an issue",
    description: 'The Closed count only updates after a full page reload.',
    status: 'open',
    assignee: 'asha@example.com',
  },
  {
    title: 'Add pagination to the issues list',
    description: 'The list gets slow past a few hundred issues.',
    status: 'open',
    assignee: 'vikram@example.com',
  },
  {
    title: 'Password reset email has a broken link',
    description: 'The link points to the staging domain.',
    status: 'closed',
    assignee: 'vikram@example.com',
  },
  {
    title: 'Export issues to CSV',
    description: 'Managers want a weekly export for reporting.',
    status: 'open',
    assignee: null,
  },
  {
    title: 'Typo on the registration page',
    description: '"Pasword" should be "Password".',
    status: 'closed',
    assignee: 'asha@example.com',
  },
  {
    title: 'Session expires too early on mobile',
    description:
      'Users on mobile get logged out after a few minutes of inactivity.',
    status: 'open',
    assignee: 'sneha@example.com',
  },
  {
    title: 'Add a dark mode toggle',
    description: 'Several people asked for a dark theme for late-night work.',
    status: 'open',
    assignee: null,
  },
  {
    title: 'Search by issue title',
    description: 'Finding an old issue means scrolling the whole list.',
    status: 'in_progress',
    assignee: 'varun@example.com',
  },
  {
    title: 'Comment timestamps show UTC instead of local time',
    description: 'Times should follow the browser time zone.',
    status: 'closed',
    assignee: 'meera@example.com',
  },
  {
    title: 'Long titles overflow the table on small screens',
    description: 'Titles push the status column off-screen on phones.',
    status: 'open',
    assignee: 'meera@example.com',
  },
  {
    title: 'Email notification when an issue is assigned',
    description:
      'Assignees only find out about new issues by checking the app.',
    status: 'open',
    assignee: null,
  },
  {
    title: 'Slow dashboard with many issues',
    description: 'The dashboard takes a few seconds to load in larger teams.',
    status: 'in_progress',
    assignee: 'karthik@example.com',
  },
  {
    title: 'Broken link in the footer',
    description: 'The "Help" link returns a 404.',
    status: 'closed',
    assignee: 'vikram@example.com',
  },
  {
    title: 'Profile picture upload fails for PNG files',
    description: 'JPG works, PNG uploads end with a generic error.',
    status: 'open',
    assignee: 'priya@example.com',
  },
  {
    title: 'Add keyboard shortcuts for common actions',
    description: 'N for a new issue and / to focus search would save time.',
    status: 'in_progress',
    assignee: 'arjun@example.com',
  },
  {
    title: 'Duplicate issues created on double-click',
    description: 'Clicking "Create" twice quickly saves the same issue twice.',
    status: 'open',
    assignee: 'neha@example.com',
  },
  {
    title: 'Filter issues by date range',
    description: 'Support asked to see only issues created this week.',
    status: 'open',
    assignee: 'rohan@example.com',
  },
  {
    title: 'Sort order resets after editing an issue',
    description: 'Saving an issue jumps the list back to the default order.',
    status: 'closed',
    assignee: 'kavya@example.com',
  },
  {
    title: 'Missing labels on icon-only buttons',
    description: 'Screen readers announce some buttons as just "button".',
    status: 'in_progress',
    assignee: 'aditya@example.com',
  },
]

// author = a demo user's email, or 'admin'. Added only with a newly created issue.
const DEMO_COMMENTS = [
  {
    issue: 'Login page shows a blank screen on Safari',
    author: 'asha@example.com',
    body: 'Reproduced on Safari 17. Looking into it now.',
  },
  {
    issue: 'Login page shows a blank screen on Safari',
    author: 'admin',
    body: 'Thanks — please treat this one as high priority.',
  },
  {
    issue: 'Password reset email has a broken link',
    author: 'vikram@example.com',
    body: 'Fixed the URL template and verified the email on staging.',
  },
  {
    issue: 'Search by issue title',
    author: 'varun@example.com',
    body: 'Starting with a simple case-insensitive match on the title.',
  },
  {
    issue: 'Slow dashboard with many issues',
    author: 'karthik@example.com',
    body: 'Most of the time goes into counting by status; an index should help.',
  },
  {
    issue: 'Add keyboard shortcuts for common actions',
    author: 'arjun@example.com',
    body: 'Proposal: N for a new issue, / to focus search, Esc to close dialogs.',
  },
  {
    issue: 'Add keyboard shortcuts for common actions',
    author: 'admin',
    body: 'Sounds good — go ahead.',
  },
  {
    issue: 'Sort order resets after editing an issue',
    author: 'kavya@example.com',
    body: 'Fixed — the list keeps its order after saving now.',
  },
]

// ---- Admin from the environment -------------------------------------------

const adminName = process.env.ADMIN_NAME || 'Admin'
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD

if (!adminEmail || !adminPassword) {
  console.error(
    '❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin',
  )
  process.exit(1)
}

// ---- Helpers ----------------------------------------------------------------

// Insert a user unless the email exists; return the id either way, and
// whether it was newly created.
async function upsertUser(client, { name, email, passwordHash, role }) {
  const inserted = await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [name, email, passwordHash, role],
  )
  if (inserted.rows[0]) return { id: inserted.rows[0].id, created: true }
  const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [
    email,
  ])
  return { id: rows[0].id, created: false }
}

// Insert a demo issue unless one with the same title exists.
// Returns the new id, or null if it already existed.
// The ::casts are needed because $1 is used twice (as a value and in the
// comparison) — without them Postgres infers two different types for it.
async function insertIssueIfMissing(client, issue, createdBy, assignedTo) {
  const { rows } = await client.query(
    `INSERT INTO issues (title, description, status, created_by, assigned_to)
     SELECT $1::text, $2::text, $3::text, $4::int, $5::int
     WHERE NOT EXISTS (SELECT 1 FROM issues WHERE title = $1::text)
     RETURNING id`,
    [issue.title, issue.description, issue.status, createdBy, assignedTo],
  )
  return rows[0]?.id ?? null
}

async function seedDemoData(client, adminId) {
  // Hash the shared demo password once, not 20 times.
  const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, BCRYPT_ROUNDS)

  const userIds = new Map([['admin', adminId]]) // email → id
  let usersCreated = 0
  for (const user of DEMO_USERS) {
    const { id, created } = await upsertUser(client, {
      ...user,
      passwordHash,
      role: 'user',
    })
    userIds.set(user.email, id)
    if (created) usersCreated++
  }

  const newIssueIds = new Map() // title → id, only for issues created now
  for (const issue of DEMO_ISSUES) {
    const assignedTo = issue.assignee ? userIds.get(issue.assignee) : null
    const id = await insertIssueIfMissing(client, issue, adminId, assignedTo)
    if (id) newIssueIds.set(issue.title, id)
  }

  let commentsCreated = 0
  for (const comment of DEMO_COMMENTS) {
    const issueId = newIssueIds.get(comment.issue)
    if (!issueId) continue // the issue already existed — leave its comments alone
    await client.query(
      'INSERT INTO comments (issue_id, user_id, body) VALUES ($1, $2, $3)',
      [issueId, userIds.get(comment.author), comment.body],
    )
    commentsCreated++
  }

  console.log(
    `✅ Demo data: +${usersCreated} users, +${newIssueIds.size} issues, +${commentsCreated} comments ` +
      `(of ${DEMO_USERS.length} users / ${DEMO_ISSUES.length} issues; password ${DEMO_USER_PASSWORD})`,
  )
}

// ---- Run --------------------------------------------------------------------

const client = await pool.connect()
try {
  await client.query('BEGIN')

  const adminHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS)
  const { id: adminId } = await upsertUser(client, {
    name: adminName,
    email: adminEmail,
    passwordHash: adminHash,
    role: 'admin',
  })
  console.log(`✅ Admin ready: ${adminEmail}`)

  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM issues',
  )
  if (rows[0].count > 0 && !FORCE_DEMO) {
    console.log(
      'ℹ️  Issues already exist — demo data skipped (use npm run db:seed:demo to add missing demo data)',
    )
  } else {
    await seedDemoData(client, adminId)
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
