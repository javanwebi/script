import assert from "node:assert/strict";

const old = "http://" + process.env.OLD_HOST + ":3000";
const candidate = "http://127.0.0.1:3000";

async function get(base, route) {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(80000) });
  const detail = response.ok ? "" : await response.clone().text().catch(() => "");
  assert.equal(
    response.status,
    200,
    base + route + " HTTP " + response.status + (detail ? " BODY " + detail.slice(0, 500) : ""),
  );
  return response;
}

async function json(base, route) {
  return (await get(base, route)).json();
}

const health = await json(candidate, "/api/health");
assert.equal(health.database, "ok");

const sttResponse = await get(candidate, "/api/ai/forza-stt-info");
assert.ok(sttResponse.headers.get("content-type")?.includes("application/json"));
const stt = await sttResponse.json();
assert.equal(stt.serverSttConfigured, true);
assert.equal(stt.serverSttProvider, "diba");
assert.equal(stt.serverSttReady, true);
console.log("FORZA_STT_CANARY_DIBA_READY_OK provider=" + stt.serverSttProvider);

const browserModel = await fetch(candidate + "/forza-runtime/stt/diba-stt-fa-small-c244182d.tar.gz", {
  method: "HEAD",
  signal: AbortSignal.timeout(15000),
});
assert.equal(browserModel.status, 200, "DIBA_BROWSER_MODEL_HTTP_" + browserModel.status);
assert.match(browserModel.headers.get("content-type") || "", /application\/gzip/i);
assert.ok(Number(browserModel.headers.get("content-length") || 0) > 0,
  "DIBA_BROWSER_MODEL_CONTENT_LENGTH_MISSING");
console.log("PRIVATE_CANARY_DIBA_BROWSER_MODEL_OK bytes=" + browserModel.headers.get("content-length"));

const voskScript = await fetch(candidate + "/forza-runtime/stt/vosk.js", {
  method: "HEAD",
  signal: AbortSignal.timeout(15000),
});
assert.equal(voskScript.status, 200, "DIBA_BROWSER_VOSK_SCRIPT_HTTP_" + voskScript.status);
assert.match(voskScript.headers.get("content-type") || "", /javascript/i);
assert.ok(Number(voskScript.headers.get("content-length") || 0) > 1_000_000,
  "DIBA_BROWSER_VOSK_SCRIPT_CONTENT_LENGTH_MISSING");
console.log("PRIVATE_CANARY_DIBA_BROWSER_VOSK_SCRIPT_OK bytes=" + voskScript.headers.get("content-length"));

