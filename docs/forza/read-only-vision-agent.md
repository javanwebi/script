# FORZA read-only Vision Agent (experimental, opt-in)

## Runtime switch
Set `PART_RECOGNITION_MODE=read-only-agent` on the **backend only**. Default mode is unchanged. Needs `AI_FORZA_API_KEY` (or the existing `GEMINI_API_KEY`), `VISION_IMAGE_PUBLIC_ORIGIN=https://<public-backend>`, and optionally `FORZA_VISION_AGENT_MODEL=gemini-flash-latest`, `FORZA_VISION_AGENT_MAX_CALLS=5` (1-8).

## Data flow
1. React uploads image to Express; Express stores an opaque JPEG link under `/imageai`.
2. Express refreshes the existing DB-backed corpus from Supabase; nothing is changed in the database. It starts the recognition job and passes a public HTTPS **image URL** to Gemini as `fileData`.
3. The model can request only `browse_catalog` (paginated catalog image IDs), `inspect_catalog_images` (real image input by server-issued catalog URL), and `get_catalog_product` (real SKU specs, no commercial fields). These are in-process, allowlisted reads over the server's database-backed catalog; the model receives neither SQL execution nor DB credentials.
4. On receiving `inspect_catalog_images`, Express provides each requested image to the model as an actual image part. Labels and URLs alone do not count as inspected.
5. The result is validated against **inspected** catalog image IDs. SKU codes survive validation only when the photo-to-SKU binding is explicitly identity-verified and corresponds to a current real SKU.
6. The usual `202` recognition job and polling response sends `catalogImageMatches` to the existing React search UI. No fabricated exact-match or out-of-stock claim is allowed.

## Billing and coverage warning
One client upload starts one recognition *job*, NOT one billable Gemini request. Interactive tool use needs another `generateContent` after tool results are returned. Calls are bounded; `visionAgentMetrics.modelCalls` records the actual count. A zero-additional-model-call architecture cannot let a remote model first see the customer photo, then decide which additional database photos to see, and then compare their pixels. Do not promise a fixed per-photo invoice.

The agent does not use Embedding, random 12-photo picking, or product-family-only matching. It can browse the entire catalog, but a short bounded run cannot guarantee inspection of all images. `scanCoverage.complete` must be false unless every image was really inspected. Speed and accuracy must be benchmarked with real photographs before production promotion.

## Security / runbook
- Store key only as Railway server variable, never in GitHub or Vite frontend.
- Rotate any key shared in chat or another public context.
- The only allowed tools are predefined catalog reads, no arbitrary SQL, DDL, DML, or access to customer data.
- The agent is read-only at its tool boundary; use dedicated PostgreSQL SELECT-only credentials for stronger defense in depth if direct DB access is added in future.
- Test with an identical catalog image, changed angle, worn photo, out-of-catalog part, ambiguous variants, newly updated catalog image, and concurrent uploads.
- Keep `PART_RECOGNITION_MODE` unset (or `legacy`) for rollback.
