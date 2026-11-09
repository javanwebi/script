# Local catalogue image retrieval

This is an opt-in CPU retrieval path, not a generative vision agent. When
`PART_RECOGNITION_MODE=local-embedding`, image requests to `/api/ai/analyze-part`
return directly through the local encoder and never call Gemini or the Worker.
Other FORZA voice/chat providers are unaffected.


## MobileCLIP2-S0 upgrade (local-lens-v3)

The original DINO profile remains the default for existing installations. Opt in
with `LOCAL_VISION_ENCODER=mobileclip2-s0` in the private local-vision configuration.
The new profile uses the **image tower only** from
https://huggingface.co/timm/MobileCLIP2-S0-OpenCLIP, pinned to
`095906d28bf54d7584dc411e8ffe448f34289e05`, adapted from Apple's official
https://github.com/apple-aiml-research/ml-mobileclip. Consult the upstream Apple
model terms for deployment. No account/API token is needed to download the public
weights, and no external inference request is made. The internal private service
credential is reused automatically.

- 512-dimensional normalized image vectors; 256px bilinear square padding,
  mean zero / standard deviation one; timm 1.0.22, strict safetensors loading.
- The retained image checkpoint is about 45.9 MB. Provisioning downloads the
  combined checkpoint (~300 MB) once, extracts the image tower and removes the
  combined checkpoint from the final layer. Docker reuses the existing DINO base;
  total Docker size is larger than the new weights alone.
- A separately named sidecar keeps the old encoder available for rollback. Both
  run with a 1 CPU / 1200 MiB limit, without a published port. No GPU required.
- Full image plus at most three deterministic class-agnostic region proposals.
  Uniform borders use the existing crop; clutter uses compact Lab components.
  Proposals never assign a product category. The catalogue embeddings rank them.
- Each crop is independent: a workshop background cannot dilute a good object
  crop. The full image remains a candidate. Manual selection is applied before
  proposals, so no part outside the owner's selected region is searched.
- The proposed region with the highest top-candidate score drives the returned
  region and geometric comparison. Similarity and ORB/OCR never certify a SKU,
  physical size, compatibility or stock.
- Moderate MobileCLIP candidates (0.55–0.65 by default) must be supported by
  at least two distinct image URLs bound unambiguously to the same active family.
  One isolated texture match cannot activate a family or its model cards. Scores
  are not raised by this check. Single-photo evidence requires at least 0.65.
- Initial MobileCLIP threshold: 0.55, independently configurable. This is a
  retrieval threshold, **not** a calibrated probability. Do not reuse another
  model's threshold or claim general accuracy from one photograph.
- A new namespace `catalog_visual_mobileclip2-s0-095906d2-fp32-pad-256-v1`
  rebuilds the derived index. Existing DINO vectors and business data are retained.
  Search reports preparation until the new index is complete.

For the owner's bind-mounted VPS, after this change is merged:

```bash
cd /opt/sanatpish
sudo sanatpish-deploy-main
sudo bash ops/upgrade-local-vision-mobileclip.sh --app sanatpish-app
sudo sanatpish-deploy-main
curl --noproxy '*' -fsS --max-time 15 http://127.0.0.1:3013/api/ai/local-vision-status
```

The first deployment installs compatible app code while keeping the existing
encoder selected. The helper builds the new image using the reachable probed
PyPI mirror, verifies health and real authenticated inference, backs up the private
configuration, then atomically selects the new service for the next restart.
Failure before that switch leaves the private configuration unchanged. It neither
rewrites the owner's deploy command nor changes Nginx, database schemas, voice
configuration or the app container. The second normal deployment activates it.
Wait for `pipeline: local-lens-v3`, the new model ID and `ready: true` before testing.
A successful container health check alone does not prove catalogue accuracy.

Rollback: copy the exact `CONFIG_ROLLBACK` path printed by the helper back to
`/opt/sanatpish/.env.local-vision`, preserving its 0600 permissions, then run the
same `sudo sanatpish-deploy-main`. The old DINO sidecar and vector namespace remain.
Do not remove either sidecar until live acceptance has passed.