// Probe real, protected mutation handlers without an authenticated session.
// A correct endpoint rejects an anonymous write with JSON 401/403. An absent
// endpoint typically returns 404 HTML, which previously broke CRM and image
// mapping clients. Never send a customer payload or perform a test mutation.
for (const route of [
  "/api/admin/crm/customers",
  "/api/catalog/sku-transfer",
  "/api/catalog/direct-skus",
  "/api/catalog/menu-family-assignment",
  "/api/catalog/product-images/upload",
  "/api/catalog/category-images/upload",
]) {
  const upload = route.includes("/images/upload");
  const response = await fetch(candidate + route, {
    method: "POST",
    headers: {"Content-Type": upload ? "image/png" : "application/json"},
    body: upload ? new Uint8Array([0]) : "{}",
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(response.status === 401 || response.status === 403,
    `API_ROUTE_MISSING_OR_UNPROTECTED ${route}: HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") || "", /application\/json/,
    `API_RETURNED_NON_JSON ${route}`);
  const denied = await response.json();
  assert.equal(denied.success, false, `API_DENIAL_CONTRACT_FAILED ${route}`);
  console.log("PROTECTED_API_CONTRACT_OK", route, response.status);
}

const missingApi = await fetch(candidate + "/api/__contract_missing_route__", {
  signal: AbortSignal.timeout(15000),
});
assert.equal(missingApi.status, 404, "UNEXPECTED_MISSING_API_STATUS");
assert.match(missingApi.headers.get("content-type") || "", /application\/json/);
const missingBody = await missingApi.json();
assert.equal(missingBody.code, "API_NOT_FOUND");
console.log("API_NOT_FOUND_JSON_CONTRACT_OK");

const groups = await json(candidate, "/api/catalog/navigation-groups");
assert.ok(groups.success && Array.isArray(groups.groups) && groups.groups.length >= 6);

const categoryCatalog = await json(candidate, "/api/catalog/categories");
assert.ok(
  categoryCatalog.success && Array.isArray(categoryCatalog.categories),
  "PUBLIC_CATALOG_CATEGORIES_RESPONSE_INVALID",
);
const approvedCategories = categoryCatalog.categories.filter(category =>
  category?.active === true &&
  category?.menuSource === "industrial_megamenu_hierarchy_v2" &&
  /^excel-v2-[0-9]+-[0-9]+$/.test(String(category?.slug || "")),
);
assert.ok(
  approvedCategories.length >= 34,
  "PUBLIC_CATALOG_CATEGORIES_INCOMPLETE: expected at least 34 approved categories, received " + approvedCategories.length,
);
const approvedCategorySlugs = new Set(approvedCategories.map(category => category.slug));
assert.equal(approvedCategorySlugs.size, approvedCategories.length,
  "PUBLIC_CATALOG_CATEGORIES_DUPLICATE_SLUG");
assert.ok(approvedCategories.every(category =>
  typeof category.name === "string" && category.name.trim().length > 0 &&
  Number.isInteger(category.familyCount) && category.familyCount >= 0 &&
  Number.isInteger(category.directSkuCount) && category.directSkuCount >= 0 &&
  Number.isInteger(category.skuCount) && category.skuCount >= 0
), "PUBLIC_CATALOG_CATEGORIES_INVALID_FIELDS");
console.log("PUBLIC_CATALOG_CATEGORIES_API_OK", approvedCategories.length);


// Belt catalogue release gate: compare the published totals with both
// catalogue sources. A category may legitimately contain direct SKUs without
// any published family (for example, the welded CRC category); do not reject
// that valid state by requiring familyCount > 0.
// At least one real family or direct SKU must exist in each published belt category.
for (const slug of ["excel-v2-1-1","excel-v2-1-2","excel-v2-1-3","excel-v2-1-4"]) {
  const summary = approvedCategories.find(category => category.slug === slug);
  assert.ok(summary, "BELT_CATEGORY_MISSING: " + slug);
  assert.ok(summary.familyCount > 0 || summary.directSkuCount > 0,
    "BELT_CATEGORY_HAS_NO_FAMILIES_OR_DIRECT_SKUS: " + slug);
  assert.ok(summary.skuCount > 0,
    "BELT_CATEGORY_ZERO_SKUS: " + slug);

  const detail = await json(candidate, "/api/catalog/menu-category/" + slug);
  assert.ok(detail.success && detail.category?.slug === slug &&
    Array.isArray(detail.families),
    "BELT_CATEGORY_DETAILS_INVALID: " + slug);
  assert.equal(detail.families.length, summary.familyCount,
    "BELT_CATEGORY_FAMILY_COUNT_MISMATCH: " + slug);

  const direct = await json(candidate,
    "/api/catalog/direct-skus?categorySlug=" + encodeURIComponent(slug));
  assert.ok(direct.success && Array.isArray(direct.items),
    "BELT_CATEGORY_DIRECT_SKUS_INVALID: " + slug);
  assert.equal(direct.items.length, summary.directSkuCount,
    "BELT_CATEGORY_DIRECT_SKU_COUNT_MISMATCH: " + slug);
  const directCodes = direct.items.map(item => String(item.skuCode || ""));
  assert.ok(directCodes.every(Boolean), "BELT_CATEGORY_DIRECT_SKU_CODE_MISSING: " + slug);
  assert.equal(new Set(directCodes).size, directCodes.length,
    "BELT_CATEGORY_DIRECT_SKU_DUPLICATE: " + slug);

  const liveFamilySkuCount = detail.families.reduce(
    (total, family) => total + Math.max(0, Number(family.skuCount) || 0), 0);
  const liveTotalSkuCount = liveFamilySkuCount + direct.items.length;
  assert.equal(summary.skuCount, liveTotalSkuCount,
    "BELT_CATEGORY_SKU_COUNT_MISMATCH: " + slug);

  console.log("PRIVATE_CANARY_BELT_CATEGORY_OK",
    slug, "families=" + detail.families.length,
    "directSkus=" + direct.items.length, "totalSkus=" + liveTotalSkuCount);
}

for (const [route, key] of [
  ["/api/catalog/home-categories", "categories"],
  ["/api/catalog/home-preview", "products"],
]) {
  const data = await json(candidate, route);
  assert.ok(data.success && Array.isArray(data[key]) && data[key].length > 0);
}

function index(runtime) {
  assert.ok(runtime.success && Array.isArray(runtime.products));
  return {
    families: runtime.products.map(p => p.code).sort(),
    variants: runtime.products.flatMap(p => (p.variants || []).map(v => p.code + "/" + v.code)).sort(),
  };
}

const previous = index(await json(old, "/api/runtime"));
const next = index(await json(candidate, "/api/runtime"));
assert.deepEqual(next, previous, "CATALOG_DATABASE_PARITY_FAILED");
const html = await (await get(candidate, "/")).text();
assert.match(html, /\/assets\/[^"]+\.js/);
console.log("PRIVATE_CANARY_CATALOG_AND_ASSETS_OK", next.families.length, next.variants.length);
