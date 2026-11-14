import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePreloadKey } from '../src/components/layout/RouteIntentPreload';
import { getSavedScrollEntry, saveScrollEntry } from '../src/components/layout/ScrollToTop';

test('preloads one shared module for each product and category family', () => {
  assert.equal(resolvePreloadKey('/product/6203ZZ'), '/product/:code');
  assert.equal(resolvePreloadKey('/consumer-dashboard/product/6203ZZ'), '/product/:code');
  assert.equal(resolvePreloadKey('/account/product/6203ZZ'), '/product/:code');
  assert.equal(resolvePreloadKey('/category/تسمه-و-انتقال-نیرو'), '/category/:slug');
  assert.equal(resolvePreloadKey('/category/ceramic-tiles'), '/industry-template');
  assert.equal(resolvePreloadKey('/category/textile-machinery'), '/industry-template');
  assert.equal(resolvePreloadKey('/category/packaging-carton'), '/industry-template');
  assert.equal(resolvePreloadKey('/category/food-beverage'), '/industry-template');
  assert.equal(resolvePreloadKey('/category/machinery-equipment'), '/industry-template');
  assert.equal(resolvePreloadKey('/category/rubber-plastics'), '/industry-template');
  assert.equal(resolvePreloadKey('/industries/ceramic'), '/industry-template');
  assert.equal(resolvePreloadKey('/industries/textile'), '/industry-template');
  assert.equal(resolvePreloadKey('/industries/packaging'), '/industry-template');
  assert.equal(resolvePreloadKey('/industry/ceramic-tile'), '/industry-template');
  assert.equal(resolvePreloadKey('/cart'), '/cart');
  assert.equal(resolvePreloadKey('/ai-forza'), '/ai-forza');
  assert.equal(resolvePreloadKey('/some-unrelated-route'), null);
});

test('scroll restoration updates memory synchronously with deferred session storage', () => {
  saveScrollEntry(['key:phase7-test', 'path:/products'], {
    scrollY: 1480, sectionId: 'catalog-results', viewportTop: 100, updatedAt: Date.now(),
  });
  const entry = getSavedScrollEntry(['key:phase7-test']);
  assert.equal(entry?.scrollY, 1480);
  assert.equal(entry?.sectionId, 'catalog-results');
  const source = readFileSync(new URL('../src/components/layout/ScrollToTop.tsx', import.meta.url), 'utf8');
  assert.match(source, /setTimeout\(flushScrollStore, 550\)/);
  assert.match(source, /window\.addEventListener\('pagehide', flushScrollStore\)/);
  assert.match(source, /event\.detail > 0/);
  assert.equal((source.match(/sessionStorage\.setItem\(STORAGE_KEY/g) || []).length, 1);
});
