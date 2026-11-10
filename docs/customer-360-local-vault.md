# Customer 360 and device-local image vault

## Scope

Customer 360 connects the registered customer's product-identification events, FORZA text consultations, selected catalogue SKUs, real orders, purchase analytics and staff follow-ups to one CRM customer profile.

The original customer image is not a server business record. It is stored as a Blob in the browser's origin-private IndexedDB database, scoped to the signed-in customer. The app exposes no delete or export control for these records. No device-storage permission is requested. IndexedDB writes automatically; browser storage can still be evicted or cleared by the device owner.

## Image lifecycle

1. The customer selects or captures an image.
2. The browser saves the original Blob in the sanatpish-customer-device-vault database before analysis.
3. Recognition is not blocked for guests. When a customer is signed in, the device record is associated with that account and metadata is attached to the CRM profile; a guest can still run recognition, but no customer CRM history is created until the customer signs in and repeats or continues a tracked action.
4. Only the active analysis request sends a data URL to /api/ai/analyze-part. The server decodes and processes the image in memory. The customer-image persistence function does not write to the image directory, Storage, GitHub, or a database column.
5. The server returns product and recognition metadata. The browser keeps the original Blob locally. The short-lived crop-confirmation cache retains only a SHA-256 fingerprint and derived query evidence, not the original data URL or image bytes.
6. The CRM stores the device record ID, SHA-256, MIME type, size, filename, timestamp, recognition status, product codes and sanitized result. It does not store image bytes, base64, a permanent image URL, or a server file path.
7. Administrators can see who submitted the image and the recognition outcome. They cannot fetch, preview, or download the original image.

### Non-negotiable browser limitation

A website cannot make data on a device undeletable by the device owner. The app intentionally has no image-delete UI or delete API and does not request a storage permission. The customer can still clear browser/site data, reset the browser, uninstall a PWA, or erase the device. IndexedDB is also scoped to one browser profile and does not automatically synchronize to a different device. Do not describe this as guaranteed permanent storage.

### AI processing and provider boundary

Remote visual recognition requires the image pixels to leave the device for the active request. The application server processes the request in memory and must not persist the image. Provider-side retention is a separate boundary governed by the configured model provider's terms and settings; do not promise zero provider retention without verifying the provider contract. If the owner later requires pixels never to leave the device, that requires a tested on-device vision model and a different accuracy/performance acceptance gate.

## Customer 360 records

- customer_image_identifications: image metadata and sanitized recognition results only.
- customer_ai_consultations: session title, summary, selected product codes and bounded conversation messages.
- customer_product_interests: products explicitly selected during FORZA consultations.
- customer_followups: staff-owned customer follow-up tasks.

Real purchase analytics are queried from the existing orders and order_items tables. Do not copy or synthesize order totals into a second source of truth.

The admin CRM includes:
- a global image-identification history with customer identity and recognition outcome;
- per-customer image history, with an explicit no-image-access notice;
- FORZA consultation summaries and message history;
- monthly and yearly totals from valid orders, plus top purchased SKUs;
- staff follow-up creation and completion.

## Product consultation

WorkspaceCatalog lets the customer search the live catalogue and add exact SKU variants to the active FORZA consultation. Product-detail pages and image-recognition results can open the consultation with a preselected SKU. The selected codes and names are added to the consultation context and saved with the customer session. Product selection is not a purchase and must never be reported as one.

FORZA's shared desk/voice system prompt instructs it to:
- preserve customer corrections and conversation context;
- ask one high-value clarification at a time;
- verify dimensions, suffixes, operating conditions and compatibility;
- distinguish verified catalogue data from general engineering knowledge;
- compare only real, relevant catalogue options;
- never invent SKUs, brands, stock, prices, standards or compatibility;
- conclude with a proportionate next action such as an estimate or engineering review.

## Activation and migration

The new API and CRM intelligence panels are gated by CUSTOMER_360_LOCAL_VAULT_ENABLED, which is off unless explicitly set to true.

Before enabling it in production:
1. Review the exact adopted migration plan and target database.
2. Take and verify a production backup and restore test.
3. Run the adopted migration through the existing approved migration process; deployment alone does not authorize DDL.
4. Run npm run lint, npm run test:database, npm run test:portal and npm run build.
5. Test a registered customer, an administrator with CRM view/edit permissions, a customer with no orders, and a customer with valid orders.
6. Verify that no image bytes or permanent image URLs appear in database rows, API logs, or server image directories.
7. Only then set CUSTOMER_360_LOCAL_VAULT_ENABLED=true in the production environment.

This code change prevents new customer uploads from being written to server image storage. It does not delete historical image files that may already exist on the server; review those legacy files separately before any removal.
