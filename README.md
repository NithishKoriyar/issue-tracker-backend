# Issue Tracker: Backend API

REST API for the Issue Tracker: authentication with refresh tokens, issues, assignment, status tracking, comments, users and dashboard counts. Express 5 (JavaScript, ES modules) on PostgreSQL with raw parameterized SQL.

|                      |                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live app**         | https://issue-tracker-frontend.up.railway.app                                                                                                           |
| **Live API**         | `https://issue-tracker-frontend.up.railway.app/api/...` (the frontend's nginx proxies `/api` to this service; the backend itself has no public address) |
| **Frontend repo**    | https://github.com/NithishKoriyar/issue-tracker-frontend (README, demo accounts, architecture)                                                          |
| **This repo**        | https://github.com/NithishKoriyar/issue-tracker-backend                                                                                                 |
| **Deployment guide** | the Deployment section of [BRD.md](https://github.com/NithishKoriyar/issue-tracker-frontend/blob/main/BRD.md)                                           |

Demo admin: `admin@gmail.com` / `admin@123`. Demo user: `asha@example.com` / `User@12345`.

## Features

- Register and log in (users), admin login with `asAdmin`.
- Access token (JWT, 15 min) plus a rotating refresh token in an httpOnly cookie, with reuse detection.
- Issues: create, edit, delete, assign (admin); list with filters and pagination; status changes by the admin or the assignee.
- Comments on issues (admin or assignee).
- Users list with search, pagination and per-user issue counts (admin).
- Dashboard counts, scoped by role.

## Architecture

```
request → rate limit → validate (zod) → auth → controller → service → model → PostgreSQL
                                                   │           │         └ all SQL lives here
                                                   │           └ business rules and permissions
                                                   └ req/res only
errors thrown anywhere → one error handler → { "error": { "code", "message", "details"? } }
```

```
server.js                 entry point: listens on PORT (default 5000), on all interfaces
src/
  app.js                  helmet, morgan, JSON body (100 kb), cookies, /api router, 404 + error handlers
  config/db.js            pg Pool + query()
  routes/                 auth, issue, user, dashboard routers mounted under /api
  controllers/            request/response handling only
  services/               auth, token, issue, comment, user, dashboard (rules live here)
  models/                 user, issue, comment, refreshToken (raw SQL)
  validators/             zod schemas for bodies, params and queries
  middlewares/            auth (requireAuth, requireAdmin), validate, rateLimit, error
  utils/apiError.js       ApiError + helpers
  db/                     schema.sql, migrate.js, seed.js
```

### Design decisions

- **Permissions are checked on the server on every request.** One function (`getIssue`) is the single access rule for an issue: the admin or its assignee may see it; anyone else gets `404`, so ids of other people's issues are not revealed.
- **No CORS.** The browser only calls the frontend's own origin, which proxies `/api` here. The refresh cookie is therefore first-party and `SameSite=Strict`.
- **Refresh rotation is atomic** (`UPDATE … WHERE revoked_at IS NULL`). A revoked token presented again after a 30-second grace window (which covers two tabs refreshing at once) revokes all of that user's tokens.
- **Pagination uses the same WHERE clause for the page and the total**, with a stable `ORDER BY … id` tie-breaker.
- The JSON is **camelCase**; SQL columns are aliased (`created_at AS "createdAt"`).

## Tech stack

Node 22+, Express 5, PostgreSQL (`pg`, raw SQL), zod 4, bcryptjs, jsonwebtoken (HS256 pinned), cookie-parser, helmet, express-rate-limit, morgan, Prettier.

## Run it locally

Prerequisites: Node 22.9+ and PostgreSQL 16+.

```bash
git clone https://github.com/NithishKoriyar/issue-tracker-backend.git
cd issue-tracker-backend
npm install
cp .env.example .env              # edit DATABASE_URL and JWT_ACCESS_SECRET
createdb issue_tracker            # or create the database any other way
npm run db:migrate                # create the tables
npm run db:seed                   # admin + demo data
npm run dev                       # http://localhost:5000
```

Always start through the npm scripts: they load `.env` (`node --env-file-if-exists=.env`). A bare `node server.js` does not read `.env`.

### Scripts

| Command                            | What it does                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                      | start with auto-restart on file changes                                                                               |
| `npm start`                        | production start                                                                                                      |
| `npm run db:migrate`               | apply `src/db/schema.sql` (idempotent)                                                                                |
| `npm run db:seed`                  | create the admin from env; add 20 demo users, 20 issues and comments **only if there are no issues yet** (idempotent) |
| `npm run db:seed:demo`             | add any missing demo user or issue even if the database already has data                                              |
| `npm run format` / `npm run check` | Prettier write / check                                                                                                |

## Environment variables

Copy `.env.example` to `.env` locally. On Railway, set them in the service's Variables tab.

| Variable                                      | Required     | Example / meaning                                                                                |
| --------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                | yes          | `postgres://user:password@localhost:5432/issue_tracker`; on Railway `${{Postgres.DATABASE_URL}}` |
| `JWT_ACCESS_SECRET`                           | yes          | long random string, 32+ characters                                                               |
| `ACCESS_TOKEN_TTL`                            | no           | `15m`                                                                                            |
| `REFRESH_TOKEN_TTL_DAYS`                      | no           | `7`                                                                                              |
| `PORT`                                        | no           | `5000` (set it explicitly on Railway; it must match the frontend's `BACKEND_URL`)                |
| `NODE_ENV`                                    | no           | `production` makes the refresh cookie `Secure`                                                   |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | for the seed | the administrator account created by `db:seed`                                                   |

## Database schema

Four tables, created by `src/db/schema.sql`:

| Table            | Columns                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`          | `id`, `name`, `email` (unique, lower-case), `password_hash` (bcrypt), `role` (`admin` or `user`), `created_at`                                                         |
| `issues`         | `id`, `title`, `description`, `status` (`open`, `in_progress`, `closed`), `created_by` → users, `assigned_to` → users (set null on delete), `created_at`, `updated_at` |
| `comments`       | `id`, `issue_id` → issues (cascade), `user_id` → users, `body`, `created_at`                                                                                           |
| `refresh_tokens` | `id`, `user_id` → users (cascade), `token_hash` (SHA-256, unique), `expires_at`, `revoked_at`, `created_at`                                                            |

## API reference

Base path `/api`. JSON in and out. Protected routes need `Authorization: Bearer <accessToken>`.

Errors always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Title is required", "details": [ ... ] } }
```

### Auth

| Method | Path             | Auth           | Body                                                 | Success                                                             |
| ------ | ---------------- | -------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| POST   | `/auth/register` | public         | `{ name, email, password }` (password 8 to 72 chars) | `201 { accessToken, user }` + refresh cookie. Role is always `user` |
| POST   | `/auth/login`    | public         | `{ email, password, asAdmin? }`                      | `200 { accessToken, user }` + refresh cookie                        |
| POST   | `/auth/refresh`  | refresh cookie | none                                                 | `200 { accessToken, user }` + a new refresh cookie (rotation)       |
| POST   | `/auth/logout`   | refresh cookie | none                                                 | `204`, token revoked and cookie cleared                             |
| GET    | `/auth/me`       | access token   | none                                                 | `200 { user }`                                                      |

The refresh cookie is `refreshToken`: `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` in production. Login and register allow 10 attempts per 15 minutes per IP and email (`429 TOO_MANY_REQUESTS`).

`asAdmin: true` with a non-admin account returns `403 NOT_ADMIN` and creates no session.

### Issues

| Method | Path                   | Who                   | Body / query                                                                                             | Success                      |
| ------ | ---------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| GET    | `/issues`              | admin: all, user: own | `?status=open\|in_progress\|closed&assignee=<userId>\|unassigned&page=1&pageSize=10` (pageSize 1 to 100) | `200 { issues, pagination }` |
| POST   | `/issues`              | admin                 | `{ title, description?, status?, assignedTo? }` (`assignedTo`: user id or null)                          | `201 { issue }`              |
| GET    | `/issues/:id`          | admin or assignee     | none                                                                                                     | `200 { issue }`              |
| PATCH  | `/issues/:id`          | admin                 | any of `{ title, description, status, assignedTo }`                                                      | `200 { issue }`              |
| PATCH  | `/issues/:id/status`   | admin or assignee     | `{ status }`                                                                                             | `200 { issue }`              |
| DELETE | `/issues/:id`          | admin                 | none                                                                                                     | `204`                        |
| GET    | `/issues/:id/comments` | admin or assignee     | none                                                                                                     | `200 { comments }`           |
| POST   | `/issues/:id/comments` | admin or assignee     | `{ body }` (1 to 2000 chars)                                                                             | `201 { comment }`            |

An issue looks like:

```json
{
  "id": 7,
  "title": "Login page shows a blank screen on Safari",
  "description": "…",
  "status": "in_progress",
  "assignee": { "id": 2, "name": "Asha" },
  "createdBy": { "id": 1, "name": "Admin" },
  "commentCount": 3,
  "createdAt": "2026-11-18T09:12:00.000Z",
  "updatedAt": "2026-11-18T10:02:00.000Z"
}
```

`assignee` is `null` for an unassigned issue. `pagination` is `{ page, pageSize, total, totalPages }`.

### Users (admin only)

| Method | Path         | Query                                                                            | Success                                                  |
| ------ | ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| GET    | `/users`     | `?search=<name or email>&role=admin\|user&page=1&pageSize=10` (pageSize 1 to 50) | `200 { users, pagination }`, each user with issue counts |
| GET    | `/users/:id` | none                                                                             | `200 { user }`                                           |

### Dashboard

| Method | Path               | Who | Success                                                                                          |
| ------ | ------------------ | --- | ------------------------------------------------------------------------------------------------ |
| GET    | `/dashboard/stats` | any | admin: `{ totals, byUser, recentIssues }`; user: `{ totals, recentIssues }` for their own issues |

`totals` is `{ total, open, inProgress, closed, unassigned }` (`unassigned` for the admin only). `byUser` lists the 5 users with the most unfinished issues.

### Error codes

| HTTP | Code                                                                                                                                                 | Meaning                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`, `INVALID_JSON`, `BAD_REQUEST`, `ASSIGNEE_NOT_FOUND`                                                                              | the request is invalid                                 |
| 401  | `TOKEN_EXPIRED`                                                                                                                                      | access token expired: call `/auth/refresh`, then retry |
| 401  | `INVALID_TOKEN`, `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `NO_REFRESH_TOKEN`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED` | not authenticated                                      |
| 403  | `FORBIDDEN`, `NOT_ADMIN`                                                                                                                             | not allowed for this role                              |
| 404  | `ISSUE_NOT_FOUND`, `USER_NOT_FOUND`, `NOT_FOUND`                                                                                                     | missing, or not visible to the caller                  |
| 409  | `EMAIL_TAKEN`                                                                                                                                        | an account with this email exists                      |
| 429  | `TOO_MANY_REQUESTS`                                                                                                                                  | login or register rate limit                           |
| 500  | `INTERNAL_ERROR`                                                                                                                                     | unexpected error (details are logged, not sent)        |

### Example

```bash
# log in
curl -i -X POST https://issue-tracker-frontend.up.railway.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@gmail.com","password":"admin@123"}'

# use the accessToken from the response
curl https://issue-tracker-frontend.up.railway.app/api/issues?page=1 \
  -H 'Authorization: Bearer <accessToken>'
```

## Security notes

- Passwords: bcrypt. `password_hash` is never selected into API responses.
- JWT algorithm pinned to HS256; access tokens are short-lived; refresh tokens are random, stored only as SHA-256 hashes, rotated on use, with theft detection.
- Parameterized SQL everywhere (`$1, $2`); LIKE wildcards in search input are escaped.
- zod validates every body, parameter and query; request bodies are limited to 100 kb.
- helmet security headers; a generic "Invalid email or password" message for both unknown email and wrong password.
- Rate limiting on login and register. The limiter is in memory, so it resets on restart and is per instance.
- `trust proxy` is set to 2 (Railway edge, then nginx), so the limiter sees the real client IP.

## Deployment

Deployed on Railway with PostgreSQL and the frontend. The full steps (services, variables, pre-deploy command, updating and rolling back) are in the Deployment section of the [BRD](https://github.com/NithishKoriyar/issue-tracker-frontend/blob/main/BRD.md). In short:

1. Add a PostgreSQL service, then a service from this repo.
2. Set the variables above (`DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_ACCESS_SECRET`, `NODE_ENV=production`, `PORT=5000`, `ADMIN_*`).
3. Pre-deploy Command: `npm run db:migrate && npm run db:seed`. Start command: `npm start`.
4. No public domain is needed; the frontend service reaches it at `http://<service-name>.railway.internal:5000`.
5. Every push to `main` redeploys.
