import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePurchaseLines } from "../src/utils/purchaseList";
import type { Product } from "../src/types";
const catalog = [
  {
    code: "FAM-1",
    name: "Family",
    active: true,
    images: ["family.jpg"],
    technicalSpecs: [],
    prices: { retail: 100 },
    variants: [
      {
        code: "80301",
        size: "Z12",
        name: "Small gear",
        price: 420000,
        images: ["sku.jpg"],
      },
      {
        code: "41068",
        size: "Z16",
        name: "Large gear",
        price: 0,
        inquiryOnly: true,
      },
      { code: "hidden", active: false },
    ],
  },
] as unknown as Product[];
test("bulk purchase resolves Persian quantities and exact SKU image, size and price", () => {
  const [row] = resolvePurchaseLines("۸۰۳۰۱، ۲", catalog);
  assert.equal(row.quantity, 2);
  assert.equal(row.product?.code, "80301");
  assert.equal(row.product?.prices.retail, 420000);
  assert.deepEqual(row.product?.images, ["sku.jpg"]);
  assert.equal(row.error, undefined);
});
test("bulk purchase rejects invalid quantities, inactive codes and family-only selections", () => {
  const rows = resolvePurchaseLines(
    "80301, 0\n80301, 1.2\n80301, -2\n80301, 10000\nunknown, 2\nhidden, 1\nFAM-1, 1\n80301, 2, 3",
    catalog,
  );
  assert.ok(rows.every((r) => r.error));
});
test("bulk purchase preserves inquiry-only items without inventing prices, limits list size", () => {
  const [row] = resolvePurchaseLines("41068", catalog);
  assert.equal(row.product?.inquiryOnly, true);
  assert.equal(row.product?.prices.retail, 0);
  assert.equal(row.quantity, 1);
  assert.equal(
    resolvePurchaseLines(Array(150).fill("80301, 1").join("\n"), catalog)
      .length,
    100,
  );
});
