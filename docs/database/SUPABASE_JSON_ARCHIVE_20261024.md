# Sanat Pish: repository JSON archive in the canonical Supabase project

Date: 2026-10-24. Canonical Supabase project: **sanatpishatlas**
(`spkszfbeeufdcpcltqal`). Source repository: `javanwebi/script`.

## Completed non-destructive transfer

- Every **24** tracked `.json` file in the repository tree at commit `bec7bea11e069b42f6df39bb154482ad31f2867f` was copied into `app_private.source_archives` under `github/javanwebi/script/<path>`.
- The archive uses immutable, composite `(source_path, sha256)` identities. Large files were assembled in PostgreSQL from UTF-8 chunks and stored as complete JSONB documents. Temporary chunk entries are retained separately; they are not used for runtime queries.
- The live normalized catalog remained untouched: **1,383 active families** and **10,435 active SKUs**. Comparing all archived family and variant codes with the live tables produced **zero missing and zero extra codes** on either side.
- Historic image review: **869** records; technical research: **2,642** records; owner photo references: **143**. Runtime tables preserve the corresponding records.
- Existing image features: **869 hashed**, **864 with Jina embeddings**. These are stored in `public.catalog_image_features`; the remaining five embeddings were not invented.
- No data, product, customer, price, order or inventory record was deleted or overwritten. No production schema migration was needed: `app_private.source_archives` already existed.

## Authoritative runtime data map

| Purpose | Database source |
| --- | --- |
| Families and per-SKU specs | `public.catalog_families`, `public.catalog_variants` |
| Categories and brands | `public.catalog_categories`, `public.catalog_brands` |
| Gallery / catalog image verification | `public.catalog_gallery_images`, `public.catalog_image_audits`, `public.owner_catalogue_photos` |
| Visual hashes and Jina vectors | `public.catalog_image_features` |
| Gemini retrieval cache | `app_private.scoped_documents` (`catalog_visual_gemini_768`) |
| Technical references | `public.owner_catalogue_pin_rows`, `public.timing_belt_reference_lengths`, `public.technical_research_records` |
| Frozen GitHub JSON snapshots | `app_private.source_archives` |

Production React and Express catalog code is database-hydrated; historical JSON fixtures are for isolated tests and do **not** become a runtime fallback. Build configuration (including `package.json`, `package-lock.json`, `tsconfig.json` and `railway.json`) must remain in source control even though archived copies exist in Supabase. GitHub Actions is the CI executor, not the production database.

## Verification and future synchronization

The following command is read-only and checks the SHA-256 of every Git-tracked JSON file against the private archive. It needs an authorized, server-side `DATABASE_URL`.

```bash
node scripts/database/syncGithubJsonArchive.mjs --verify
```

To **append** newly changed JSON revisions after review (never overwrite existing archived revisions), execute from a trusted server or controlled maintenance environment:

```bash
EXPECTED_SUPABASE_PROJECT_REF=spkszfbeeufdcpcltqal node scripts/database/syncGithubJsonArchive.mjs --sync
```

Never place production database credentials in frontend `VITE_*` variables or untrusted pull-request GitHub Actions. The verification script requires a private DB connection and is intentionally not run automatically from public PR jobs.

## Remaining separate storage work

The JSON transfer does **not** transfer the binary original catalog image files. As checked on this date, all **869** `catalog_image_audits.image_url` values still reference GitHub and `storage.objects` contained **0** objects. Moving image binaries requires a distinct, verified Supabase Storage migration, retention/backup policies and URLs updated only after copying and integrity verification. Five Jina embeddings also remain to be generated, subject to provider credentials/availability.

This archived migration is additive; it is not a substitute for verified offline backups of PostgreSQL and image binaries.
