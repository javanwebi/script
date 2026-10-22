> Historical prototype notes. The actual owner-supplied schema now uses `user_profiles` / `catalog_*`. Read [ADOPTED_SCHEMA.md](ADOPTED_SCHEMA.md) first; do not run the legacy importer against the populated managed project.

# PostgreSQL / Supabase migration — review before cutover

This branch is a development migration foundation, **not a completed production cutover**. `DATA_BACKEND` remains unset on the live deployment. It retains the old backend until an approved rollout. In PostgreSQL mode there is no business-data fallback to local files or browser storage.

## Inventory and verified source import

- 1,230 catalogue families; 10,435 active original inventory codes.
- Three existing demo variants (`34265-Z18`, `34265-Z22`, `34265-Z28`) are retained inactive for traceability. No new SKU was invented.
- Fifteen tracked JSON sources are archived losslessly with SHA256, including product overrides, catalogue images, photo mappings, research and derived indexes.
- No tracked `data.json` was present in this checkout. An untracked or production-volume copy must be supplied as a reviewed source, never assumed absent from production.
- Existing React/TS defaults for brands, categories, clients/logos, portal layouts, announcements, banners, club levels, SMS templates and settings are imported, preserving the current design.
- Users, addresses and portal records import from an explicit `IMPORT_PORTAL_PATH`. Local checkout contains no live user export; development import therefore has **zero live users**.
- Production `.data/portal.json`, catalogue overrides, uploaded assets and each user's browser-only legacy records are outside the repository. They have **not** been migrated remotely. Export/reconcile them before enabling the new backend.

## Data architecture

Normalized product families, variants, images, specifications, SKU prices, inventory, profiles, organizations, addresses and order lines coexist with typed domain collections (orders, CRM, content, rewards, invoices, etc.). Legacy JSON payloads preserve unknown fields. Domain namespaces, ownership and optimistic versions are explicit. Source archives and legacy credentials are private. Generic collection writes require administrator authorization; customers can only update whitelisted own-scope state. Prices, credentials and internal customer segmentation are not exposed through public database grants.

The BFF owns business authorization; public browser database writes are denied. Every exposed table has RLS. Use a dedicated server database connection with required grants; the publishable key does not bypass policies. Never expose DATABASE_URL or service-role keys via `VITE_*`.

## Development

1. `npm ci`; copy `.env.database.example` to ignored `.env` and fill development credentials.
2. For a complete local Supabase stack, install Docker and run the pinned CLI `npx supabase start`. Inspect `npx supabase status` locally; never post its secret output.
3. `npm run db:plan` → review → `npm run db:migrate` → `npm run db:import`.
4. Run `npm run lint`, `npm run test:database`, `npm run test:portal`, `npm run build`.
5. Run the app with development Auth, SMS and Storage configured. Verify retail/CRM/admin isolation, sign-up SMS, login, logout, profile updates, content edits, product editing, order review and failure states end-to-end.

Without Docker, `DEV_DATABASE_PATH=.data/development-postgres-v3 npm run db:dev` validates real PostgreSQL SQL/RLS/imports through PGlite. Auth roles/functions are test fixtures only; this does **not** run Supabase Auth, Storage, PostgREST or a network PostgreSQL server. Full-stack integration is still a release gate. Re-running the same manifest is idempotent; a different seed cannot overwrite a populated catalogue.

## Self-hosting

Connected project `sanatpish` (`zuloxkilvdilrercwifa`) is managed Supabase. It is not a self-hosted server. No dedicated server address/access/domain was available in this session.

