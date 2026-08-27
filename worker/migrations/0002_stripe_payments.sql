-- Stripe one-time payments tracking
-- npx wrangler d1 migrations apply DB_NAME --remote
-- (from worker/: use database name from wrangler.jsonc)

CREATE TABLE IF NOT EXISTS stripe_payments (
    session_id TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    stripe_payment_intent_id TEXT,
    key TEXT,
    plan TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_key
ON stripe_payments(key);

CREATE INDEX IF NOT EXISTS idx_stripe_payments_username
ON stripe_payments(username);
