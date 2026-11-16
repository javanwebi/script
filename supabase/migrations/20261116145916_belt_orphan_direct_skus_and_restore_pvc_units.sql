-- This migration version is recorded in the production Supabase migration ledger.
-- The corresponding production data operation is intentionally kept under ops/sql because
-- it requires the adopted catalog seed, its source backup, and guarded owner-reviewed execution.
-- Generic schema migrations, PGlite fixtures, and fresh databases must not attempt that data mutation.
SELECT 1;
