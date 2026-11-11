import test from "node:test";
import assert from "node:assert/strict";
import type { Product } from "../src/types";
import { toCatalogListingProduct } from "../src/utils/catalogListing";
import { matchesProductSearch } from "../src/data/userProducts";

test("catalog listing keeps card metadata and SKU search while deferring full variants", () => {
  const family = {
    code: "FAM-6202",
    name: "بلبرینگ صنعتی",
    brand: "FORZA",
    categorySlug: "bearings",
    categoryName: "بلبرینگ و یاتاقان",
    subcategory: "بلبرینگ",
    submenu: "بلبرینگ صنعتی",
    technicalSpecs: [{ key: "قطر داخلی", value: "15 mm" }],
    prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
    stock: 0,
    inquiryOnly: true,
    images: ["/products/bearing.webp", "/products/second.webp"],
    tags: ["صنعتی"],
    unit: "عدد",
    variants: [
      { code: "6202ZZ", name: "بلبرینگ 6202ZZ", size: "15×35×11", technicalSpecs: [{ key: "آب‌بندی", value: "ZZ" }] },
      { code: "6202-OLD", name: "کد غیرفعال", size: "15×35×11", active: false },
    ],
    galleryImages: [
      { id: "g1", url: "/products/bearing.webp", scope: "family" as const },
      { id: "g2", url: "/products/variant.webp", scope: "variant" as const, variantCode: "6202ZZ" },
    ],
  } as Product;

  const summary = toCatalogListingProduct(family);
  assert.equal(summary.variantCount, 1);
  assert.equal("variants" in summary, false);
  assert.equal("galleryImages" in summary, false);
  assert.deepEqual(summary.images, ["/products/bearing.webp"]);
  assert.equal(summary.technicalSpecs.length, 0);
  assert.match(summary.searchText, /6202ZZ/);
  assert.match(summary.searchText, /15×35×11/);
  assert.equal(matchesProductSearch(summary, "6202ZZ"), true);
  assert.equal(matchesProductSearch(summary, "15×35×11"), true);
});
