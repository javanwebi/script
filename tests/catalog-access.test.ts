import { test } from "node:test";
import assert from "node:assert/strict";
import { publicCatalog, compactCatalogReviews } from "../src/utils/catalogPrivacy";
import {
  findCatalogKnowledge,
  catalogFallback,
} from "../src/utils/catalogKnowledge";
import { getManagedCatalogProducts } from "../src/data/mockGenerator";
test("public catalog recursively removes financial data without changing the source or SKU metadata", () => {
  const input = {
    code: "80301",
    prices: { retail: 123456 },
    stock: 75,
    stockKnown: true,
    variants: [{ code: "41068", price: 654321, stock: 40, size: "20 × 30" }],
    technicalSpecs: [{ key: "جنس", value: "پلاستیک" }],
  };
  const safe = publicCatalog(input);
  assert.equal("prices" in safe, false);
  assert.equal("stock" in safe, false);
  assert.equal("price" in safe.variants[0], false);
  assert.equal(safe.variants[0].code, "41068");
  assert.equal(safe.variants[0].size, "20 × 30");
  assert.equal(input.prices.retail, 123456);
});
test("workspace searches real nested SKU codes including Persian digits and excludes financial fields", () => {
  const products = getManagedCatalogProducts();
  const result = findCatalogKnowledge(products, "مشخصات کد ۴۱۰۶۸");
  assert.ok(result.length);
  assert.ok(result[0].variants.some((v) => v.code === "41068"));
  assert.ok(!JSON.stringify(result).includes('"prices"'));
  assert.ok(!JSON.stringify(result).includes('"stock"'));
  assert.ok(result[0].link.startsWith("/product/"));
  assert.equal(
    findCatalogKnowledge(products, "NON_EXISTENT_SKU_938749").length,
    0,
  );
});
test("unavailable model fallback identifies its catalog source and never invents availability", () => {
  const text = catalogFallback([]);
  assert.ok(text.includes("در دسترس نیست"));
  assert.ok(text.includes("پنل"));
  assert.ok(!text.includes("در انبار موجود"));
});

test("bootstrap compaction removes bulky per-SKU review without dropping code, specs, or pictures", () => {
  const original = [{
    code: "F1", images: ["/storage/products/thumbs/e(1).webp"],
    variants: [{ code: "S1", technicalSpecs: [{key:"قطر",value:"10 mm"}], technicalReview: {categoryPath:["تسمه"],note:"reference"}, price: 100 }],
  }];
  const response = compactCatalogReviews(publicCatalog(original));
  assert.equal(response[0].variants[0].code,"S1");
  assert.deepEqual(response[0].variants[0].technicalSpecs,original[0].variants[0].technicalSpecs);
  assert.deepEqual(response[0].images,original[0].images);
  assert.equal("technicalReview" in response[0].variants[0],false);
  assert.equal("price" in response[0].variants[0],false);
  assert.ok(original[0].variants[0].technicalReview);
});
