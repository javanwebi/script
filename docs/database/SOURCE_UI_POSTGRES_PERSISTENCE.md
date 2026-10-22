# Sanat Pish: Source-driven UI + online PostgreSQL persistence

## Architectural boundary

- **React/Vite front end is a build artifact from this GitHub source**, not HTML/JS supplied by the database. Components, layout, text defaults, theme assets and static images live in `src/` and `public/`; deploy with `npm run build` and serve `dist/`.
- **Mutable business records** (accounts, addresses, RFQs, orders, line items, customer messages, admin records, pricing, inventory and catalog overrides) are written through authenticated Express endpoints to the existing **online Supabase PostgreSQL** database. Static source files are not a persistence destination.
- **Catalog displays** may use source data for the public initial UI, but authenticated prices, real stock, cart checkout, account-specific access and persisted overrides must be read from the database on the server. Never trust a browser price or privilege.
- `src/services/durableStorage.ts` is an in-memory browser view while `DATA_BACKEND=postgres`. It does not constitute persistent browser storage. The server rejects unauthorized writes.
- **Secrets remain server-side**, including database password / `DATABASE_URL`, Supabase server-only keys, session secret and AI/Worker credentials. The Supabase publishable key is public by design, but never publish a service-role/secret key. No secrets in `VITE_*`, `src/`, or checked-in source.

## Production variables (server environment, not committed)

```dotenv
NODE_ENV=production
DATA_BACKEND=postgres
DATABASE_SCHEMA=adopted
DATABASE_ENV=production
DATABASE_URL=postgresql://<USER>:<PASSWORD>@<SESSION_POOLER_HOST>:5432/postgres
DATABASE_SSL=require
SUPABASE_URL=https://spkszfbeeufdcpcltqal.supabase.co
SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
PORTAL_SESSION_SECRET=<RANDOM_SERVER_ONLY_VALUE>
# AI / worker credentials also live only on the server:
GEMINI_API_KEY=<SECRET>
ATLAS_AI_WORKER_URL=<WORKER_URL>
```

The `DATABASE_SCHEMA=adopted` setting is the app's schema *mode*; physical catalog tables currently live in PostgreSQL schema `public`. Do not change this variable to `public` without changing the app's database mapping.

## Safe rollout checklist

1. Audit `sanatpishatlas` and record the table/schema versions, backup and recovery test before applying any migration. This change does **not** run Production DDL.
2. Run `npm run test:database`, `npm run test:portal`, `npm run lint`, and `npm run build` on a checkout of this branch.
3. Supply PostgreSQL credentials securely through the server's environment (never in Git).
4. Configure the Express process and reverse proxy to serve one origin for static site and `/api/*`; use HTTPS and secure cookies.
5. Confirm `GET /api/health` reports `database: ok` (not `development-only`) and exercise user creation/login, profile/address save, RFQ creation, admin updates, cart and checkout on a staging database.
6. Reload from another browser/session and confirm saved data appears from PostgreSQL; verify that unauthorized users cannot read/write another account's records.
7. After an approved backup and successful staging restore/migration tests, separately approve any Production migration.

Production deliberately refuses to start if PostgreSQL is not configured, rather than silently saving transactional data to local files. This change does not assert that all application workflows have been integration-tested or that a production DB migration has run.
