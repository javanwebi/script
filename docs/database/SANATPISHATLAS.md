# sanatpishatlas — migration and connection status

Target: `spkszfbeeufdcpcltqal` (managed Supabase, eu-west-3). Source `zuloxkilvdilrercwifa` was read only throughout this transfer.

## Completed

- Initial owner-supplied schema plus additive security/financial/storage migrations: 63 public tables.
- All 28,958 original records across 49 source tables copied without changing original identifiers, values, currencies or timestamps.
- Each table's count and ordered digest of every original column matched the source. Evidence: `sanatpishatlas-transfer.json`.
- Versioned runtime bridge applied after isolated PostgreSQL tests. Original data remains intact; private document revisions/history support the existing UI contract.
- Backend adapter selected with `DATABASE_SCHEMA=adopted`; it uses `catalog_*`, `variant_commercial_specs`, `user_profiles`, `portal_kv_store` and private scoped documents. Historical prototype migrations/importer remain blocked on this schema.
- Supabase-generated public schema TypeScript definitions are in `src/types/database.generated.ts`.
- Catalogue reads preserve exact SKUs. Metadata edits never reset existing stock, reservations, prices or currency. New commercial rows default to inquiry-only until real stock and prices are entered.
- Checkout resolves the verified Auth identity, checks address ownership, obtains the server price, reserves stock transactionally and rejects conflicting retries. Payment is not confirmed by browser input.
- The UI displays toman; the adapter converts declared IRR amounts for display without rewriting stored source amounts. New checkout orders explicitly use IRT. Verify the source's declared IRR currency against accounting before live sales.
- Actual target SQL read/write/rollback and anonymous-access checks passed. The temporary probe left no record.

## Deployment gates

`DATA_BACKEND=postgres` and `DATABASE_SCHEMA=adopted` belong on the isolated preview first. Database credentials and session secrets are server-only variables, never `VITE_*` variables or repository files. Use a verified TLS connection; direct managed Supabase connections require an IPv6-capable runtime, or use the exact dashboard session-pooler address on IPv4.

The existing Railway production service still uses its `/data` volume. Do not switch it until its live portal/override files and any browser-only customer data have been exported and reconciled. The source Supabase Auth and Storage catalogues were empty; this does not prove the Railway volume is empty. Static image URLs and image metadata have been retained; this transfer does not move Git/Railway file bytes into Storage.

Auth SQL fixtures test permissions and verified identity matching, not real SMS delivery. Configure a real Supabase Auth phone provider and verify delivery before `SUPABASE_SMS_READY=true`. Provision the real owner through Supabase Auth before assigning `super_admin`; no demo administrator or parallel password identity is created. Gateway provider confirmation and notification delivery require real integrations and must not be reported as verified by these tests.

Some legacy UI documents remain PostgreSQL JSON documents with typed projections. Fields not represented by a typed table are retained in the document/history; new backend features must explicitly extend the schema and mappings rather than silently discarding them. Root prototype importer is not an adopted-schema live-volume importer.

## Checks

`npm run lint`, `npm run test:database` (12 tests), `npm run test:portal` (26 tests), `npm run build`.

PGlite substitutes the vector type/index/RPC and minimal Auth/Storage catalogues. These checks do not claim a real browser Auth session, SMS provider, payment gateway or vector-search integration has passed. Record the separate hosted smoke-test result after deployment.
