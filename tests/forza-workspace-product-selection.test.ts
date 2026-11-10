import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Product } from '../src/types';
import { findCatalogKnowledge } from '../src/utils/catalogKnowledge';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('live catalog returns the actual selected SKU and keeps commercial fields private', () => {
  const products = [{
    code: 'FAM-TEST',
    name: 'بلبرینگ نمونه تست',
    active: true,
    images: ['/catalog/sample.webp'],
    variants: [
      { code: '6203ZZ', name: 'بلبرینگ 6203ZZ', size: '17x40x12 mm', price: 120000, active: true },
      { code: '6202ZZ', name: 'بلبرینگ 6202ZZ', size: '15x35x11 mm', price: 90000, active: false },
    ],
  }] as unknown as Product[];
  const found = findCatalogKnowledge(products, '6203ZZ', 6);
  assert.equal(found.length, 1);
  assert.equal(found[0].variants[0]?.code, '6203ZZ');
  assert.equal((found[0].variants[0] as any).price, undefined);
  assert.equal(found[0].images?.[0], '/catalog/sample.webp');
  assert.equal(findCatalogKnowledge(products, 'not-a-real-code-96547', 6).length, 0);
});

test('workshop has one persistent search, picture-backed suggestions and exact SKU action', () => {
  const desk = read('src/pages/AiConsultPage.tsx');
  const search = read('src/components/search/WorkspaceCatalog.tsx');
  assert.equal((desk.match(/<WorkspaceCatalog /g) || []).length, 1);
  assert.match(desk, /onAddToConsultation=\{startCatalogConsultation\}/);
  assert.match(desk, /productCodes: turnSelectedProducts\.map/);
  assert.match(desk, /productForTurn && !turnSelectedProducts\.some/);
  assert.match(search, /id="forza-workspace-product-search"/);
  assert.match(search, /aria-label="نتایج جست‌وجوی محصولات"/);
  assert.match(search, /onClick=\{\(\) => choose\(family, variant\)\}/);
  assert.match(search, /family\.images\?\.\[0\]/);
  assert.match(search, /AbortController/);
});

test('product consultation transfers current selected SKU and preserves price security', () => {
  const detail = read('src/pages/ProductDetailPage.tsx');
  const server = read('server.ts');
  assert.match(detail, /productCode: selectedVariant\?\.code \|\| product\.code/);
  assert.match(detail, /productName: product\.name/);
  assert.match(server, /identity\.user\.canViewPrices\s*!==\s*true/);
  assert.match(server, /app_private\.current_variant_price\(v\.code\)/);
  assert.match(read('src/utils/catalogPrivacy.ts'), /commercialKeys/);
});
