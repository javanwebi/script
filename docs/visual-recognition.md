# Industrial image recognition

The image identification route uses this pipeline: uploaded image → multimodal observation → local retrieval across real imported warehouse SKUs → candidate comparison → evidence policy → exact and similar result lists. The legacy `AT-E...` catalogue is not an inventory source. Invented demo variants absent from the original import are excluded. Admin edits to existing inventory are refreshed for new requests.

## Server configuration

```dotenv
PART_RECOGNITION_WORKER_URL="https://atlas-aishenasaei.javanwebio.workers.dev/"
PART_RECOGNITION_WORKER_TOKEN=""
PART_RECOGNITION_WORKER_TIMEOUT_MS="45000"
ai-forza=""
AI_FORZA_API_KEY=""
```

An unset Worker URL selects the supplied default. An explicitly empty URL disables the Worker. The Worker is attempted first; a configured direct Gemini key is available when the Worker is disabled or fails. Direct key priority: `ai-forza`, `AI_FORZA_API_KEY`, legacy `GEMINI_API_KEY`. The hyphenated name works in dotenv and hosting secret settings; use the uppercase alias for shells. No direct API key is included in Worker requests or client bundles. The optional Worker access token is sent as Bearer authentication and must match the Worker's own configuration.

The example file is never loaded as runtime configuration. Configure production secrets on the actual backend host; committing `.env.example` does not deploy or configure hosting.

## Interpretation

Model confidence, perceptual distance, matching color and matching family photos do not establish a unique SKU. A readable exact warehouse code with high transcription confidence can establish a code match. Dedicated photos require separately verified SKU identity before they can establish an image-based exact match. Existing photo mappings have not been certified as such; the policy therefore does not treat them as identity proof. The admin gallery provides an explicit per-image confirmation checkbox after code binding. Changing the code, replacing the image, or switching to family scope clears the confirmation. No existing images are automatically marked verified. Similar products remain available alongside a confirmed match. If the ranked list has no alternative, existing same-family items are labelled as family alternatives with unverified visual/technical compatibility.

Dimensions without a scale, exact polymer/metal grade, hidden geometry and conformity to standards must not be inferred as facts. Result specifications come from the matched inventory row. Unavailable AI is explicitly labelled; failure to confirm a match is not proof that the product is out of stock or absent. Availability text does not promise stock or custom manufacture.

## Verification, 2026-10-19

- Unit tests cover Worker selection/disable, key aliases, real inventory filtering, confidence downgrade, shared photo ambiguity, exact code plus alternatives, multimodal transport, and malformed/error responses.
- Public Worker metadata reports a configured Gemini key, but an unauthenticated POST to `/v1/chat/completions` returned `unauthorized` / `دسترسی به Worker مجاز نیست.`. No valid Worker access token or direct API key was present in this workspace. Live model recognition cannot be certified until the Worker token or a direct key is configured. No production deployment is implied by a Git commit.


## Exhaustive image scan, 2026-10-19

Image-first scanning is separate from warehouse-code lookup. Every one of the 869 original photos is included, including unassigned photos. All active admin gallery images, variant images and family images are added and deduplicated. New families and real manually added inventory codes are refreshed from persisted admin overrides. Known seeded demo codes are excluded. An arbitrary numbered upload URL is never converted into an unrelated e(N) image.

The scanner presents every decodable image in numbered sheets of at most 36 photos, then reinspects up to 24 selected photos in high-resolution groups. Model responses are bounded to the displayed image indexes; similarity scores do not establish SKU identity. Missing files and provider/schema failures are explicitly reflected in `scanCoverage`; a partial scan never claims complete coverage. Photo matches without a known SKU remain useful photo results without invented codes. The successful mocked HTTP test covers upload input → HTTP 202 job → polling → 869 comparisons → final photo e(869). It proves execution and coverage, not real-world recognition accuracy.

Long scans run as bounded background jobs (two active, eight pending/active maximum). The UI polls and reports actual comparison counts instead of a random progress timer. Reusable sheets are keyed by source/revision; new uploaded images and edited content invalidate their sheets. Cached image reads are isolated from the old name-based resolver.

The checked-in Worker v7.1 used only the first image and forced a recognition-only schema. Both Worker entrypoints now support the `catalog-image-scan` task and forward every inline image, returning the requested JSON. **Publish Worker v8.1 before enabling full scans through the supplied Worker URL.** An existing v7 response is rejected for multi-image comparisons rather than silently counted as successful. Direct `ai-forza`/`AI_FORZA_API_KEY` Gemini calls can execute the full scan without a Worker upgrade when the Worker URL is explicitly empty.

Worker access now requires configured secrets only: set `APP_WORKER_TOKEN` on Cloudflare and the same value as `PART_RECOGNITION_WORKER_TOKEN` on the backend. The legacy source-default access marker and API-key-header authorization bypass were removed. No access-token value is stored in committed source. Cloudflare deployment access is not connected in this session; pushing these files to GitHub does not update the running Worker or the website deployment.

The browser automation package was present but its Chromium executable was unavailable, so no browser visual pass is claimed. TypeScript/build checks and the mocked full HTTP job/polling flow were run independently.


## Linked image transport

Customer upload endpoints return a real `/imageai/vision-<random-id>.jpg` URL and persist the optimized JPEG on the backend, rather than returning a Base64 data URL. Internal comparison photos/sheets are likewise published to opaque temporary URLs and reused within a scan. Worker requests therefore carry HTTPS links; Worker v8.1 downloads each linked file with type/size checks before passing its bytes to the model. No customer photos are mirrored to GitHub. These changes reduce request-body size and Base64 transport overhead; they do not remove image input tokens charged by the model. See https://ai.google.dev/gemini-api/docs/image-understanding and https://ai.google.dev/gemini-api/docs/tokens.

The public backend must serve those URLs without a login. `VISION_IMAGE_PUBLIC_ORIGIN` can specify that HTTPS backend origin when the frontend and backend are hosted separately. Otherwise APP_URL/proxy request headers are used. Direct Gemini operation still uses its native image input format; merely placing an image URL in a text prompt does not perform image understanding.

Owned temporary `vision-` files are eligible for cleanup after two hours; a request-local hash reuses links without publishing predictable content-hash URLs. The upload test checks that the link serves real JPEG bytes. The end-to-end HTTP fixture checks upload → readable link → queued scan → Worker requests containing links only → all 869 image comparisons. The Worker tests verify that both linked images are downloaded and included in the actual model request. These are protocol tests with controlled model responses, not an accuracy benchmark.