`deploy/supabase/prepare.sh /absolute/new-directory` downloads the **official** pinned Docker stack. It does not launch or alter infrastructure. Follow [Supabase Docker self-hosting](https://supabase.com/docs/guides/self-hosting/docker), replace all example secrets, configure HTTPS/reverse proxy, firewall internal ports, persistent volumes, encrypted off-server backups, monitoring, Auth site/redirect URLs and the SMS provider. The application only requires PostgreSQL, Supabase Auth and Storage URLs/keys, so the same code supports managed or self-hosted installations.

Do not place the complete Supabase stack into the existing 500MB application volume. Size database/storage capacity from actual files, index size and backup retention.

## Authentication

Auth uses Supabase phone/password and phone OTP. Phone verification must be enabled. Configure a supported SMS provider or a reviewed Send SMS Hook for Kavenegar; the old application Kavenegar environment variables alone do not configure GoTrue.

Legacy scrypt password hashes remain private and cannot be converted to Supabase password hashes. `npm run db:auth:dev` provisions development identities without copying plaintext passwords or marking phone numbers confirmed. Existing users need OTP verification/password reset. Production identity reconciliation and administrator provisioning require a reviewed list and verified ownership; never derive admin/wholesale access from user metadata. New signup defaults to retail.

## Files and browser-only records

Build assets remain repository assets. AI feature vectors, thumbnails and temporary uploads are rebuildable/temporary and may remain ephemeral with retention. Persistent catalogue uploads and private receipts/documents must be copied to Storage before cutover. `server/db/storage.ts` prepares public `catalogue` and private `customer-documents` buckets without changing existing bucket visibility. `scripts/database/storage.ts` copies an explicit SHA256 manifest in development, verifies downloaded bytes and refuses collisions. Ownership-authorized signed URL routes and production asset URL reconciliation are still required before enabling persistent document uploads.

No customer browser can be read remotely from this workspace. Export whitelisted legacy state, archive it via `IMPORT_BROWSER_EXPORT_PATH`, then reconcile authenticated ownership. Imported browser orders, payments, grades and credits must not be trusted as authoritative. Never upload saved passwords, cookies or session credentials.

## Financial release gates

PostgreSQL checkout creates an idempotent **pending** order with database SKU prices, quantities and an owned address. Client-supplied prices or a simulated bank callback cannot confirm payment. There is no fabricated SMS delivery, loyalty award or stock deduction. Current implementation quotes retail base prices and requires review; wholesale pricing, campaign/club settlement, credit checks, real gateway verification, receipt upload and fulfilment/reservations require dedicated transactional adapters before production commerce cutover. This is an explicit release blocker, not a complete payment integration.

Metadata edits preserve existing normalized stock; stock/price adjustment endpoints must be reviewed and tested before enabling inventory administration. Generic customer agency/payment operations currently fail closed rather than accepting forged financial state. Complete their authorized transactional APIs before rollout.

## Production gate and preservation

1. Freeze writes briefly and obtain the actual live volume/browser exports. Record hashes and counts. Retain original files unchanged.
2. Back up PostgreSQL with `npm run db:backup -- /private/backups/sanatpish.dump`. A nonempty backup is insufficient: restore it to an isolated instance and verify records/roles. Also back up Supabase Auth and Storage objects/configuration; pg_dump does not contain object bytes.
3. Restore/import into isolated development, reconcile source counts, duplicate identifiers, image mappings, references and ownership. Run complete end-to-end tests above. Document outstanding discrepancies.
4. Generate exact production `npm run db:plan`; owner reviews SQL, target and SHA256, backup/restore evidence and cutover plan. **Explicit approval is required before any production migration or import**, including additive changes.
5. Only after approval set `DATABASE_ENV=production`, `PRODUCTION_MIGRATION_APPROVED=yes`, `REVIEWED_PLAN_SHA256`, `VERIFIED_BACKUP_PATH`, `VERIFIED_BACKUP_SHA256`. The CLI checks the gate and applied migration checksums. Never run migrations implicitly at app startup.
6. Apply reviewed migrations, generate a fresh import plan and run reviewed import, provision Auth identities, verify data/storage and enable `DATA_BACKEND=postgres` on the new deployment. Existing files stay preserved read-only.
7. Monitor errors, latency, sessions and data totals. Rollback is a coordinated application/data operation; do not switch to stale local storage after new writes. Never delete the new database to undo a deployment.

## Future feature checklist

Inspect schema → add versioned SQL only if needed → update API/types/validation/authorization → add behavior tests → test isolated PostgreSQL and full Supabase services → document deployment → backup/review/owner approval for production. See root `AGENTS.md`.
