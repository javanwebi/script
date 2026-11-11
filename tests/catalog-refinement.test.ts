import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('catalog refinement retains authoritative endpoints, family and direct SKU routes', () => {
 const page = read('src/pages/ExcelMenuCategoryPage.tsx');
 assert.match(page, /\/api\/catalog\/menu-category\//);
 assert.match(page, /subscribeCatalogChanges/);
 assert.match(page, /<DirectSkuProducts categorySlug=\{slug\}/);
 assert.match(page, /to=\{`\/product\/\$\{encodeURIComponent\(family.code\)\}/);
 const app = read('src/App.tsx');
 for (const route of ['/categories', '/identify-part', '/ai-consult', '/category/:slug', '/direct-product/:code']) assert.ok(app.includes(`path="${route}"`));
});
test('mobile filter control has an explicit accessible target and desktop filter remains available', () => {
 const page = read('src/pages/ExcelMenuCategoryPage.tsx');
 assert.match(page, /aria-expanded=\{filtersOpen\}/);
 assert.match(page, /aria-controls="catalog-category-filters"/);
 assert.match(page, /id="catalog-category-filters"/);
 assert.match(page, /lg:block/);
 assert.match(read('src/catalog-refinement.css'), /focus-visible/);
});
