-- sessions
CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  step1 INTEGER NOT NULL DEFAULT 0,
  step2 INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- keys
CREATE TABLE keys (
  key TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  executed INTEGER NOT NULL DEFAULT 0,
  last_execution INTEGER
);

-- optional: one-time work.ink tokens
CREATE TABLE used_tokens (
  token TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);
