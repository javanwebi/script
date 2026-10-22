# Independent deployment: atlassanatpish1

Repository: https://github.com/javanwebi/atlassanatpish1 (main).
Railway project: `4e79172e-f7d3-4570-a9aa-634b26bd0e7a`.
Environment: `5ea44549-9ba0-45ae-8e4a-7e1f178ed0e9`.
Application service: `a6022873-b0df-4c06-8daf-6e9a1209d2fb`.
Supabase: `spkszfbeeufdcpcltqal` / sanatpishatlas.

The source import was pinned to ATLAS2 commit `265873c58711bcfc4e8c8b2974e50e394a9b7176`. All 466 application/source/assets files outside the historical workflow folder were verified byte-for-byte by their Git blob hashes. The historical import workflow is preserved under `docs/database/archive/import-sanatpish.yml` instead of being active: its push trigger would replace this repository with an older upstream snapshot. The one-time bootstrap workflow is removed after import.

The independent service receives PostgreSQL and Supabase Auth configuration through server-side Railway variables. TLS certificate verification stays enabled. The official Supabase Root 2021 CA is configured in `DATABASE_CA_CERT`; SHA256 fingerprint `807025AD50D4ED219D2C9C7D299C004F824EB00CF7FF65AFEF607D07B72E6CAFA`. No database password, service-role key, or session secret is committed.

`npm run db:verify:adopted` checks all public tables for RLS, validates original-column fingerprints for all 49 transferred tables, checks validated foreign keys and performs a database write/read/rollback plus anonymous isolation test. It is an initial-transfer verification: after legitimate data changes its source fingerprints are expected to differ. Run it as the first deployment's pre-deploy gate, then remove that strict pre-deploy gate for normal operation. `/api/health` checks a real database query and returns 503 on failure.

The existing production Railway service and old Supabase database are unchanged. This new application does not automatically copy the old live volume, browser-only data, Auth accounts or file bytes. Original static assets and external catalog image URLs remain available. Complete those reconciliations before routing existing customers to this independent application.

Real Supabase Auth phone/SMS delivery, owner administrator provisioning, external AI credentials and bank gateway settlement need their actual service configuration. SQL tests and a successful database health endpoint do not prove those provider integrations. Keep `SUPABASE_SMS_READY=false` until a real SMS provider delivery test passes.
