-- This migration version is recorded in the production Supabase migration ledger.
-- The corresponding data split is intentionally kept under ops/sql because it requires
-- the adopted catalogue seed, private pre-change snapshots and guarded owner-reviewed execution.
-- Generic schema migrations, PGlite fixtures and fresh databases must not run that production data mutation.
SELECT 1;
