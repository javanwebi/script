import assert from "node:assert/strict";

const old = "http://" + process.env.OLD_HOST + ":3000";
const candidate = "http://127.0.0.1:3000";

async function get(base, route) {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(80000) });
  assert.equal(response.status, 200, base + route + " HTTP " + response.status);
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
  "/api/catalog/product-images/assign",
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
