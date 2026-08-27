-- Ensure keys.plan exists (used by admin + paid Stripe keys)
-- If column already exists this migration will fail — skip if so.
ALTER TABLE keys ADD COLUMN plan TEXT;
