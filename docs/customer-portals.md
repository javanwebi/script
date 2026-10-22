# Customer portals: deployment and verification

The portal API is `api/portal.ts`, mounted in Express for development and deployed as a Vercel function. The previous `/api/auth` implementation is retired: it accepted arbitrary OTPs, public default passwords, and exposed users/SMS logs. Portal sessions use signed HttpOnly cookies. Client storage is only a scoped rendering cache.

## Required server environment

- `PORTAL_SESSION_SECRET`: random secret, at least 32 characters. No `VITE_` prefix.
- `PORTAL_ADMIN_USERNAME`: administrator username (defaults to `admin`).
- `PORTAL_ADMIN_PASSWORD`: strong private password, at least 12 characters. There are no built-in admin credentials.
- On Vercel: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or equivalent `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Use a separate preview database. Missing storage returns 503; it does not silently create browser-only accounts.
- Optional `PORTAL_REDIS_KEY` isolates separate environments in one database (default `sanatpish:portal:v1`).
- On a persistent Node server, `PORTAL_DATA_PATH` defaults to `.data/portal.json`. This directory must be backed up. Never use filesystem persistence in Vercel Functions.

Production variables could not be inspected in this session: the Vercel connection returned 403 for the `asliatlas` project in its team scope. Configure/verify these variables before merging or deploying. Automatic Vercel deployments are disabled specifically for `fix/customer-portals-content-access`; production behavior for other branches is unchanged.

## Access and data

- Public registration always creates `retail`, with `approvedB2B: false`. The only customer panel is `/consumer-dashboard`.
- Admin CRM creates/updates identities. Only `approvedB2B: true` grants `/account`. Role, legacy flag, business type or price code alone cannot grant that portal.
- Customer edits cannot change roles, purchase totals, credit or club level. The API reads authorization from its database on every request, so revocation takes effect without waiting for cookie expiry.
- Individual content and configuration are keyed by both portal and customer ID. Rewards use exact customer IDs, never name substrings. Downloads contain the customer's own assigned list and use the public name “لیست قیمت من”.
- Admin writes use a database revision and Redis atomic compare-and-set to reject stale overwrites. Save errors are shown explicitly; a failed CRM save does not claim the account is ready.
- The first successful server hydration preserves previous browser portal caches in `atlas_portal_local_backup_v1`. Legacy browser-only customers/content are NOT automatically trusted or uploaded. An administrator must review and migrate any real legacy records before rollout. Existing catalog/product data and images are untouched.

## Content studio

`/admin/content` manages banners and announcements for either everyone in a portal or one selected customer; menu labels/order/visibility; action permissions; metric cards; header/title/button copy; additional searchable copy slots; and the high-volume club's purchase thresholds, rewards and events. Individual configurations override collective configuration. Disabled menus cannot be opened by dashboard shortcuts or campaign buttons. Club levels are derived from recorded purchase volume; users cannot select levels.

Campaign cart discounts apply at the configured basket threshold; the highest eligible campaign is used, without adding campaigns together. Existing club-price discounts are already reflected in the assigned price list, so no additional hardcoded silver/gold discount is stacked. Campaign math is reflected in the existing cart; the legacy checkout remains client-side and is not a new server-validated payment/order system.

SMS delivery is not implemented by this change: phone-only and unverified OTP login are disabled. Password login works with the credentials created by registration/CRM. Registration reports `smsSent: false` truthfully. Historical orders/addresses are not invented: each dashboard shows the current customer's recorded orders/addresses, or an empty state.

## Checks

```sh
npm ci
npm run lint
npm run test:portal
npm run build
npm run dev
```

The automated suite exercises guest denial, forged sessions, role escalation, missing passwords and OTP bypass, CRM creation/login, cross-customer/portal targeting, assigned price-list isolation, reward isolation, deletion of all banners, stale revisions, persisted password hashes, role revocation, serverless storage failure, individual overrides and campaign thresholds.

Browser acceptance: administrator creates a CRM account and publishes a banner; a separate ordinary user sees only their portal and targeted content; a separate CRM user enters `/account`; direct access to the other portal redirects; changed content survives reload; disabled menus and downloads stay unavailable; inspect both 1440px and 390px layouts. Brand section is restored byte-for-byte from commit `50be2ee`; footer categories are limited to four primary items.

## Railway production

The `asliatlas` Railway project runs the full Express process (including WebSocket `/api/live`), not a static-only Vite server. `railway.json` declares the Docker build, start command and health check. The Dockerfile installs from package-lock.json once, builds assets, then removes development-only packages. Node 24 and a single replica are used. The `/data` persistent volume holds `PORTAL_DATA_PATH=/data/portal.json`, `IMAGE_AI_DIR=/data/imageai`, and `CATALOG_OVERRIDES_DB_PATH=/data/catalogOverridesDb.json`. The session secret and administrator password are generated independently and stored as Railway service variables, never committed. Catalog write endpoints also require the administrator's signed portal session.

The public site is `https://sanatpish-production.up.railway.app`; admin login is `/admin`. Retrieve `PORTAL_ADMIN_PASSWORD` from the service Variables in Railway. AI model API keys, Worker tokens and a real SMS provider have not been supplied; these remain separate integrations and are not fabricated by deployment.

### Minimal customer portals and dedicated mobile layout

Both customer portals now share `PortalShell` (white/orange industrial palette,
subtle glass surfaces, company heading and surname in the upper left). Desktop
uses a sidebar; mobile uses the first three enabled menus and an accessible
native dialog for all remaining sections. Menu order in Content Studio controls
both layouts. Mobile tables display the same records as labelled cards, without
requiring horizontal page scrolling. Reduced-motion preferences are respected;
blur is limited to navigation surfaces.

Content Studio → each portal → Layout controls glass/solid surfaces and spacing,
with collective defaults and individual overrides. Titles, buttons, banners,
announcements, menu labels/order, permissions and KPI visibility remain editable.
Customer identity and purchase totals remain account data controlled by the server.

Both portals have a customer club. Milestones are independently stored under
`consumer` and `high_volume` in the existing club key; old array data migrates to
the high-volume club without overwriting it. Consumer defaults have no promised
financial discount or rewards: publish these explicitly in Content Studio →
Customer portal → Club. Levels are derived from recorded purchases, never chosen
by customers. Customer club membership does not assign wholesale pricing or CRM
access. Legacy reward assignments remain scoped to high-volume customers.
