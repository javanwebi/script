# Offline-only catalogue image search (opt-in)

Implementation branch: `feature/offline-image-recognition-20261027`. This changes **only image recognition** and its existing results UI. No catalog, checkout, price, stock, account, or production database migration is involved.

## Activate on staging first

Configure on the **Node/Express server** (not React/Vite):

```dotenv
PART_RECOGNITION_MODE=offline
OFFLINE_IMAGE_INDEX_FILE=/data/storage/catalog-offline-photo-index-v1.json
```

The persistence path is optional, and should point to a **writable persistent volume** if available. It is only a cache; it can be recreated from source photos. Do **not** point this variable to an inventory/database path, and do not delete or migrate existing PostgreSQL or catalog-image data. If it cannot write, retrieval still works with an in-memory index.

With the flag unset, the existing Worker/Gemini path is unchanged. The image upload flow remains `/api/ai/customer-images` → `/api/ai/analyze-part` (HTTP 202) → `/api/ai/recognition-jobs/:id`. The UI reuses its original results and photo gallery, reporting local search accurately without saying that AI understood a part.

## What it actually does

1. Reads every registered catalogue photo from `buildCatalogImageCorpus`, including previously unassigned originals and new admin uploads.
2. Builds a lightweight CPU-only image signature from the real pixels: coarse greyscale, gradients/edges, foreground occupancy, tonal histogram and a perceptual difference hash.
3. Saves compact per-photo descriptors. Subsequent searches reuse them; new/changed image URL or revision triggers selective reindexing.
4. Compares the customer photo to the indexed photos on the local server, ranks candidates, then performs a strict image-identity check against top-ranked photos.
5. Shows up to 12 closest **photos** even when no SKU has been confirmed. Unbound photos remain unbound; no generated SKU codes.
6. Converts a candidate to an exact SKU **only through the existing inventory-v1 policy**, requiring an identity-verified, unique variant image and strict photograph-identity evidence. A numerical similarity rank can NEVER independently prove SKU identity. Stock and prices are read only through existing DB flows.
7. Reports index coverage, missing photos and backend progress honestly. A failed photo load never counts as scanned.

This path contacts **no vision API**, requires no API key, makes no hosted model calls and incurs no per-token charges. It does use server CPU, memory, persistent storage and image IO. Backend catalog and images must be locally available.

## Known limitations (do not claim production accuracy)

This is **visual similarity retrieval, not full industrial object recognition**. With arbitrary customer photographs, different angles, occlusion, dirt, dramatically different lighting or backgrounds, classical image signatures are not reliable for identification of a product family or exact technical variant. A rank is not an accuracy percentage. In a catalogue with very similar pulleys or belts, correct matching requires additional dimensions and verified SKU-to-image mappings.

The backend uses a bounded 6-worker initial index build, and strict photo comparisons for the top 30 results. First-search latency depends on loading all photos; prewarm/cache persistence is important. This code has **not** been benchmarked on the user's production VPS or measured on real customer photos.

The recommended next accuracy upgrade is a **locally hosted visual encoder (e.g. DINOv2 with ONNX Runtime)**: integrate its embeddings into candidate retrieval while retaining the existing exact-SKU gate. Before choosing the encoder/server, obtain real machine specs, a labelled multi-view image test set and verified image-to-SKU links. This upgrade still has no external token fees but consumes more compute.

## Validate before merge/deploy

- Run `npm ci`, `npm run lint`, `node --import tsx --test tests/offline-catalog-photo-index.test.ts`, `npm run build`.
- Verify 869 legacy photos and all gallery/admin-uploaded photos from **the currently connected database**, with image-loading coverage status 100%, without accidentally linking unassigned photos to arbitrary SKUs.
- Benchmark warm/cold starts with 1/10/50 concurrent requests and monitor CPU, RAM, disk, image IO, p50/p95 latency.
- Create a labelled set of at least 200 real customer images (front, back, side, blurry, worn, background clutter) with the actual target SKU/family and true negatives. Measure family Recall@1/5, Recall@10, MRR and false exact-match rate. No '100% accurate' claims without results.
- Verify that zero-image or partial-image coverage never asserts absence from inventory or a definitive code; unconfirmed similar photos must remain explicitly labelled as provisional.
- Confirm each uploaded new photo triggers incremental indexing on the next search.
- Confirm browser mobile upload, polling, image cards, no console errors and no cross-origin fetches for model inference.
- Merge and deploy only after CI, staging tests and a verified PostgreSQL + image-volume backup. Do not modify production credentials or enable it on production before review.