Real-photo regression is opt-in and keeps customer images/exports outside git:

```bash
LOCAL_VISION_ENCODER=mobileclip2-s0 \
LOCAL_VISION_TEST_MODEL_DIR=/path/to/local/image-model \
LOCAL_VISION_TEST_PYTHON=/path/to/venv/bin/python \
LOCAL_VISION_OWNER_CASE=/path/to/owner-case.json \
node --import tsx --test tests/local-vision-owner-photo.test.ts
```

The manifest names `corpusFile`, `productsFile`, `imagesDirectory` and `cases`.
Each case has `name`, `image`, optional normalized `region`, and `expectedFamily`;
negative cases omit `expectedFamily`, and a blank negative uses `blank: true`.
Paths resolve relative to the manifest. Require at least 100 real catalogue images
and both positive and negative cases. The test runs the actual offline Python
worker, Node image preparation, full-index retrieval and multiple real product
cards. It prints bounded diagnostic scores/timing; it does not contact production.

The DINO documentation below describes the retained original profile.

## Model and resources

- Official model: https://huggingface.co/facebook/dinov2-small
- Revision: `ed25f3a31f01632728cabb09d1542f84ab7b0056` (pinned).
- Public downloadable weights; no account, access request, API key or download token
  is required. The model is distributed under Apache 2.0.
- CPU-only PyTorch, one inference thread, one request at a time, no public port.
- Runtime is capped at 1 CPU and 1200 MiB RAM. This is a resource limit, not a
  measured guarantee. OOM/startup or latency failures require measurement/tuning.
- Provisioning needs additional disk for the Python image, CPU dependencies,
  model and build cache. Do not confuse the ~22M-parameter weights with total
  Docker/runtime size. No GPU required. Do not promise 40 concurrent requests.
- Serving is offline; only provisioning downloads dependencies/weights.

## Data and ranking — Lens-inspired local pipeline

Existing authoritative `catalog_families`/`catalog_variants` adapters and the
current gallery/image corpus are reused. No table, migration, stock record or
business identifier is created or replaced. Derived 384-dimensional vectors are
stored through the existing private `app_private.scoped_documents` cache under a
model/revision/preprocessing-specific namespace. No pgvector extension is needed
for this catalogue scale. Gemini's 768-dimensional vectors remain separate.

Catalogue photographs are EXIF-oriented, square-padded, rescaled to 224 pixels
and ImageNet-normalized. Normalized CLS vectors remain compatible with the
previous public DINOv2 index. No catalogue-vector migration/rebuild is required
solely for this pipeline change; changed photos/revisions still invalidate coverage.

The query path now has these bounded stages:

1. A customer can tap a point on the original, EXIF-oriented image. The private
   sidecar uses click-seeded GrabCut to extract the connected object around that
   point and returns a normalized crop rectangle. The inline selector supports
   pointer/touch and keyboard activation; it never asks the customer to draw a box.
2. Full-frame query plus up to three bounded object-region proposals. The proposal
   stage combines border-foreground and Lab connected-component candidates, then
   refines each candidate around its center with click-seeded GrabCut when overlap
   and area checks pass. Segmentation is bounded to a 384px working image to limit
   CPU cost. These remain class-agnostic proposals, **not a trained industrial
   detector or semantic segmentation model**. Catalogue similarity chooses the
   best crop; the system does not assume the largest or central object is correct.
3. The interface shows automatic proposals and the currently selected crop. A tap
   anywhere on the photo sends its normalized point to the private sidecar. GrabCut
   segments the connected object under that point; a valid result replaces the crop
   and its embedding is recomputed from that exact crop before search. If the tap
   lands on background or segmentation is uncertain, the API rejects it and keeps
   the previous selection. There is no drag-to-draw path. Crop bytes remain
   server-side and are prepared from the same temporary in-memory image.
