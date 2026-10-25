# Catalog Runtime Split — Safe Production Rollout Gate

## Verified before changes
- The connected `sanatpishatlas` PostgreSQL project contains 1,383 active families and 10,435 active SKUs (read-only SQL).
- The user's prior baseline is 23,239,276 bytes from `GET /api/runtime`, first request 3.05 s, warm ~0.62 s (local server network).
- A read-only 24-family SQL slice was ~22,948 bytes of JSONB family metadata and referenced 101 SKUs. **Not a real network benchmark.**
- Railway's `sanatpish` Dockerfile builds `dist` and sets `NODE_ENV=production`; Express serves `dist` in production. Investigate any development-mode observation before changing build settings.

## Runtime consumer inventory
1. `src/services/durableStorage.ts`: sole direct public browser GET/POST `/api/runtime` consumer; both versions and global/user scoped documents are hydrated here.
2. `src/main.tsx`: `sanat-durable-hydrated` event feeds `installDatabaseReferences` and `installDatabaseProducts`. App's first re-render depends on this.
3. `src/data/mockGenerator.ts` and `src/data/userProducts.ts`: global in-memory catalog, SKU alias lookup, search, filtering, all products, related products, and catalog invalidation.
4. UI consumers: `HomePage`, `ProductsPage`, `CategoryPage` / `BeltCategoryExperience`, `SearchPage`, `ProductDetailPage`, `Header`, `AllCategoriesPage`; additional catalog-dependent components for brands, AI visual recognition, carts and dashboards.
5. `server.ts` boot, recognition catalog, FORZA/visual search, pricing permissions, admin and product-image update callback still rely on full in-memory server catalog. **Do not remove this server-only preload until separately migrated and validated.**

## Implemented in this draft PR
- `GET /api/catalog/summary` — categories and family/SKU counts.
- `GET /api/catalog/products?page=1&limit=24` — SQL pagination; optional `category`, `sub`, `brand`, `q`, max 100 per page.
- `GET /api/catalog/search?q=...` — same filtered paginated handler.
- `GET /api/catalog/products/:id` — exact family or SKU lookup, full public technical variant/gallery detail.
- Public responses cannot reveal stock, pricing, or private commercial data.
- Asynchronous Brotli/Gzip for selected JSON endpoints, honoring Accept-Encoding and existing Vary headers.
- `GET /api/runtime?catalog=omit` for guest opt-in only. Authenticated commerce/admin contracts remain unchanged.
- `?catalogV2=1` in a guest browser tab enables a **limited QA preview**; stores that opt-in in the browser tab session. Do not enable globally until per-route pagination/filter behavior is complete.

## Important incomplete blockers
- Full per-route UI data migration: category filter taxonomy vs SQL exact matches, pagination on all listing surfaces, global search result counts, similar-products, cart/wishlist references and header instant search.
- Authenticated wholesale pricing and inventory may not be cached publicly; verify role-sensitive detail responses through existing access controls.
- AI visual search, FORZA and admin require independent regression testing; do not replace their full catalog with a partial page.
- Run API end-to-end against an isolated production-like staging service, browser tests for 390/768/1440 widths, mobile LCP, and response timing. No production change until these pass.
- GitHub PR must pass lint, database, portal, catalog API contract and build checks.

## Measurement checklist
Use `node scripts/tests/catalog-runtime-benchmark.mjs https://STAGING-HOST` from a network-connected CI runner. Compare 3 cold/warm runs of legacy and new routes: raw bytes, Content-Length, server/TLS/network duration, Brotli/Gzip. Use Lighthouse or Playwright browser trace for LCP/INP, image request counts and hydration time; backend timings alone cannot prove an LCP improvement.
Snapshot active SKU and gallery counts before/after. There must be zero writes/migrations during this PR.
