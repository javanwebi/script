# Local catalogue image retrieval (DINOv3 Small+)

This is an opt-in CPU retrieval path, not a generative vision agent. When
`PART_RECOGNITION_MODE=local-embedding`, image requests to `/api/ai/analyze-part`
return directly through the local encoder and never call Gemini or the Worker.
Other FORZA voice/chat providers are unaffected.

## Model and resources

- Official model: https://huggingface.co/facebook/dinov3-vits16plus-pretrain-lvd1689m
- Revision: `c93d816fc9e567563bc068f01475bec89cc634a6` (pinned).
- Meta DINOv3 licence/access acceptance is required. Obtain a Hugging Face **read**
  token on the approved account. This is download authentication, not a paid API.
- CPU-only PyTorch, one inference thread, one request at a time, no public port.
- Runtime is capped at 1 CPU and 1200 MiB RAM. This is a resource limit, not a
  measured guarantee. OOM/startup or latency failures require measurement/tuning.
- Provisioning needs additional disk for the Python image, CPU dependencies,
  model and build cache. Do not confuse the ~29M-parameter weights with total
  Docker/runtime size. No GPU required. Do not promise 40 concurrent requests.
- Serving is offline; only provisioning downloads dependencies/weights.

## Data and ranking

Existing authoritative `catalog_families`/`catalog_variants` adapters and the
current gallery/image corpus are reused. No table, migration, stock record or
business identifier is created or replaced. Derived 384-dimensional vectors are
stored through the existing private `app_private.scoped_documents` cache under a
model/revision/preprocessing-specific namespace. No pgvector extension is needed
for this catalogue scale. Gemini's 768-dimensional vectors remain separate.

Each image is EXIF-oriented and reduced by Sharp, square-padded without cropping,
rescaled/antialiased to 224 pixels and ImageNet-normalized; normalized CLS vectors
are compared by cosine similarity against the complete current image index.
Only current image IDs/revisions are ranked. New/edited images invalidate coverage;
background indexing resumes saved batches. An incomplete index returns an explicit
503 and progress instead of silently searching a subset or invoking Gemini.

Top image matches retain current active family and SKU bindings. A family photo
links to the family page and its sizes, never an arbitrarily chosen SKU. Only
explicitly image-bound active SKUs produce product cards. Photo similarity alone
never establishes an exact SKU, size, stock, material or technical substitute.
Scores are ranking scores, not calibrated confidence percentages. There is no OCR
or measurement-based refinement in this version. No-match requests ask for more
information rather than asserting absence/custom manufacture feasibility.

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

The setup script reads the HF token silently from the terminal, passes it as a
BuildKit secret, and removes the temporary file. It does not write the download
token into Git, Docker arguments, image environment or application configuration.
It creates `/opt/sanatpish/.env.local-vision` (0600) with a separate private service
token. Do not copy these credentials into chat. The setup script does **not**
activate production; the existing pipeline remains selected.

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
`docker stats --no-stream sanatpish-local-vision` for actual resource use. Status
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
`python services/local-vision/test_worker.py`. Python tests execute actual DINOv3
layers with random test weights to verify preprocessing, normalized embeddings,
auth, request limits and protocol. They do not test trained-model accuracy.

Gated trained weights and the owner's self-hosted database are not available in
the development workspace. No real-weight inference, production reconciliation,
production deployment, measured RAM or industrial recognition accuracy is claimed.

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