4. DINOv2 retrieval compares the full frame and up to three crop views (at most
   four query encodes). Its existing conservative score rule is retained: the
   stronger of the full-frame score and a 25% full-frame / 75% best-crop blend.
   It does not switch DINOv2 to an unweighted maximum across four views. The
   independent-view maximum remains specific to the MobileCLIP pipeline. The
   model identity and catalogue-vector space are unchanged; indexing remains
   asynchronous and incremental.
5. Up to six best catalogue photos are compared with ORB keypoints and a bounded
   RANSAC homography. Distributed inliers provide an additional ranking signal.
   Textureless parts may have no evidence; missing evidence is not proof of a
   mismatch. A shared logo/tiny patch is rejected by spatial coverage checks.
   No geometric score proves physical compatibility or unique SKU identity.
6. Local Tesseract English OCR reads sparse Latin industrial markings, with an
   800 ms process timeout. Only code-like tokens with reported confidence >=85
   are retained. OCR remains fallible; Persian descriptions and unreadable engraving
   are not reliably handled by this engine. OCR failure/timeout is disclosed.
7. Real active inventory codes are compared with the OCR text. Unique code
   suggestions require a visually eligible family and remain unconfirmed product
   candidates. Ambiguous normalized codes never select an arbitrary SKU. Code and
   geometry bonuses cannot rescue a photo below the base visual threshold.
8. The raw photo gallery is diversified to at most two photos per family grouping.
   The product/model list is generated independently from all retrieved eligible
   hits, so this photo-gallery limit cannot hide additional matching models in
   the same family. Close top family scores remain explicitly ambiguous.

Current active image bindings determine the photo/family links. Family photos do
not choose an arbitrary size. Similarity and OCR candidates never enter the exact
match list. No stock, material, hidden dimension or engineering substitute is
inferred from appearance alone. Scores are ranking values, not probabilities.
No-match asks for more information rather than asserting absence or promising
custom manufacture. Customer-selected regions do not replace stored source photos.

Incomplete current image-index coverage still returns an explicit 503/progress
instead of silently searching a subset. Geometric/OCR degradation is disclosed,
and Gemini is never used as a hidden fallback.

`LOCAL_VISION_MIN_SIMILARITY=0.65` is an **unvalidated initial threshold**. Tune it
against owner-labelled customer photos, including out-of-catalogue objects and
near-identical parts, before production activation. Generic benchmarks do not
establish industrial catalogue accuracy. The server takes one local image query
at a time and returns 429 to additional simultaneous queries, avoiding an
unbounded CPU queue. Encoder requests have a 4.5-second timeout; this is not an
end-to-end five-second service guarantee.

## Provision once, then keep the existing deployment command

After this change is merged into main, fetch the exact source without overwriting
local production files:

```bash
cd /opt/sanatpish
git fetch origin main
VISION_SETUP_DIR=$(mktemp -d /tmp/sanatpish-vision-setup.XXXXXXXX)
git archive FETCH_HEAD services/local-vision ops/setup-local-vision-vps.sh | tar -xf - -C "$VISION_SETUP_DIR"
sudo bash "$VISION_SETUP_DIR/ops/setup-local-vision-vps.sh" --app sanatpish-app
rm -rf -- "$VISION_SETUP_DIR"
```

The setup script downloads public pinned weights without authentication. It creates
`/opt/sanatpish/.env.local-vision` (0600). A private service credential is generated
automatically for communication between the app and encoder on your own server;
it is not a provider token and needs no purchase, registration or manual entry.
The setup script does **not** activate production; the existing pipeline remains selected.

First reconcile actual production family/SKU image bindings and verify local
retrieval with owner-labelled photos on an isolated staging database/app. Then:

```bash
sudo touch /opt/sanatpish/.local-vision-enabled
sudo sanatpish-deploy-main
```

The deployment script reuses the isolated CPU sidecar on the application's Docker
network, verifies model identity/authenticated embedding, and passes the local
configuration to the new canary. It waits up to ten minutes for complete index
coverage before promotion; failures preserve the old serving application.
It never publishes the encoder port. Existing
fixed-port canary checks and rollback remain in place. The model is built once, not with
every application release. Initial background catalogue indexing can take minutes;
customer requests do not trigger a full synchronous rebuild.

