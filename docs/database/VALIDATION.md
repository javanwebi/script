> Historical prototype notes. The actual owner-supplied schema now uses `user_profiles` / `catalog_*`. Read [ADOPTED_SCHEMA.md](ADOPTED_SCHEMA.md) first; do not run the legacy importer against the populated managed project.

# Development evidence — 2026-10-19 UTC

- `npm run lint`: passed.
- `npm run test:database`: 3 passed; actual PostgreSQL via isolated PGlite instances. Covers migrations, FK-backed catalogue, private credentials, public grants/RLS, own-profile isolation, append-only source history, optimistic revision protection, server-priced checkout, own-address validation, unknown/insufficient inventory rejection and checkout idempotency.
- `npm run test:portal`: 26 passed; existing authentication, OTP, CRM authorization, onboarding, content and campaign regressions.
- `npm run build`: passed; existing large-bundle/dynamic-import warnings remain.
- Source import into `.data/development-postgres-v3`: 1,230 families, 10,438 retained variants (10,435 active original SKUs and 3 inactive legacy demo variants), 15 JSON source files, 29 source/history archives, zero live users because no production export was provided.
- Same import repeated: `alreadyImported: true`, unchanged counts. Manifest SHA256: `8c4d6baf52f5874df84adcdba82ec87f5c28e94db5fa62bac1dd73595edba07c`.
- Connected managed Supabase `sanatpish`: public schema inspected read-only and empty. No production migration/import, secret change or deployment switch performed.
- Docker/full Supabase stack was unavailable. Supabase Auth/SMS/Storage, network PostgreSQL, storage URL rewriting, live-volume reconciliation and finance/agency adapters are **not** end-to-end verified. See deployment release gates; this branch must remain a draft.
