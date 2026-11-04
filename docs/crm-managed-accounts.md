# Owner-managed customer portal accounts and SMS.ir welcome messages

## What the admin can do
At \`/admin/crm\`, open an existing retail or high-volume customer's dossier, then choose:
- Create a real Supabase Auth login for a manually created CRM contact (\`crm_customers.auth_user_id\` not set).
- Reset the initial password or change the username for an existing customer login.
- Choose a formal, short or edited custom welcome-SMS template, preview the substituted username, one-time password and login URL, and copy the message.
- Optionally send through SMS.ir **only** when SMS delivery is deliberately enabled and tested.

Account creation is restricted to an authenticated **super_admin** and requires confirmation that the mobile belongs to the intended customer. Real Auth login uses \`user_profiles.username\`, looks up the account, then verifies the supplied password with Supabase Auth. Wholesale access stays tied to \`approved_b2b\`. Existing customers, orders and financial rows remain unchanged. No raw password is saved to CRM tables or audit logs.

The administrator can choose the initial password or use a cryptographically random generator. The password remains visible in the open modal only. Closing the modal discards it; afterwards the admin must **reset** the password rather than recover it. On first successful login, the customer is sent to a compulsory password-change form. Protected customer portals reject sessions while \`preferences.mustChangePassword\` is true.

## SMS.ir (future connection)
The previously deployed Supabase Send SMS Hook (OTP) uses \`SMSIR_API_KEY\` and \`SMSIR_TEMPLATE_ID\` for approved verification messages. Separate **non-OTP, customized** CRM messages use the SMS.ir bulk endpoint with one mobile per call, over HTTPS:

- \`SMS_PROVIDER=smsir\`
- \`SMSIR_API_KEY\` (server-side only)
- \`SMSIR_LINE_NUMBER\` (approved send-from line)
- \`SMSIR_CRM_ENABLED=true\` (explicit administrative release gate; false if not configured)

Put secrets in the existing private VPS \`.env.sms\`, not in Git or public client variables. Never expose or log the key. The CRM SMS enable switch is independent of \`SUPABASE_SMS_READY\` (the OTP hook). If disabled, the SMS send option is disabled and the chosen message remains copyable. The API never claims a message was sent when the provider was not invoked. Even with accepted message IDs, delivery requires SMS.ir delivery reports.

Because SMS is not a secure channel, these are **temporary credentials**, not a permanent password. Keep the mandatory first-login change enabled. Prefer a password-setup link in a future iteration when phone verification is fully connected.

## New server routes
- \`GET /api/admin/crm/credentials/config\` (owner-only, reports SMS readiness, never API secrets).
- \`POST /api/admin/crm/customers/:key/credentials\` (owner-only, \`operation=create|reset\`, username, temporary password, editable SMS template and optional send).
- \`/api/portal\` action \`initial_password_change\` (authenticated customer with temporary-password flag only).

## Release/testing gate
1. Verify the VPS Supabase Auth URL/service-role key and database both point at the **same** target project/instance. Do not enable SMS from a cloud test project when the live VPS uses a different Auth service.
2. Run TypeScript, portal tests, real DB tests, and static build. Inspect PR checks and the existing unrelated consumer portal/logo test failure before merging.
3. Test one **approved test mobile** end-to-end: create a CRM-only contact, issue credentials, sign in, verify forced change, verify subsequent login and correct retail or wholesale dashboard. Verify a second provisioning attempt is rejected. Test an existing account's password reset, old password invalidation and rollback failure handling.
4. With SMS disabled, verify that no send occurs and the message stays copyable. After SMS.ir configuration, use a controlled test phone and verify provider acceptance and actual delivery. Do not use real customer phones for test sends.
5. Deploy only through the existing guarded main release. Never reset PostgreSQL, reassign existing identities automatically or store credentials in client caches.
