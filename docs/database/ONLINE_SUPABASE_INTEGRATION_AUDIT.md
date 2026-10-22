# Sanat Pish – online Supabase integration verification (22 Oct 2026)

Scope: source repository + Express + **online** Supabase project `spkszfbeeufdcpcltqal`. No VPS/Docker/deployment actions.

## Source-to-API-to-table contract

Source pages communicate via `src/services/*` and `/api/portal` plus `/api/runtime` (Express); no browser may directly use the database password or service-role key. In adopted PostgreSQL mode, `server/db/repository.ts` delegates document projections to `server/db/adopted.ts`; `app_private.document_versions` and scoped documents provide versioning. These API contracts are NOT by themselves proof of a completed database round-trip.

| UI/module | Primary source/service | API path | Adopted PostgreSQL objects / state | Verification |
| --- | --- | --- | --- | --- |
| Registration/login/profile | `AuthContext`, `authService` | `/api/portal`: register/login/profile/otp | `auth.users`, `public.user_profiles`, `app_private.auth_provisioning` | Real signed-in round-trip not tested; SMS absent |
| Consumer portal | `AuthContext`, `portalRepository` | `/api/portal`, `/api/runtime` | user profile, scoped documents, `orders` | Pending integration |
| B2B portal | `portalRepository`, CRM services | `/api/portal`, `/api/runtime` | profiles/CRM and price lists | Pending integration |
| Admin dashboard | `adminService` | `/api/portal` | orders, customers, inquiries; **sample financial charts** | Partial; not live financial metrics |
| CRM/customers | `CustomersCrmModule`, `adminService` | `/api/portal` save | `crm_customers`, `user_profiles`, document projections | Pending round-trip |
| Product families/SKUs/images | `ProductsModule`, `adminService` | `/api/runtime`, `/api/portal` | `catalog_families`, `catalog_variants`, `catalog_gallery_images`, commercial specs | Migration needed before asserting all writes |
| Categories/brands | `ProductsModule` | `/api/portal` | `catalog_categories`, `catalog_brands` | Pending round-trip |
| Price lists, tiers/rewards | `CustomerGradingModule` | `/api/portal` | `price_lists`, `club_milestones`, reward tables | Pending round-trip |
| Cart/favorites | `CartContext`, `WishlistContext` | `/api/runtime` | `app_private.scoped_documents` | Pending round-trip |
| Orders/shipping | `OrdersModule` | `/api/portal` and checkout API | `orders`, order items, shipment/status events | Pending payment/checkout round-trip |
| RFQs/invoices | `PricingInquiriesModule` | `/api/portal` | `price_inquiries`, `official_invoices` | Pending round-trip |
| Agency requests | `AgenciesAdminModule` | `/api/portal` | agency tables | Pending round-trip |
| Excel bulk imports | `BulkImportModule` | catalog mutation endpoints | catalog variants/commercial specs | Pending transaction/reload validation |
| Announcements | `AnnouncementsAdminModule` | `/api/portal` | `portal_announcements`, KV projections | Pending versioned migration |
| Customer portal content | `ContentStudioModule` | `/api/portal` | `portal_banners`, layout/scoped configuration | Pending round-trip |
| Customer logo strip | `ClientsAdminModule` | `/api/portal` | `client_logos` | Pending round-trip |
| Tickets/messages | CRM/services | `/api/portal` | `support_tickets`, `ticket_messages` | Pending round-trip |
| Admin settings/logs | `SettingsSystemModule` | `/api/portal` | settings, `audit_logs`, auth role tables | Verify role boundaries and audit logging |

**Important:** Some client modules still import `mockGenerator`, `mockData`, `catalogOverridesDb.json`, or static defaults. They may be legitimate public UI seeds but must not be treated as proof of committed data. Persisted business edits must come back from PostgreSQL after refresh.

## Read-only online verification performed

- PostgreSQL responded through the authorized Supabase connection.
- `catalog_families`: **1,383**; `catalog_variants`: **10,435** at last check. Preserve all existing identifiers and rows.
- `user_profiles`, `orders`, `price_inquiries`: **0** at last check; this does not establish deployed backend connectivity.
- Migration `20261022120000` not applied; **do not execute on production** without restore-tested backup, approved plan, idempotency checks, and isolated database tests.
- Security advisor surfaced RLS and function execute warnings that require targeted investigation; do not indiscriminately grant all roles broad access.

## OTP behavior

`dev_otp_request` and `dev_otp_verify` are permitted only when `NODE_ENV=development`, `DATABASE_ENV=development`, `DEV_OTP_PREVIEW=true`, and the request Host is loopback. Code appears in development phone form. It **never** creates an authenticated session, provisions a real Supabase user, or claims ownership of a phone number. Production SMS OTP still needs a trusted delivery provider; production may use a separately verified email-based flow when implemented. Do not connect development preview identities to the online Production project.

## Acceptance requirements per module

1. Check route permissions and schema/RLS; deny different-user access.
2. Run on disposable PostgreSQL test project with comparable schema and data.
3. Execute create/read/update/authorized disable or delete and a reload to confirm persistence.
4. Verify a failed operation returns a clear error and leaves data unchanged.
5. Include authenticated/anonymous and privileged/unprivileged cases.
6. Keep test evidence and rollback notes with a reviewed PR.

CI verifies code/tests/build, **not** the above 18 module online round-trips.
