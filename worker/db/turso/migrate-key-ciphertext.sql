-- Add AES-256-GCM ciphertext storage for agent keys so the dashboard can
-- reveal a key later (keys are re-viewable, not reveal-once).
-- The auth path (key_hash) is unchanged.
--
-- Idempotent at the app level: libsql tolerates re-running the ALTER and
-- surfaces "duplicate column name" as an error, which the migration runner
-- treats as acceptable; schema.sql below is the source of truth for fresh
-- installs, so this migration only needs to run once against existing DBs.
alter table agents add column key_ciphertext text;
