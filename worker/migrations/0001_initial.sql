CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    step1 INTEGER NOT NULL DEFAULT 0,
    step2 INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_ip
ON sessions(ip_hash);

CREATE TABLE IF NOT EXISTS keys (
    key TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    executed INTEGER NOT NULL DEFAULT 0,
    last_execution INTEGER
);

CREATE INDEX IF NOT EXISTS idx_keys_username
ON keys(username);
