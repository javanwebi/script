# CRM with real PostgreSQL data

## Sources of truth

The new admin CRM module is `src/admin/modules/RealCustomersCrmModule.tsx`, mounted from `src/admin/AdminLayout.tsx`. All customer records are read through `server/db/adminCustomersApi.ts`. It does **not** read old browser customer caches or populate default sample customers.

- `public.user_profiles`: verified user accounts; customers not linked to an existing CRM row are shown as their own record.
- `public.crm_customers`: existing wholesale/customer records and manually created CRM contacts. A contact without `auth_user_id` is **not** an authenticated account.
- `public.orders`: accepted, non-failed/non-refunded transactions only. Totals are derived from actual orders, with IRR amounts divided by ten for toman display. Existing manually stored `total_spent` fields are never used for the new CRM dashboard.
- `public.financial_entries`, `public.support_tickets`: actual customer ledger events and support tickets. Zero results produce honest empty states.
- `public.audit_logs`: append-only records of CRM creation, profile updates, B2B approval changes and support replies.

## Access and security

All routes are server-side and require the authenticated portal session and the corresponding staff `crm` permission. Wholesale approval additionally requires management or `customer_grading.edit`. The backend checks the request Origin on writes, uses SQL parameters and performs mutations in transactions. Customer passwords and OTPs are not displayed or generated.

A new customer entered by an administrator is inserted only as a CRM contact. If that phone is already registered or linked, the API rejects a duplicate and directs the administrator to the existing profile. Login is enabled only through the existing verified registration process. Changing `approved_b2b` preserves the customer's account, orders and financial entries; it must not grant unlimited credit.

Do not store fake opening balances or import a manual purchase amount into order totals. If historical purchases are to be migrated later, import authoritative, reconciled source documents instead.

## Endpoints

- `GET /api/admin/crm/customers?kind=retail|high_volume&page=1&q=...`: server-side filtered pagination, exact stored counts.
- `GET /api/admin/crm/customers/:key`: joined customer details plus last 30 real orders, 40 ledger events, 30 tickets.
- `POST /api/admin/crm/customers`: create a contact (no Auth account, no password).
- `PATCH /api/admin/crm/customers/:key`: edit non-financial profile fields and staff-only notes.
- `POST /api/admin/crm/customers/:key/approval`: approve/revoke wholesale portal access.
- `GET /api/admin/crm/tickets` and `POST /api/admin/crm/tickets/:id/reply`: real support inbox and replies.
- `GET /api/admin/crm/commercial-options`: real active price lists and customer grade definitions.
- `PATCH /api/admin/crm/customers/:key/commercial`: manager-authorized, validated grade/price-list/credit limit update (never modifies spend or debt).
- `GET /api/admin/crm/export?kind=retail|high_volume`: UTF-8 CSV of real matching customer records and derived purchase totals.

No reset/drop/truncate operations are included. The existing CRM frontend component remains in the repository for safe rollback.

## Deployment gate

1. Back up the active VPS PostgreSQL volume before any deployment.
2. Verify that the active `DATA_BACKEND=postgres`, `DATABASE_SCHEMA=adopted` and `DATABASE_URL` point to the correct production instance, not an unrelated cloud project. Do not infer the VPS database from the Supabase dashboard project name.
3. Run `npm ci && npm run lint && npm run test:portal && npm run build` on the target branch.
4. Test an admin with a registered retail account and an existing B2B account. Check create-contact, duplicate phone rejection, notes, B2B approval, commercial terms, financial values, CSV export and ticket replies.
5. Deploy using the project's existing safe blue/green flow, verify `/api/health` and the CRM route under an authenticated administrator. Do not run schema resets or auto-recreate accounts.

Features such as employee follow-up schedules, contracts, recurring purchase commitments, and credit decisions require a separate modeled data layer and were not silently simulated by this migration.