Check `GET /api/ai/local-vision-status` for enabled/model/total/indexed/ready and
`docker ps --filter label=com.sanatpish.role=local-vision --format '{{.Names}}'` to list the versioned sidecar and `docker stats --no-stream <container-name>` for actual resource use. Status
contains no credentials. Accuracy and p95 end-to-end latency must be recorded on
real customer photos; passing unit/protocol tests alone is insufficient.

To revert selection, remove the marker and use the same deployment command:

```bash
sudo rm /opt/sanatpish/.local-vision-enabled
sudo sanatpish-deploy-main
```

This restores the default recognition path; it does not delete image bindings or
vectors. The idle sidecar can be stopped after the old local-mode app is retired.

## Verification boundary

Run `npm run lint`, `npm run test:database`, `npm run test:portal`, `npm run build`,
and `node --import tsx --test tests/catalog-visual-index.test.ts tests/local-vision.test.ts`.
Python: install the pinned CPU torch/requirements in a temporary venv and run
`python -m unittest discover -s services/local-vision -p 'test_*.py'`. Python tests execute actual DINOv2 layers with random test weights by default.
Set `LOCAL_VISION_TEST_MODEL_DIR` to the locally downloaded model directory to run
the same tests with the trained weights and `HF_HUB_OFFLINE=1`. These tests verify
preprocessing, normalized embeddings, auth, request limits and protocol; they do
not establish catalogue recognition accuracy.

The owner's self-hosted database and labelled customer photographs are not available
in the development workspace. Public pinned weights were downloaded with
`token=False` and real-weight inference was tested with offline flags. A warm
224-pixel encode took 154 ms and process peak RSS was 455 MiB in this workspace;
these are baseline single-encode smoke measurements, not the new whole-pipeline
latency, VPS results or a production service guarantee.
No production reconciliation, deployment or industrial recognition accuracy is claimed.

For repeatable staging evaluation, prepare a private JSON manifest:

```json
[
  {"id":"bearing-worn","file":"/private/bearing.jpg","expectedFamily":"REAL_FAMILY_CODE"},
  {"id":"dedicated-code","file":"/private/code.jpg","expectedCode":"REAL_SKU_CODE"},
  {"id":"negative","file":"/private/unrelated.jpg","outOfCatalog":true}
]
```

Run `node scripts/evaluate-local-vision.mjs https://staging.example /private/photos.json`.
It uploads only to that staging application, checks the selected mode, and reports
family/bound-code recall@5, negative rejection, errors, false exact claims and p95
upload-plus-search time. Keep customer photos and manifests out of Git. No label
in this example is a real product code or evidence of model quality.


The original `local-lens-v2` encoder is retained as the rollback sidecar
`sanatpish-local-vision-lens-v2`. Region-proposal updates use a new, versioned
container named `sanatpish-local-vision-lens-v2-regions-<UTC timestamp>` and a
matching versioned image tag. The setup script switches the app's private URL
only after the new container passes its health check; the old container is not
removed automatically.
Re-run one-time setup to build this version and update the private service URL;
no external credentials are requested. The previous encoder can keep serving an
old app until promotion completes. Stop an unused older encoder only after the
old application is retired. Promotion verifies the pipeline version as well as the
model revision. This search operates within this catalogue, not Google's web index,
and is not a reproduction of Google's proprietary Lens implementation.

## Trained pipeline integration test

`tests/local-vision-trained.test.ts` launches the actual private Python worker
with offline flags and public trained weights, builds an isolated two-photo index,
executes the query and geometric comparison endpoints, ranks the results and
checks that only real fixture-bound product codes are returned without exact SKU
claims. Run it explicitly with `LOCAL_VISION_TEST_MODEL_DIR=/path/to/local/model`
and `LOCAL_VISION_TEST_PYTHON=/path/to/venv/bin/python` using
`node --import tsx --test tests/local-vision-trained.test.ts`. It skips when the
local model directory is not supplied. Synthetic fixtures establish protocol and
ranking mechanics, not industrial customer-photo accuracy. Browser pointer/touch
interaction and production-photo accuracy still need staging validation.

