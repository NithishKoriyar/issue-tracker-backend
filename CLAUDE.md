# CLAUDE.md — issue-tracker-backend

Project-level notes for the Issue Tracker API. Stack: Node 22+ with Express 5 (JavaScript, ES modules), PostgreSQL through `pg` with raw SQL, and JWT auth with refresh tokens.

## Layout

```
server.js                       entry point: app.listen(process.env.PORT || 5000), listens on ::
src/
  app.js                        helmet, morgan, json, cookie-parser, /api router, 404 + error handlers (no CORS on purpose)
  config/      db.js            pg Pool + query(text, params). Env vars: read process.env directly
  routes/      index.js         mounts every router under /api
               auth.routes.js       /api/auth/*  (register, login, refresh, logout, me)
               issue.routes.js      /api/issues  (+ /:id/status, /:id/comments). requireAuth on all; requireAdmin on create/edit/delete
               user.routes.js       /api/users (?search=&role=&page=&pageSize=) → { users, pagination } + /api/users/:id   (admin)
               dashboard.routes.js  /api/dashboard/stats
  controllers/ auth · issue · comment · user · dashboard .controller.js   req/res only (auth owns the refreshToken cookie)
  services/    auth.service.js      register / login (+asAdmin) / refresh rotation + reuse detection / logout / me
               token.service.js     JWT sign/verify (HS256 pinned), random refresh token, SHA-256 hash, expiry
               issue.service.js     getIssue() = THE access rule (admin or assignee, else 404); list scoped by role
               comment.service.js   reuses getIssue() for access
               user.service.js / dashboard.service.js   users with counts (+ optional search: name/email ILIKE, wildcards escaped) / stats scoped by role
  models/      user.model.js        users SQL (PUBLIC_COLUMNS never include password_hash), listWithIssueCounts, countUsers, listBusiestUsers (dashboard top 5)
               refreshToken.model.js  refresh_tokens SQL (consume = atomic rotate)
               issue.model.js       ISSUE_SELECT (json_build_object assignee/createdBy + commentCount), buildWhere() shared by list (LIMIT/OFFSET, stable ORDER BY updated_at, id) + countMatching() so a page and its total agree; dynamic SET from fixed strings; counts()
               comment.model.js     comments with author
  validators/  auth.validator.js    registerSchema, loginSchema (zod; email trimmed + lower-cased)
               issue.validator.js   issueIdParams, listIssuesQuery (+page, pageSize), create/update/status, createCommentSchema
               user.validator.js    listUsersQuery (search ≤100, role, page, pageSize 1–50), userIdParams
  middlewares/ error.middleware.js     notFoundHandler, errorHandler → { error: { code, message, details? } }
               auth.middleware.js      requireAuth (TOKEN_EXPIRED / INVALID_TOKEN / UNAUTHORIZED), requireAdmin
               validate.middleware.js  validate({ body, params, query }): body → req.body, params → req.validatedParams, query → req.validatedQuery
               rateLimit.middleware.js authLimiter: 10 / 15 min per IP + email
  utils/       apiError.js      ApiError + badRequest / unauthorized / forbidden / notFound / conflict
  db/          schema.sql       users, issues, comments, refresh_tokens (idempotent)
               migrate.js       runs schema.sql
               seed.js          admin from env; demo data only when there are no issues
tests/                          optional, only if time allows
```

**Request flow:** route → rate limit → validate → auth → controller → service → model → PostgreSQL.
An error thrown anywhere goes to `errorHandler`.

## Commands

- `npm run dev`: `node --watch server.js` with `.env` (if present), on :5000
- `npm start`: production start (Railway provides the env vars)
- `npm run db:migrate`: apply `schema.sql` (safe to repeat)
- `npm run db:seed`: admin + demo data (safe to repeat; demo data only into an empty DB, so deleted demo issues never return). Railway runs it before every deploy
- `npm run db:seed:demo`: local helper, adds any missing demo user (by email) / demo issue (by title); idempotent
- `npm run format` / `npm run check`: Prettier (same style as the frontend)

## Auth rules (keep in sync with the frontend)

- `POST /auth/login|register` → `{ accessToken, user }` + `refreshToken` cookie (`httpOnly`, `sameSite=strict`, `path=/api/auth`, `secure` in prod).
- `POST /auth/refresh` uses up the cookie's token (atomic `UPDATE … WHERE revoked_at IS NULL`) and issues a new one.
  - A revoked token reused **after 30 s** → `revokeAllForUser` (theft).
  - Within 30 s → plain 401, which covers the multi-tab race.
- `asAdmin: true` + non-admin → `403 NOT_ADMIN`, checked **after** the password and **before** any session is created.
- An expired access token must return code **`TOKEN_EXPIRED`**: the frontend refreshes on exactly that code.
- Demo accounts (seed): 20 users `<firstname>@example.com` (asha, vikram, priya, …) / `User@12345`. Admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` = `admin@gmail.com` / `admin@123`. The seed never changes an existing account, so changing these later needs an UPDATE on the users row (or a fresh DB).

## Gotchas

- **Express 5**: errors thrown in async handlers (and sync middleware) reach `errorHandler` automatically, so no asyncHandler wrapper is needed. `req.query` is read-only → `validate` puts parsed query values in `req.validatedQuery`.
- **zod 4**: `z.email()`, `{ error: '…' }` for messages. `errorHandler` sends the first issue as `message` and all of them as `details`.
- **pg** returns `COUNT(*)` and `BIGINT` as strings, so cast with `::int` in SQL. `TIMESTAMPTZ` comes back as JS `Date`.
- API JSON is **camelCase**: alias the columns in models (`created_at AS "createdAt"`).
- `trust proxy` is **2** (Railway edge → nginx → API), so `req.ip` is the real client IP for the rate limiter.
- The rate limiter is in memory: it resets on restart and isn't shared between instances (fine for one Railway instance).
- **Always start through npm scripts** (`npm run dev`, `npm start`, `npm run db:*`): they load `.env` with `--env-file-if-exists`. A bare `node server.js` or `nodemon server.js` doesn't read `.env`, so every DB call fails with `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`. For nodemon, use `nodemon --exec "node --env-file-if-exists=.env" server.js`.
