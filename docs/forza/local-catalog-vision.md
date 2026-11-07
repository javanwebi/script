# Local catalogue image retrieval (DINOv2 Small)

This is an opt-in CPU retrieval path, not a generative vision agent. When
`PART_RECOGNITION_MODE=local-embedding`, image requests to `/api/ai/analyze-part`
return directly through the local encoder and never call Gemini or the Worker.
Other FORZA voice/chat providers are unaffected.

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

1. Optional customer-selected normalized rectangle, applied after EXIF orientation.
   The inline region selector supports pointer/touch and keyboard editing. It is
   only displayed when the local pipeline advertises support.
2. Full-frame query plus one automatic foreground crop on consistent backgrounds.
   The crop is a conservative border-colour/component heuristic, **not a general
   object detector or segmentation model**. Cluttered borders yield no automatic
   crop; the customer can select the part manually. Full-frame candidates remain.
3. DINOv2 retrieval using full-frame and cropped-view scores. At most two neural
   query encodes are performed; indexing remains asynchronous and incremental.
4. Up to six best catalogue photos are compared with ORB keypoints and a bounded
   RANSAC homography. Distributed inliers provide an additional ranking signal.
   Textureless parts may have no evidence; missing evidence is not proof of a
   mismatch. A shared logo/tiny patch is rejected by spatial coverage checks.
   No geometric score proves physical compatibility or unique SKU identity.
5. Local Tesseract English OCR reads sparse Latin industrial markings, with an
   800 ms process timeout. Only code-like tokens with reported confidence >=85
   are retained. OCR remains fallible; Persian descriptions and unreadable engraving
   are not reliably handled by this engine. OCR failure/timeout is disclosed.
6. Real active inventory codes are compared with the OCR text. Unique code
   suggestions require a visually eligible family and remain unconfirmed product
   candidates. Ambiguous normalized codes never select an arbitrary SKU. Code and
   geometry bonuses cannot rescue a photo below the base visual threshold.
7. The raw photo gallery is diversified to at most two photos per family grouping.
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
sudo bash "$VISION_SETUP_DIR/ops/setup-local-vision-vps.sh"
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
`docker stats --no-stream sanatpish-local-vision-lens-v2` for actual resource use. Status
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


The `local-lens-v2` encoder has a separate container/image identity
`sanatpish-local-vision-lens-v2` / `sanatpish-local-vision:dinov2-small-lens-v2`.
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

The local API now includes `modelSuggestions`, a bounded list of up to 24 real
active catalogue models. Independently image-bound models are deduplicated by SKU
using their best matching photo, and sorted by the full-precision visual ranking
score. This considers all retrieved eligible images, not just the eight displayed
photo matches. More than two models from one family can appear. The frontend
renders twelve model cards initially, with a button for the remaining returned
models and links to the complete family catalogue.

Each card carries its real code, model/size, available technical specifications,
and registered image. Visual models show their individual ranking score. Unique
OCR-only suggestions follow independently image-ranked results. Other existing
models from the closest eligible families are displayed as family alternatives,
round-robin across families. Their own registered photo is used when available;
otherwise a family representative is clearly labelled. No independent visual
score is assigned to shared-photo or family-only alternatives, and no photo is
invented when none is registered. Unrelated/inactive families, inactive SKUs and
unregistered codes are excluded. The exact-match list remains unchanged/empty
without identity evidence.

This is an application/UI update. It needs only `sudo sanatpish-deploy-main` after
merge, no Python image rebuild, new model download, database migration, or full
vector reindex. Existing derived DINOv2 vectors are reused. Tests cover five
independently photographed models in one family, score order, best-photo dedup,
shared-photo ambiguity, real-code/OCR handling, inactive/weak exclusions, bounded
alternatives, and server-rendered product cards.