## Existing bind-mounted app on the new VPS (port 3013)

For the owner-supplied deployment with `sanatpish-app`, `/opt/sanatpish:/app` and
network `supabase_default`, run the setup script with `--app sanatpish-app`. It
validates the existing app mount/network, starts the private encoder on that same
network and checks readiness. It does not stop/recreate the app, alter Nginx,
change port 3013, modify database connection settings, or enable the feature.

The application can now read `.env.local-vision` on startup only when the explicit
`.local-vision-enabled` marker is present. Loading is limited to local vision
settings; the database, port, Auth and voice providers are preserved. This lets
the existing owner-supplied `sanatpish-deploy-main` script remain the deployment
entrypoint without requiring a replacement app container or secret remount.

Before activation, inspect the full owner deployment script and relevant Nginx
locations. The supplied script deliberately requires `limit_except GET` guards;
unknown placement may block public image-upload/analyze POST endpoints. Do not
remove guards globally or assume their scope from grep output. Source must first
be merged into main and photo bindings/accuracy verified on staging. An unused
encoder can be prepared independently while these checks are completed.

## Restricted package CDN access during provisioning

The owner's VPS can reach official PyTorch but times out on files.pythonhosted.org.
Provisioning now installs `torch==2.8.0+cpu` from the official CPU index with
`--no-deps`, then resolves the CPU wheel's dependencies and the pinned runtime
requirements through one probed HTTPS PyPI mirror. The installed CPU version is
explicitly requested in the second operation so it is not replaced by a CUDA
wheel. `pip check` is required before model download. No extra index or TLS bypass
is configured.

Before building, setup probes the Tsinghua and Aliyun public mirrors in order. It
fetches both the index and a real small filelock wheel, checking its advertised
SHA256. If neither mirror can serve the wheel, setup stops before a long build.
`VISION_PYPI_INDEX_URL` can select a specific HTTPS mirror and is probed in the
same way. This download choice concerns provisioning only; runtime remains local.


## Multiple model results

The local API includes `modelSuggestions`, a bounded list of real active
catalogue models. Independently image-bound SKUs are deduplicated by their best
matching photograph and sorted by full-precision visual evidence. The list is
built independently of the eight-photo gallery, so a family with many images
cannot hide its other matching models.

A real active family-image binding without a SKU code remains eligible even
when that family also contains coded SKUs. It appears as a family-level card with
the registered image, the family-level visual ranking score, and the explicit
label `کد کالا در کاتالوگ ثبت نشده`. No SKU is fabricated. These family-only
visual results participate in the same score ordering as coded visual results,
so a more similar uncoded family photo can rank above a less similar coded model.
Coded SKU siblings remain clearly labelled, unscored family alternatives unless
their own image is independently bound. OCR-only
suggestions follow independently image-ranked results. Inactive families, inactive
SKUs, unbound photos and unregistered codes are excluded from customer results.

This update changes the Python query worker to produce up to three crop proposals
as well as the app/UI. After merge, rebuild the private sidecar once with
`sudo bash ops/setup-local-vision-vps.sh --app sanatpish-app`, then run
`sudo sanatpish-deploy-main`. The DINOv2 weights, model identity, catalogue
embedding vectors, database schema and image bindings remain unchanged; no
database migration, model download or full vector reindex is required. The setup
script starts a versioned sidecar beside the old one, checks its health, and only
then changes the app's private encoder URL. Keep the old container until the
application passes production acceptance. Tests cover multiple object proposals,
no-code family ranking, score order, best-photo dedup, shared-photo ambiguity,
real-code/OCR handling, inactive/weak exclusions and product-card rendering.

## Owner-photo check — 2026-11-07

An isolated offline run used the owner's red coupling-spider workshop photograph
against 463 actual photos attached to public catalogue families (the public
runtime export). Neither customer photo nor catalogue binaries are committed.
With Node's real manual-region preparation and the trained Python worker:

