# Registration and authoritative data sources — 2026-10-20

Target: `sanatpishatlas` (`spkszfbeeufdcpcltqal`), deployment repository `javanwebi/atlassanatpish1`.

## Registration contract

1. Business details are validated by `/api/portal` action `register`. If SMS is not configured, it fails with HTTP 503 before provisioning a draft.
2. A short-lived draft is stored in the existing private `auth_provisioning` table and bound to an HttpOnly browser cookie. Supabase Auth sends the phone OTP through its configured SMS provider. No password is accepted in this step.
3. `otp_verify` validates the OTP through Supabase Auth. The existing verified-identity trigger creates/links `public.user_profiles`. Only the matching, unexpired browser draft can populate that profile. Roles, approval, pricing access and finance remain server/database-owned.
4. The UI opens the username/password step. `registration_credentials` requires a verified Auth session, reserves a unique username in `user_profiles`, updates the password through Supabase Auth, then marks credential setup complete. Passwords are never stored in profile JSON, browser persistence or provisioning drafts.
5. Existing password login uses the database username to resolve the verified Auth phone. SMS login uses Supabase Auth. Onboarding follows successful credential setup.

No additional migration is necessary for these changes: `user_profiles.preferences`, `auth_provisioning` and the verified-identity trigger already exist. Do not create a second credentials table or rewrite an applied migration.

## Reads and writes

- Profiles are read from `public.user_profiles`; known profile preferences are saved there. Active addresses are read from `public.user_addresses`. New Auth-linked profile edits no longer create duplicate private user documents. Historical private records remain preserved.
- Mapped domains (categories, brands, pages, articles, CRM, price lists, rewards, banners, announcements and layouts) are read from their own existing tables, ahead of old compatibility JSON. Compatibility writes still retain an archive and update typed tables transactionally.
- Legacy direct category/brand array imports are replaced in place from database hydration at boot and on subsequent refreshes, so existing pages and menus receive the same canonical data.
- Runtime hydration discovers mapped tables even without a document-version record, fixing hidden fallback to static category/brand lists. Categories expose their stored metadata tree; brand DTOs expose stored logos and names.
- Club configuration and system settings use their existing tables. Admin-only system settings are not part of the public runtime allowlist.
- The durable browser adapter has no localStorage fallback. Before initialization it cannot persist business data. Database failures remain errors.
- Logical removals keep original table rows and a PostgreSQL tombstone ledger; removed content is not resurrected from compatibility JSON. Consumer and wholesale milestones are stored separately using the existing milestone payload. Static price-list and reward fallbacks are disabled in database mode.
- Historical source JSON and compatibility archives have not been deleted. Static icons, fonts, CSS, route definitions and presentation assets are application code/assets, not a business database.

## Remaining gates — do not call the full migration finished

- Supabase Phone Auth/SMS delivery is not configured. `SUPABASE_SMS_READY=false` must remain until the provider or Send SMS Hook is configured and real delivery/OTP verification is tested. Do not use a fixed OTP, fake success, or store SMS provider secrets in frontend code.
- The old Railway service's volume and browser-only legacy exports have not been reconciled. Preserve them until exported, backed up, mapped, imported and compared. Copied original Supabase rows do not prove the volume was migrated.
- Unmapped legacy namespaces still persist inside PostgreSQL compatibility/scoped documents. They are not local storage, but full domain-table normalization is not complete. Dealer operational data, saved collections, industrial chats and machine passports need a separate reviewed mapping and ownership-aware integration pass before claiming every table is the sole source for every feature.
- Supabase Storage byte migration, real AI provider calls and payment settlement require their own integration checks. Public catalogue images currently include Git-hosted URLs.
- Legacy file-mode server handlers remain for historical tooling; deployed Railway uses `DATA_BACKEND=postgres` and `DATABASE_SCHEMA=adopted`. Never switch the service back to file mode.

## Validation

Run TypeScript lint, database tests, portal policy tests and production build. Database tests use isolated PostgreSQL-compatible fixtures; these are not proof of SMS delivery. Verify live `/api/health`, `/api/runtime` table-backed values and guest commercial-data isolation after deployment. A provider-disabled registration must return an honest error and leave profile/Auth counts unchanged.
