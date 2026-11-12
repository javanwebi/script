# Sanat Pish development contract

- PostgreSQL / Supabase is the target source of truth. Support managed and self-hosted Supabase without platform-specific database dependencies.
- Inspect the real schema and data requirements before backend work. Add versioned SQL under `supabase/migrations` only when schema, relationships, indices or policies must change. Never rewrite an applied migration.
- Preserve existing information, unknown legacy fields and original identifiers. Never invent product codes or promote demo records to real stock.
- Do not delete tables/data without explicit owner approval. Test migrations on development PostgreSQL first. Production migration requires a reviewed plan, verified backup, restore check and explicit owner approval. Deploying code does not authorize production DDL.
- Coordinate schema, TypeScript contracts, validation, API authorization, tests and deployment notes in every backend feature.
- Check Supabase Auth capabilities before creating parallel authentication. Authorization comes from database roles, never user-editable metadata. Enable RLS on every exposed table. Service-role and database credentials belong on the server only.
- Browser state is a scoped memory view in PostgreSQL mode. Never fall back to local persistent storage or repository JSON on a database outage. Temporary input, AI caches and build assets are not authoritative business data.
- Run `npm run lint`, `npm run test:database`, `npm run test:portal` and `npm run build` when relevant. Full Auth/Storage integration also requires a real isolated Supabase stack; PGlite alone does not prove those integrations.
- Keep the production feature flag off until live-volume data, browser exports, Auth identities, storage objects and financial workflows have passed reconciliation. Preserve the current UI.

## Actual production schema (owner supplied 2026-10-20)

The connected managed project now uses `user_profiles`, `catalog_families`, `catalog_variants` and the owner's 49-table master schema. Original `supabase/migrations` and importer target a DIFFERENT prototype schema; never apply those to the adopted database or import repository seeds over existing catalogue rows. Compatible follow-up SQL is in `supabase/adopted/migrations`. Inspect actual migration history and schema before any change. Do not switch DATA_BACKEND on the live app until adapters target these actual tables.

## Non-destructive change policy (owner requirement, 2026-11-11)

- Default to additive, narrowly scoped changes. Add new capabilities and edit only the existing lines/components that must change; do not remove, replace wholesale, or silently simplify existing features.
- Before editing, inspect the current implementation, its callers, data contracts, route registrations, environment/configuration dependencies and tests. Preserve unrelated local and production changes.
- Do not delete or rename existing routes, API endpoints, database tables/columns/indexes/policies, customer/catalogue records, assets, environment variables, Nginx locations/guards, feature flags or user workflows unless the owner explicitly approves that exact removal.
- When a change needs a new contract, prefer a backward-compatible field, endpoint, adapter, migration or optional behavior. Keep old consumers working until an explicit, tested migration plan is approved.
- Database work must be additive and reversible where practical. Never rewrite an applied migration, drop or truncate production data, reset production state, or run destructive cleanup as part of a normal feature deployment. Production DDL still requires a reviewed plan, verified backup/restore path and explicit owner approval.
- Configuration changes must preserve existing security and routing behavior. For Nginx, retain TLS/SNI, API method delegation, SPA read-only guards, static asset routes and existing vhosts; validate the complete effective configuration with `nginx -t` and targeted semantic checks before reload.
- Deployments must use a verified backup and health-checked canary/blue-green promotion. On failure, restore the previous application and configuration without deleting data; do not bypass failed security assertions to force promotion.
- Before committing, inspect the full diff and confirm that every changed/deleted line is necessary for the requested behavior. Explain any unavoidable removal and obtain approval before making it.
- Add regression tests proving both the new behavior and preservation of existing routes, data contracts, permissions, UI flows and deployment protections. Do not claim production success until the live release SHA and health checks confirm it.

