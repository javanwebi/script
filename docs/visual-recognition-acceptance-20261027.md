# Visual Recognition Acceptance Matrix — 2026-10-27

Repository: `javanwebi/script`; change set: PR #125. Production inventory and the 869 catalog originals **must remain unchanged**. This report distinguishes verified automated tests from tests still required with the user's real images, browser and Railway.

## Acceptance criteria

| # | Requested behavior | Engineering coverage | Evidence / remaining acceptance |
|---|---|---|---|
| 1 | Identical catalog photo retrieved | Implemented strict image-identity check and deterministic retrieval | Automated synthetic reupload test passes. Run 20 known Railway catalog photos against the production API |
| 2 | Different camera angle | Candidate similarity supports 90-degree planar rotations | Synthetic in-plane rotation test passes. 3-D front/side/reverse-angle **not yet verified**; pretrained local encoder or labelled real tests required |
| 3 | Worn/noisy workshop images | Preliminary shape retrieval; synthetic dirty overlay regression | Synthetic test passes. Real dirt, occlusion and noisy backgrounds **not yet verified** |
| 4 | Out-of-catalog photos never asserted exact | Exact-SKU claim requires verified dedicated photo + strict image identity, or independent code/dimension evidence. Similar photos explicitly provisional | Synthetic novel-shape test passes. Real negative-set false exact-match rate **not measured** |
| 5 | Disambiguate similar shapes with different dimensions | Added conservative measurement/SKU conflict checks against actual recorded specs; missing/unrecognized units never guessed | New unit tests pass; needs real SKU family/technical specification data QA |
| 6 | Reflect edits to catalog image/name/family | Descriptors keyed by image ID, URL, revision; metadata taken from current catalog records; changed revisions reindexed; coverage route reports counts | Synthetic revised-image test passes. Direct database updates and admin UI propagation **not yet tested** |
| 7 | No invented code for photo without assigned SKU | Candidates created exclusively from recorded image bindings and existing catalog codes, then validated by inventory-v1 policy | Tests and code policy cover this. Inspect randomly selected unbound photos in production |
| 8 | 10 simultaneous customers | Production 1 CPU: one active heavy CPU job, 24 queued/running capacity, bounded image cache | Deterministic 10-job concurrent queue test passes; actual 10-HTTP-client Railway load/latency **not measured** |
| 9 | Restart does not lose analysis state | Job IDs, status and inputs durably saved to Railway volume; running work requeued after boot; customer photos mirrored to same volume, TTL cleanup | Simulated in-process restart/recovery test passes; actual Railway forced restart mid-job **not tested** |
|10 | Mobile upload and image results | Existing responsive React UI retained; optional technical measurements exposed after quick search | Static production Vite build passes; Chrome mobile/manual real upload and network assertions **not tested** |

## Changes included

- Offline image retrieval uses local sharp-based descriptors and strict reuploaded-photo identity, never paid image AI API.
- Measure/profile information is conservative and only filters when a directly comparable catalog spec exists.
- Failed/unavailable catalog images are counted; new index status route `/api/ai/visual-index-status` reports offline cached-image coverage, not legacy hosted embeddings.
- Boot prewarms the lightweight offline image descriptor cache. Legacy hosted image embedding builders (which could consume API tokens or write image-feature rows) are disabled when offline mode is active.
- Unsafe public remote image fetches are bounded, HTTPS-only, DNS-checked, no redirect.
- Background queue and customer-upload mirror persist to existing `/data` volume, with bounded memory and retention; original catalog image volume and PostgreSQL schema untouched.

## Real end-to-end acceptance (outstanding)

1. Assemble 200–300 labelled *customer camera photographs* including distinct industrial families, hard negatives and true exact SKUs.
2. Before any threshold tuning, split test/evaluation photos by physical part (prevent photos of the same part leaking into training).
3. Measure retrieval Recall@1, Recall@5, false-exact rate (target zero in test), precision of similar recommendations, p50/p95 latency, 10 concurrent users, error rates and storage coverage.
4. Run Chrome mobile+desktop upload and actual Railway restart while a job is running. Verify the original job ID completes and the original image is accessible.
5. Verify admin changed/added/reassigned images in PostgreSQL and web UI, including families with no SKU mapping, without performing any destructive DB migration.
6. If real angle/occlusion results miss targets, deploy an **independent local multimodal visual encoder** on sufficiently provisioned compute: one 1-vCPU / 1-GB host is not adequate for guaranteed neural inference alongside the production site.

These criteria are NOT yet fully accepted. A green CI proves only the synthetic regression/TypeScript/build gates.
