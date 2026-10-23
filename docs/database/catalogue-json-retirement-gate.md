# Supabase catalogue migration and JSON retirement gate

**Status (2026-10-24): NO-GO for deleting checked-in JSON.** The public production service must keep working during migration. Nothing in this report authorizes replacing database records with old JSON, disabling prices/stock, or deleting files.

## Read-only live Supabase findings

Project: `spkszfbeeufdcpcltqal`, adopted PostgreSQL schema.

| Audit | Result |
| --- | ---: |
| Active catalog families | 1,383 |
| Active variant SKUs | 10,435 |
| Families in `catalogueSource.json` | 1,383 |
| Variant SKUs in `catalogueSource.json` | 10,435 |
| Family code missing/extra vs source | 0 / 0 |
| SKU code missing/extra vs source | 0 / 0 |
| SKU name/size mismatches | 0 |
| Family name/category/subcategory/submenu differences vs source | 48 field differences |
| Variants with empty `technical_specs` | 0 |
| Families with empty shared `technical_specs` | 153 |
| Orphan gallery family/SKU bindings | 0 |
| Gallery entries | 457 |
| Image audit rows | 869 |
| Image feature rows | 864 |
| Missing image feature rows | 5 (`e(865).png` to `e(869).png`) |

The source JSON is **not** authoritative for replacing live family data: the live DB includes reviewed corrections absent from the original workbook source, e.g. `FAM-40997` changes from the source's O-ring category to the reviewed pulley family. Never overwrite these changes with a blind upsert.

## Runtime dependencies still present

- `src/data/userProducts.ts` imports `catalogueSource.json` and `catalogueImages.json` as bundled catalog seed/reference data.
- `src/data/mockGenerator.ts` still falls back to `USER_PRODUCTS_RAW`, and `catalogOverridesDb.json` is an initial seed before server hydration.
- `src/data/categories.ts` builds navigation from the static seed, then installs hydrated managed categories.
- `src/data/imageAssignments.ts`, `src/services/catalogImageCorpus.ts` and other reference/search files still use checked-in image review/research JSON.
- `server/db/adopted.ts:readAdoptedProducts` already reads the product listing from PostgreSQL `catalog_families`, `catalog_variants`, `variant_commercial_specs` and `catalog_gallery_images`.
- `src/main.tsx` installs database products after `/api/runtime` hydration; the storefront catalogue listing must subscribe to that event to avoid retaining its first snapshot. This patch fixes `ProductsPage`.

## Required steps BEFORE source JSON deletion

1. Review/approve the 48 live family-field differences and confirm every live value is intentional. Do **not** automatically overwrite newer database corrections.
2. Check all references and research/AI data files separately, including image-index coverage (five missing rows); import them with versioned migration/backfill and provenance when needed.
3. Remove static catalogue product/menu fallbacks in all production frontend and backend paths, not just the product listing. Ensure a database outage displays an explicit unavailable/loading state instead of silently serving stale data.
4. Back up both original JSON files and all relevant PostgreSQL schemas; perform an actual restore rehearsal before production changes.
5. Run `DATABASE_URL=... node scripts/database/verify-catalogue-parity.mjs` in an explicitly authorized environment and review the output. Script is **read-only**; no SQL migrations, deletions or updates.
6. Test real public browsing, searching, details, category navigation, admin editing, variant prices/stock, image search, full API health, and persistence after restart; test on mobile and desktop.
7. Only when parity, backup/restore and runtime checks pass: remove unused JSON imports, confirm green build/tests, and delete the **now-unused** product JSON. Do not remove independent technical reference datasets without replacing their supported runtime use.

**Safety rule:** Missing reference data, a transient outage, or a successful row-count match alone is *never* sufficient proof for deleting the original source data.
