-- Issue Tracker schema. Idempotent: safe to run on every deploy (npm run db:migrate).

-- People who can log in. Registration always creates role 'user';
-- the admin account is created by the seed script.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(254) NOT NULL UNIQUE,      -- stored lower-case
  password_hash TEXT         NOT NULL,             -- bcrypt, never returned by the API
  role          VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Issues are created / edited / assigned by the admin.
CREATE TABLE IF NOT EXISTS issues (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  status      VARCHAR(20)  NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'in_progress', 'closed')),
  created_by  INTEGER      NOT NULL REFERENCES users (id),
  assigned_to INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues (assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_status      ON issues (status);

-- Comments disappear with their issue.
CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  issue_id   INTEGER     NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users (id),
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments (issue_id);

-- Refresh tokens: only a SHA-256 hash is stored, never the token itself.
-- A row is "used up" (revoked_at set) when it's rotated or on logout.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash CHAR(64)    NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
