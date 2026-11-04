import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { searchConsumerProducts, resolveCurrentRetailReorder } from "../src/utils/consumerCatalogView";
import type { Product } from "../src/types";

const family = (overrides: Record<string, unknown> = {}): Product => ({
  code: "UNIT-FAMILY-001", name: "تسمه صنعتی", brand: "SAMPLE-BRAND", categorySlug: "belts",
  categoryName: "تسمه", subcategory: "narrow", technicalSpecs: [], stock: 4, unit: "عدد", tags: [],
  active: true, inquiryOnly: false,
  prices: { base: 120, retail: 180, wholesale: 120, dealer: 120 },
  images: [], variants: [
    { code: "UNIT-SKU-701", name: "تسمه SPA 701", size: "701", price: 250, active: true },
  ],
  ...overrides,
} as Product);

test("consumer catalog search finds actual SKU codes, Persian names and brand across the full list", () => {
  const products = Array.from({ length: 42 }, (_, i) =>
    family({ code: `UNIT-FAMILY-${i}`, name: `تسمه شماره ${i}`, variants: [] }));
  const special = family();
  const all = [...products, special];
  assert.equal(searchConsumerProducts(all, "", "all").length, 43, "must not truncate to 24");
  assert.deepEqual(searchConsumerProducts(all, "unit-sku-701", "all").map(p => p.code), [special.code]);
  assert.deepEqual(searchConsumerProducts(all, "SPA 701", "all").map(p => p.code), [special.code]);
  assert.deepEqual(searchConsumerProducts(all, "sample-brand", "belts").length, 43);
  assert.deepEqual(searchConsumerProducts(all, "unit-sku-701", "bearings"), []);
});

test("inactive products and SKUs are not surfaced as available search results", () => {
  assert.equal(searchConsumerProducts([family({active:false})], "", "all").length, 0);
  assert.equal(searchConsumerProducts([family({variants: [{code:"UNIT-SKU-701",name:"inactive",size:"701",active:false}]})], "UNIT-SKU-701", "all").length, 0);
});

test("reorder uses current catalog SKU price, never historical invoice price", () => {
  const p=family();
  const find = (code:string) => ["UNIT-FAMILY-001","UNIT-SKU-701"].includes(code) ? p : undefined;
  const sku = resolveCurrentRetailReorder("UNIT-SKU-701", 3, find);
  assert.equal(sku?.product.code, "UNIT-SKU-701");
  assert.equal(sku?.product.prices.retail, 250);
  assert.equal(sku?.quantity, 3);
  assert.equal(resolveCurrentRetailReorder("UNIT-FAMILY-001", 1, find)?.product.prices.retail, 180);
});

test("reorder rejects removed, inactive, unpriced and inquiry-only codes", () => {
  const find=(p:Product) => (code:string) => code.startsWith("UNIT-") ? p : undefined;
  assert.equal(resolveCurrentRetailReorder("UNIT-OLD-SKU", 1, find(family())), null);
  assert.equal(resolveCurrentRetailReorder("UNIT-FAMILY-001", 0, find(family())), null);
  assert.equal(resolveCurrentRetailReorder("UNIT-FAMILY-001", 1, find(family({inquiryOnly:true}))), null);
  assert.equal(resolveCurrentRetailReorder("UNIT-FAMILY-001", 1, find(family({prices:{base:0,retail:0,wholesale:0,dealer:0}}))), null);
  assert.equal(resolveCurrentRetailReorder("UNIT-SKU-701", 1, find(family({variants:[{code:"UNIT-SKU-701",name:"inactive",size:"701",price:200,active:false}]}))), null);
  assert.equal(resolveCurrentRetailReorder("UNIT-SKU-701", 1, find(family({variants:[{code:"UNIT-SKU-701",name:"inquiry",size:"701",inquiryOnly:true,price:200}]}))), null);
});

test("dashboard does not repeatedly normalize catalog or render unopened detail tabs", () => {
  const page=fs.readFileSync("src/pages/ConsumerDashboardPage.tsx","utf8");
  const tools=fs.readFileSync("src/components/portal/PortalTools.tsx","utf8");
  const shell=fs.readFileSync("src/components/portal/PortalShell.tsx","utf8");
  assert.equal((page.match(/getManagedCatalogProducts\(\)/g)||[]).length,1);
  assert.match(page,/useDeferredValue\(quickSkuQuery\)/);
  assert.match(page,/searchConsumerProducts\(catalog, deferredQuickSkuQuery, selectedCategorySlug\)/);
  assert.doesNotMatch(page,/filtered\.slice\(0, 24\)/);
  assert.match(page,/catalogProducts\.slice\(0, visibleProductCount\)/);
  assert.match(page,/resolveCurrentRetailReorder\(item\.code, item\.quantity, getProductByCode\)/);
  assert.match(page,/const PortalTools = React\.lazy/);
  assert.match(page,/const PortalClub = React\.lazy/);
  assert.match(page,/extraOpen && <Suspense/);
  assert.match(page,/clearTimeout\(toastTimeout\.current\)/);
  assert.match(tools,/tab === "purchase_list" \? resolvePurchaseLines/);
  assert.match(tools,/new Set\(wishlist\)/);
  assert.match(shell,/MutationObserver\(schedule\)/);
  assert.match(shell,/cancelAnimationFrame/);
});
