# Product images: persistent on-server storage

This project uses **Railway Volume** on the production `sanatpish` service.
Volume: `portal-data`, currently mounted at `/data` (500 MB at implementation time).

## Data flow

1. An authenticated site administrator selects PNG / JPEG / WebP (max 8 MB) in **Products → Images** or **Image audit**.
2. Browser POSTs the image to `/api/catalog/product-images/upload` with existing `familyCode` and optional `variantCode`. Admin authentication is verified server-side.
3. Express validates the file and dimensions (max 24 MP), converts it to WebP (up to 2048×2048) and stores it atomically in **`/data/storage/products/{uuid}.webp`**. The directory is created on startup; production refuses to write outside the `/data` mount.
4. In the same request, a PostgreSQL transaction updates `public.catalog_gallery_images` (including the SKU code and URL), plus the authoritative image arrays in `public.catalog_families` and `public.catalog_variants`. A failed transaction removes the new file.
5. Express immediately serves `GET /storage/products/{uuid}.webp`. The catalog cache refreshes from PostgreSQL; no code commit or deploy is required for future uploads.

## Guarantees and limitations

- No uploaded product media is added to Git, Docker images, JavaScript bundles or local JSON products.
- Images use immutable randomized file names; replacements do not overwrite old bytes.
- The exact SKU relationship is recorded when a SKU is selected, and `identity_verified` defaults to **false** until manually reviewed.
- Existing historical photos in `javanweb/imagesatlas` are untouched.
- Uploads on a newly created family or SKU require that family/SKU to be saved in PostgreSQL first.
- Volume contents survive app rebuilds/redeployments, but **are not a backup**. Configure snapshots/offsite backups for both `/data/storage/products` and PostgreSQL; track capacity (the attached volume was 500 MB).
- Because media is served from local disk, the Railway service must remain on one instance sharing the mounted volume. Do not scale to independent replicas without migrating media to object storage or a shared filesystem.
- A rollback of the app does not remove stored images. A rollback of PostgreSQL may leave orphan media; reconcile by URL. File deletion of historical product images is intentionally not automatic.
- If the Railway volume is detached or replaced, existing file URLs will fail. The app fails startup if it cannot create the production storage directory.
