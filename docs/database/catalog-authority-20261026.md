# Sanat Pish: PostgreSQL + persistent Storage authority audit

Date: 2026-10-26. Branch: hardening/catalog-db-volume-only-20261026.
Status: staged source-only hardening; NOT merged or deployed to production.

## Verified live state (read-only)

- Supabase project "sanatpishatlas": 1,383 active families, 10,435 active SKU variants, 10,435 variant commercial rows.
- 869 image audit records point at /storage/products/...; zero external GitHub URLs in those records.
- Gallery image rows: 458 in this audit; all gallery image URLs are local. Historical audit captured 457 before later edits; prefer current SQL.
- No HTTP external URLs currently present in catalog_families.images, catalog_variants.images, catalog_gallery_images.url, catalog_image_audits.image_url, or catalog_categories.image_url.
- Railway production service mounts persistent 500-MB Volume "portal-data" at /data; build uses a Dockerfile; start command "npm run start"; NODE_ENV=production in Dockerfile.
- Railway deployment logs show [Product images] Verified on persistent volume: javanweb/imagesatlas 869, and visual hashes indexed from PostgreSQL: 869. These were historical deployment observations, not a new direct volume listing or backup.

## Source dependency audit

1. PostgreSQL is authoritative: server/db/repository.ts -> readAdoptedProducts; adopted tables catalog_families, catalog_variants, variant_commercial_specs, and catalog_gallery_images.
2. The /api/runtime response is serialized JSON **over HTTP**, not a checked-in catalog JSON file. It can remain large until the independent catalog-runtime-split migration is tested and merged.
3. src/data/userProducts.ts initializes empty arrays; it does **not** import catalogueSource.json. It only installs PostgreSQL products into browser indexes when hydrated. src/main.tsx loads /api/runtime via durableStorage.
4. src/data/imageAssignments.ts and src/services/catalogImageCorpus.ts take DB metadata, not static fixture JSON.
5. src/data/mockGenerator.ts has an *empty* inline initial override object and a Node-only fallback to empty USER_PRODUCTS_RAW. Browser with unavailable database paints no stale embedded product data.
6. src/data/categories.ts derives dynamic categories from server-projected managed category metadata.
7. Legacy server/productImageStorage.ts still had an on-disk Git working tree fallback for original PNGs and derived thumbnails. This branch removes it: /data mounted storage or HTTP 404.
8. src/components/product/ProductImage.tsx used alternate raw.githubusercontent.com/jsDelivr retries for historical URLs. This branch rewrites official old image URLs to the local /storage/products/catalog route; it never fetches a remote alternative.
9. src/assets/imagesproducts.ts now rejects unknown remote product images; unsaved blob/data preview URLs remain accepted. Locally stored JPEGs, WebP uploads, WebP thumbnails, and original PNGs remain supported.
10. server.ts previously ran beginImageVolumeMigration at each startup; it might make GitHub calls and write URL-replacements to PostgreSQL. This branch makes it explicit opt-in via CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT=true. Do not set this variable during ordinary operations.
11. .dockerignore excludes storage/ from the production image. The files inside Git are a historical archive and **not** production runtime files. Do not delete them or the fixture JSON until separate backup/restore and QA gates complete.

## JSON policy

Keep package.json, package-lock.json, tsconfig.json, Capacitor and host config JSON. Keep docs/ and tests/fixtures/*.json as auditable examples and regression fixtures for now; they must never be imported into production modules. The /api/runtime JSON HTTP payload is a **different** problem and will be optimized in the independent performance PR.

## Gate before deployment

- Run npm ci, npm run lint, node --import tsx --test tests/catalog-storage-authority.test.ts, npm run test:database, npm run test:portal, npm run build.
- Test /storage/products/catalog/e(1).png and e(869).png, /storage/products/thumbs/e(1).webp, and an actual admin-uploaded UUID WebP image. Confirm 200, correct MIME types and bytes from Volume.
- Test an intentionally missing image and confirm 404 with no request to GitHub/CDN.
- Inspect DevTools Network for a product listing, product detail, mobile and desktop; verify image host is the first-party website and no old image repo calls occur.
- Test add/update image from admin; verify it writes Volume + PostgreSQL and renders with no redeployment. Verify prices and stock are unchanged.
- Check 1,383 active families, 10,435 active SKU variants, and 10,435 commerce rows after deployment; compare gallery bindings, hashes and image audits before/after.
- Never enable the migration flag or merge before passing CI and tests. Existing Railway production deployment and persistent Volume must not be deleted or modified for this gate.

## Manual backfill (not automatically performed)
The older importer in server/catalogImageVolumeMigration.ts remains available only for an operator-controlled **one-time** repair after verifying the Volume's contents and taking a PostgreSQL backup. This branch does not backfill or delete any production rows.
