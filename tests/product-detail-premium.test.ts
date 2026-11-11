import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ProductDetailPage.tsx', 'utf8');
const styles = readFileSync('src/pages/product-detail-premium.css', 'utf8');
const routes = readFileSync('src/App.tsx', 'utf8');

test('public and customer-panel product detail routes remain registered', () => {
  assert.match(routes, /path="\/product\/:code"/);
  assert.match(routes, /path="\/account\/product\/:code"/);
  assert.match(routes, /path="\/consumer-dashboard\/product\/:code"/);
});

test('product details wait for PostgreSQL hydration before showing a not-found state', () => {
  assert.match(page, /isDatabaseCatalogHydrated\(\)/);
  assert.match(page, /if \(!product && !catalogReady && !isCustomerPortalRoute\)/);
  assert.match(page, /product-detail-loading/);
  assert.match(page, /product-detail-not-found/);
});

test('selecting a different SKU updates the shareable route and preserves query parameters', () => {
  assert.match(page, /const syncSelectedVariantRoute = \(variantCode: string\)/);
  assert.match(page, /encodeURIComponent\(variantCode\)/);
  assert.match(page, /search: location\.search/);
  assert.match(page, /syncSelectedVariantRoute\(newVariantCode\)/);
  assert.match(page, /syncSelectedVariantRoute\(clickedImg\.variantCode\)/);
});

test('family and SKU image scopes remain distinct and exact image selection remains available', () => {
  assert.match(page, /img\.scope === "family"/);
  assert.match(page, /img\.scope === "variant"/);
  assert.match(page, /تصویر عمومی خانواده محصول/);
  assert.match(page, /تصویر اختصاصی کد/);
  assert.match(page, /handleSelectImage\(idx\)/);
});

test('price access and inquiry-only purchase safeguards remain in place', () => {
  assert.match(page, /const canViewCommercial =/);
  assert.match(page, /getCurrentCustomerSkuPrice\(/);
  assert.match(page, /isSelectedInquiryOnly/);
  assert.match(page, /buyingAllowed && isSelectedStockKnown && activeStockCount <= 0/);
  assert.match(page, /submitInquiry\(requestedProduct, quantity, inquiryNotes\)/);
});

test('product information tabs are accessible and retain all three content panels', () => {
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tab"/);
  assert.match(page, /aria-selected=\{activeTab === "specs"\}/);
  assert.match(page, /aria-selected=\{activeTab === "catalogue"\}/);
  assert.match(page, /aria-selected=\{activeTab === "delivery"\}/);
  assert.match(page, /role="tabpanel"/);
  assert.match(page, /activeTab === "specs"/);
  assert.match(page, /activeTab === "catalogue"/);
  assert.match(page, /activeTab === "delivery"/);
});

test('premium visual changes and SKU URL updates do not alter customer-panel detail routes', () => {
  assert.match(page, /isCustomerPortalRoute \? "" : "product-detail-premium"/);
  assert.match(page, /if \(isCustomerPortalRoute\) return;/);
  assert.match(page, /!catalogReady && !isCustomerPortalRoute/);
});

test('product detail layout has deliberate desktop, tablet, mobile and reduced-motion rules', () => {
  assert.match(styles, /grid-template-columns: minmax\(0, \.95fr\) minmax\(0, 1\.05fr\)/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test('detail page CSS is scoped and does not change global storefront layout', () => {
  assert.match(page, /product-detail-premium/);
  assert.match(styles, /\.product-detail-premium/);
  assert.doesNotMatch(styles, /(^|\n)body\s*\{/);
  assert.doesNotMatch(styles, /(^|\n)\.store-product-card\s*\{/);
});
