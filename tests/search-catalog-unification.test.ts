import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../src/pages/SearchPage.tsx", import.meta.url), "utf8");

test("search results combine family products and direct SKUs into one product collection", () => {
  assert.match(page, /const combinedResults = useMemo/);
  assert.match(page, /matchingDirectSkus\.map\(item =>/);
  assert.match(page, /product: toDirectSkuProduct\(item\), directSkuCode: item\.skuCode/);
  assert.match(page, /combinedResults\.map\(item =>/);
  assert.match(page, /detailPath=\{item\.directSkuCode/);
  assert.doesNotMatch(page, /ردیف‌های مستقیم کالایی \(SKU\) منطبق با جستجو/);
});

test("search brand filters include active family SKU brands and real direct SKU manufacturer labels", () => {
  assert.match(page, /getProductDisplayBrands\(product\)/);
  assert.match(page, /productHasDisplayBrand\(product, selectedBrand\)/);
  assert.match(page, /productHasDisplayBrand\(toDirectSkuProduct\(item\), selectedBrand\)/);
  assert.doesNotMatch(page, /product\.brand !== selectedBrand/);
  assert.doesNotMatch(page, /item\.brand !== selectedBrand/);
});

test("search does not claim direct SKU stock when the endpoint has no authoritative stock field", () => {
  assert.match(page, /if \(onlyInStock\) return false/);
  assert.match(page, /disableSiteFallback=\{Boolean\(item\.directSkuCode\)\}/);
});
