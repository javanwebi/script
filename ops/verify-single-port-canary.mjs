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
assert.equal(typeof stt.serverSttConfigured, "boolean");
assert.ok(["none", "gemini", "diba"].includes(stt.serverSttProvider));
console.log("FORZA_STT_CANARY_API_JSON_OK provider=" + stt.serverSttProvider);

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
