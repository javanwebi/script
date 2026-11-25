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

// The voice-info endpoint resolves the exact provider used by a voice turn
// and verifies the private Nima runtime. Do not promote a canary whose UI
// would accept a call but cannot produce an AvalAI-backed incremental reply.
let voiceInfo;
for (let attempt = 1; attempt <= 20; attempt++) {
  voiceInfo = await json(candidate, "/api/ai/forza-voice-info");
  assert.equal(voiceInfo.textProvider, "avalai", "FORZA_VOICE_TEXT_PROVIDER_NOT_AVALAI");
  assert.equal(voiceInfo.textProviderConfigured, true, "FORZA_VOICE_TEXT_PROVIDER_NOT_CONFIGURED");
  assert.ok(typeof voiceInfo.textModel === "string" && voiceInfo.textModel.trim(),
    "FORZA_VOICE_TEXT_MODEL_MISSING");
  assert.equal(voiceInfo.voice, "piper-nima-gyro-medium", "FORZA_PRIVATE_VOICE_NOT_NIMA");
  assert.equal(voiceInfo.incrementalSpeech, true, "FORZA_NIMA_INCREMENTAL_SPEECH_DISABLED");
  if (voiceInfo.ready === true) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert.equal(voiceInfo?.ready, true, "FORZA_PRIVATE_VOICE_NOT_READY");
console.log("FORZA_VOICE_CANARY_AVALAI_READY_OK model=" + voiceInfo.textModel +
  " voice=" + voiceInfo.voice);

let stt;
for (let attempt = 1; attempt <= 40; attempt++) {
  stt = await json(candidate, "/api/ai/forza-stt-info");
  if (stt.serverSttConfigured === true &&
      stt.serverSttProvider === "avalai" &&
      stt.serverSttReady === true &&
      stt.serverSttFallbackProvider === "diba" &&
      stt.serverSttFallbackReady === true) break;
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.equal(stt?.serverSttConfigured, true);
assert.equal(stt?.serverSttProvider, "avalai");
assert.equal(stt?.serverSttReady, true);
assert.equal(stt?.serverSttFallbackProvider, "diba");
assert.equal(stt?.serverSttFallbackReady, true);
console.log("FORZA_STT_CANARY_AVALAI_READY_DIBA_FALLBACK_OK provider=" +
  stt.serverSttProvider + " fallback=" + stt.serverSttFallbackProvider);

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

// Verify the POPD reference catalogue against the exact database inherited
// from the currently serving VPS container. This catches a missing JSON archive
// before the candidate can replace the live website.
console.log("===== POPD REFERENCE CATALOGUE CANARY =====");
const referenceStatus = await json(candidate, "/api/catalog/reference/status");
assert.equal(referenceStatus.sourcePath, "github/javanwebi/POPD/server/data/engineeredCatalog.json",
  "POPD_REFERENCE_ARCHIVE_SOURCE_MISMATCH");
assert.ok(referenceStatus.familyCount >= 492, "POPD_REFERENCE_FAMILY_COUNT_BELOW_AUDITED_BASELINE");
assert.ok(referenceStatus.skuCount >= 10308, "POPD_REFERENCE_SKU_COUNT_BELOW_AUDITED_BASELINE");
assert.ok(referenceStatus.categoryCount >= 40, "POPD_REFERENCE_CATEGORY_COUNT_BELOW_AUDITED_BASELINE");
assert.ok(referenceStatus.groupCount >= 14, "POPD_REFERENCE_GROUP_COUNT_BELOW_AUDITED_BASELINE");
assert.ok(Number.isInteger(referenceStatus.quarantinedSkuCount) && referenceStatus.quarantinedSkuCount >= 0,
  "POPD_REFERENCE_QUARANTINE_COUNT_INVALID");
assert.ok(referenceStatus.rawDirectSkuCount >= 678, "POPD_REFERENCE_DIRECT_AUDIT_COUNT_BELOW_AUDITED_BASELINE");
assert.equal(referenceStatus.standaloneDirectSkuRows, 0, "POPD_REFERENCE_DUPLICATE_DIRECT_SKU_ROWS");
assert.ok(referenceStatus.verifiedFamilyImageCount >= 479, "POPD_REFERENCE_FAMILY_IMAGE_COUNT_BELOW_AUDITED_BASELINE");
assert.ok(referenceStatus.verifiedVariantImageCount >= 137, "POPD_REFERENCE_SKU_IMAGE_COUNT_BELOW_AUDITED_BASELINE");
assert.ok(typeof referenceStatus.sourceSha256 === "string" && referenceStatus.sourceSha256.length >= 32,
  "POPD_REFERENCE_ARCHIVE_SHA_MISSING");
console.log("POPD_REFERENCE_STATUS_OK",
  "families=" + referenceStatus.familyCount,
  "skus=" + referenceStatus.skuCount,
  "categories=" + referenceStatus.categoryCount,
  "groups=" + referenceStatus.groupCount,
  "familyImages=" + referenceStatus.verifiedFamilyImageCount,
  "skuImages=" + referenceStatus.verifiedVariantImageCount);

const [referenceCategoryPayload, referenceGroupPayload] = await Promise.all([
  json(candidate, "/api/catalog/reference/categories"),
  json(candidate, "/api/catalog/reference/navigation-groups"),
]);
const referenceCategories = referenceCategoryPayload.categories;
const referenceGroups = referenceGroupPayload.groups;
assert.ok(referenceCategoryPayload.success && Array.isArray(referenceCategories) &&
  referenceCategories.length === referenceStatus.categoryCount && referenceCategories.length >= 40,
  "POPD_REFERENCE_CATEGORIES_INVALID");
assert.ok(referenceGroupPayload.success && Array.isArray(referenceGroups) &&
  referenceGroups.length === referenceStatus.groupCount && referenceGroups.length >= 14,
  "POPD_REFERENCE_GROUPS_INVALID");
const referenceCategorySlugs = new Set(referenceCategories.map(category => category.slug));
assert.equal(referenceCategorySlugs.size, referenceCategories.length, "POPD_REFERENCE_DUPLICATE_CATEGORY_SLUG");
assert.ok(referenceCategories.every(category =>
  category.active === true &&
  typeof category.name === "string" && category.name.trim() &&
  Array.isArray(category.children)), 
  "POPD_REFERENCE_CATEGORY_METADATA_INCOMPLETE");
const groupMembership = new Map();
for (const group of referenceGroups) {
  assert.ok(group.active === true && Array.isArray(group.categorySlugs),
    "POPD_REFERENCE_GROUP_METADATA_INVALID: " + String(group.id));
  for (const slug of group.categorySlugs) {
    groupMembership.set(slug, (groupMembership.get(slug) || 0) + 1);
  }
}
assert.equal(groupMembership.size, referenceCategories.length, "POPD_REFERENCE_GROUP_CATEGORY_COVERAGE_MISMATCH");
assert.ok(referenceCategories.every(category => groupMembership.get(category.slug) === 1),
  "POPD_REFERENCE_CATEGORY_MUST_BELONG_TO_EXACTLY_ONE_GROUP");
assert.equal(referenceCategories.reduce((sum, category) => sum + category.familyCount, 0), referenceStatus.familyCount,
  "POPD_REFERENCE_CATEGORY_FAMILY_TOTAL_MISMATCH");
assert.equal(referenceCategories.reduce((sum, category) => sum + category.skuCount, 0), referenceStatus.skuCount,
  "POPD_REFERENCE_CATEGORY_SKU_TOTAL_MISMATCH");

const familyCodes = new Set();
const skuCodes = new Set();
const familyImageUrls = new Set();
const skuImageUrls = new Set();
let sampleFamilyCode = "";
let sampleVariantCode = "";
for (const category of referenceCategories) {
  const detail = await json(candidate,
    "/api/catalog/reference/menu-category/" + encodeURIComponent(category.slug));
  assert.ok(detail.success && detail.category?.slug === category.slug &&
    Array.isArray(detail.families) && Array.isArray(detail.products),
    "POPD_REFERENCE_CATEGORY_DETAIL_INVALID: " + category.slug);
  assert.equal(detail.families.length, category.familyCount,
    "POPD_REFERENCE_CATEGORY_FAMILY_COUNT_MISMATCH: " + category.slug);
  assert.equal(detail.products.length, category.familyCount,
    "POPD_REFERENCE_CATEGORY_PRODUCT_COUNT_MISMATCH: " + category.slug);
  const detailFamilyCodes = new Set(detail.families.map(family => family.code));
  assert.equal(detailFamilyCodes.size, detail.families.length,
    "POPD_REFERENCE_DUPLICATE_FAMILY_IN_CATEGORY: " + category.slug);
  let categorySkuCount = 0;
  for (const product of detail.products) {
    assert.ok(product.code && product.resolvedAssignment?.categorySlug === category.slug,
      "POPD_REFERENCE_FAMILY_CATEGORY_MISMATCH: " + String(product.code || "unknown"));
    assert.ok(detailFamilyCodes.has(product.code),
      "POPD_REFERENCE_FAMILY_PRODUCT_PAIR_MISMATCH: " + product.code);
    assert.ok(!familyCodes.has(product.code),
      "POPD_REFERENCE_FAMILY_DUPLICATE_ACROSS_CATEGORIES: " + product.code);
    familyCodes.add(product.code);
    if (!sampleFamilyCode) sampleFamilyCode = product.code;
    for (const url of product.images || []) {
      assert.ok(typeof url === "string" && url.startsWith("/storage/products/"),
        "POPD_REFERENCE_FAMILY_IMAGE_URL_INVALID: " + product.code);
      familyImageUrls.add(url);
    }
    for (const variant of product.variants || []) {
      const code = String(variant.code || "");
      assert.ok(code, "POPD_REFERENCE_EMPTY_SKU_CODE: " + product.code);
      assert.ok(!skuCodes.has(code),
        "POPD_REFERENCE_DUPLICATE_SKU_ACROSS_CATEGORIES: " + code);
      skuCodes.add(code);
      categorySkuCount += 1;
      if (!sampleVariantCode) sampleVariantCode = code;
      for (const url of variant.images || []) {
        assert.ok(typeof url === "string" && url.startsWith("/storage/products/"),
          "POPD_REFERENCE_SKU_IMAGE_URL_INVALID: " + code);
        skuImageUrls.add(url);
      }
    }
  }
  assert.equal(categorySkuCount, category.skuCount,
    "POPD_REFERENCE_CATEGORY_VARIANT_TOTAL_MISMATCH: " + category.slug);
}
assert.equal(familyCodes.size, referenceStatus.familyCount, "POPD_REFERENCE_UNIQUE_FAMILY_TOTAL_MISMATCH");
assert.equal(skuCodes.size, referenceStatus.skuCount, "POPD_REFERENCE_UNIQUE_SKU_TOTAL_MISMATCH");
assert.equal(familyImageUrls.size, referenceStatus.verifiedFamilyImageCount,
  "POPD_REFERENCE_FAMILY_IMAGE_ASSIGNMENT_DRIFT");
assert.equal(skuImageUrls.size, referenceStatus.verifiedVariantImageCount,
  "POPD_REFERENCE_SKU_IMAGE_ASSIGNMENT_DRIFT");

// Identity approval is not enough if the mounted /data volume is missing the
// underlying file. HEAD all approved URLs before promotion; no broken gallery
// image is allowed to enter the public catalogue.
const storageImageUrls = [...new Set([...familyImageUrls, ...skuImageUrls])];
const storageImageFailures = [];
for (let index = 0; index < storageImageUrls.length; index += 16) {
  const batch = storageImageUrls.slice(index, index + 16);
  const results = await Promise.all(batch.map(async url => {
    try {
      const response = await fetch(candidate + url, {
        method: "HEAD",
        signal: AbortSignal.timeout(20000),
      });
      const contentType = response.headers.get("content-type") || "";
      if (response.status !== 200 || !contentType.startsWith("image/")) {
        return { url, status: response.status, contentType };
      }
      return null;
    } catch (error) {
      return { url, error: String(error?.message || error) };
    }
  }));
  storageImageFailures.push(...results.filter(Boolean));
}
assert.equal(storageImageFailures.length, 0,
  "POPD_REFERENCE_STORAGE_IMAGES_MISSING: " + JSON.stringify(storageImageFailures.slice(0, 12)));
console.log("POPD_REFERENCE_STORAGE_IMAGES_OK", storageImageUrls.length);

assert.ok(sampleFamilyCode && sampleVariantCode, "POPD_REFERENCE_PRODUCT_DETAIL_SAMPLES_MISSING");
const familyLookup = await json(candidate,
  "/api/catalog/reference/product/" + encodeURIComponent(sampleFamilyCode));
assert.ok(familyLookup.success && familyLookup.product?.code === sampleFamilyCode,
  "POPD_REFERENCE_FAMILY_DETAIL_ROUTE_FAILED");
const skuLookup = await json(candidate,
  "/api/catalog/reference/product/" + encodeURIComponent(sampleVariantCode));
assert.ok(skuLookup.success && skuLookup.product?.code === sampleFamilyCode,
  "POPD_REFERENCE_SKU_DETAIL_ROUTE_FAILED");
console.log("POPD_REFERENCE_CATEGORY_FAMILY_SKU_ROUTES_OK",
  "families=" + familyCodes.size, "skus=" + skuCodes.size);

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
