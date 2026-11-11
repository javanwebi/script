import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ProductsPage.tsx', 'utf8');
const styles = readFileSync('src/pages/products-page-premium.css', 'utf8');
const routes = readFileSync('src/App.tsx', 'utf8');

test('products page keeps its canonical route and the homepage/customer panels remain separate', () => {
  assert.match(routes, /<Route path="\/products" element={<ProductsPage \/>} \/>/);
  assert.match(routes, /<Route path="\/" element={<HomePage \/>} \/>/);
  assert.match(routes, /path="\/consumer-dashboard/);
  assert.match(routes, /path="\/account/);
  assert.match(routes, /path="\/catalog"[\s\S]*?Navigate to="\/products"/);
  assert.match(routes, /<Route path="\/knowledge" element={<KnowledgePage \/>} \/>/);
});

test('catalogue hero uses an existing industrial asset and real catalogue counts', () => {
  assert.match(page, /STORE_ASSETS\.heroBanner/);
  assert.match(page, /CATALOGUE_SKU_COUNT/);
  assert.match(page, /allProducts\.length/);
  assert.match(page, /to="\/identify-part"/);
  assert.match(page, /to="\/ai-consult"/);
});

test('search and advanced filters remain shareable through URL query parameters', () => {
  assert.match(page, /nextParams\.set\("q", e\.target\.value\)/);
  assert.match(page, /updateSearchParam\("brand"/);
  assert.match(page, /updateSearchParam\("stock"/);
  assert.match(page, /updateSearchParam\("image"/);
  assert.match(page, /updateSearchParam\("q", null\)/);
});

test('stock-only results require a confirmed stock record, not an inquiry-only item', () => {
  assert.match(page, /p\.stockKnown === true && p\.stock > 0 && !p\.inquiryOnly/);
});

test('mobile filter sheet exposes a modal dialog, escape handling and focus containment', () => {
  assert.match(page, /role="dialog" aria-modal="true"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /event\.key !== "Tab"/);
  assert.match(page, /previousFocus\?\.focus\(\)/);
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
});

test('all-products quick links use only approved Excel categories and open the canonical category route', () => {
  assert.match(page, /getManagedCategories\(\)[\s\S]*?category\.active !== false && \/\^excel-v2-\[0-9\]\+-\[0-9\]\+\$\//);
  assert.match(page, /to=\{\`\/category\/\$\{encodeURIComponent\(cat\.slug\)\}\`\}/);
  assert.match(page, /navigate\(\`\/category\/\$\{encodeURIComponent\(categoryParam\)\}/);
  assert.match(page, /to="\/categories" className="catalogue-all-categories-link"/);
  assert.match(page, /cat\.image \|\| CATEGORY_ARTWORK\[cat\.name\]/);
  assert.match(page, /loading="lazy" decoding="async"/);
  assert.doesNotMatch(page, /aria-pressed=\{isSelected\}/);
});

test('catalogue styling has deliberate desktop, tablet, mobile and reduced-motion rules', () => {
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(max-width: 380px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /overflow: hidden/);
});