| Case | First attached family | Models returned | Query + rank time in this workspace |
| --- | --- | ---: | ---: |
| Full workshop photo | لاستیک کوپلینگ (`FAM-34435`) | 24 family alternatives | 367 ms |
| Manually selected part | لاستیک کوپلینگ (`FAM-34435`) | 24 family alternatives | 404 ms |
| Blank white photo | No accepted family | 0 | 168 ms |
| Workshop background | No accepted family | 0 | 250 ms |
| Glove without the part | No accepted family | 0 | 251 ms |

The first two catalogue photos for the full frame scored 0.5527/0.5521; the
selected-part run scored 0.6242/0.6227. These are cosine ranking signals, not
probabilities. The glove's isolated textile resemblance was rejected by the
multi-photo family check. This proves this regression and these negative controls,
not general industrial recognition accuracy. Timings exclude uploading, remote
catalogue-image reads, geometric reranking and production VPS/network overhead;
they are not an end-to-end sub-five-second SLA. Browser interaction and the new
Docker image still require on-VPS acceptance after provisioning and reindexing.

## Production index readiness gate

The DINOv2 image vectors are persisted per image in
`app_private.scoped_documents` under the model-specific namespace. Each completed
batch is saved, so a process restart does not discard completed image vectors.
When local vision is enabled, server startup resumes any missing or signature-
changed catalogue images through the existing background warmup. An unreadable
photo no longer stops the batch queue: later images continue to index, the failed
image remains pending, and the background worker retries the still-missing rows
after a cooldown. Coverage stays incomplete until every catalogue image is indexed.

Do not declare the visual-search rollout ready until
`GET /api/ai/local-vision-status` reports `enabled:true`, `ready:true`, and
`indexed === total`. The last confirmed production observation on 2026-11-08
was `412/869` with `ready:false`; that is a partial index, not an accepted
production state. Recheck the live endpoint after deployment and wait for all
869 images to be indexed. The feature returns HTTP 503 rather than silently
searching a partial catalogue.

## Automatic object proposals and strict no-match behavior

Gallery uploads start quick retrieval after upload completes; camera capture
keeps its explicit confirmation. The query worker returns the full-frame view plus
up to three independent crop proposals. The interface overlays those proposals
and the current crop on the original photo. A tap anywhere on the photo sends the
normalized point to click-seeded GrabCut; a valid connected object crop replaces
the current selection and its embedding is recomputed before retrieval. A
background/uncertain tap is rejected and preserves the previous selection.
Customers cannot draw or resize rectangles. Selection changes debounce for 300 ms
in the results view, and stale requests cannot replace results after another
photo is selected or the modal closes. Automatic proposals remain heuristic crop candidates. Tap selection uses
click-seeded GrabCut, not a semantic industrial detector or a pixel-perfect
segmentation model; low contrast, occlusion, and similarly colored backgrounds
can still cause a rejection or an imperfect crop.

Every indexed catalogue vector is scored for every query view. Only hits attached
to a real active catalogue family and above the visual threshold can become
customer-facing photo or model results. Unbound catalogue images are not exposed
as products. Family-bound images without a SKU-specific binding remain eligible at family
level, even when active coded variants exist; the family result carries the
visual score while its individual SKU siblings remain unscored. If no exact or meaningful similar family/model passes
the threshold, the customer sees no product cards and is offered expert review
instead. The UI explicitly disables the nearest-neighbour exploration list; it
does not fill an empty result page with unrelated products.

An incomplete index still fails explicitly; missing/unindexed photos are never
silently counted as compared. The query uses precomputed catalogue features
rather than rerunning a generative model over every catalogue image for each
customer request.

Browser pointer/touch/keyboard tap smoke for the source selector:
`node scripts/tests/image-region-interaction.cjs` (requires Playwright Chromium).
The browser smoke also mounts the actual search modal with isolated identity/cart
hooks and mocked HTTP responses. It verifies upload-triggered automatic search,
tap-triggered requery, whole-image reset and reuse of the same uploaded image.
This proves client interaction and request wiring, not model accuracy or a live
production deployment.
