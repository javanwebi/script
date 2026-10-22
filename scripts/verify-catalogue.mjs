// Run: node --import tsx scripts/verify-catalogue.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { USER_PRODUCTS, CATALOGUE_SKU_COUNT, matchesProductSearch } from '../src/data/userProducts.ts';
import { CATEGORIES, matchesCatalogCategory } from '../src/data/categories.ts';
import { getProductByCode, getInstantSearchResults } from '../src/data/mockGenerator.ts';
import { ProductImage } from '../src/components/product/ProductImage.tsx';
import { CategoryNavigation } from '../src/components/catalog/CategoryNavigation.tsx';
import { ProductVariants } from '../src/components/product/ProductVariants.tsx';
const source = JSON.parse(readFileSync(new URL('../src/data/catalogueSource.json', import.meta.url)));
const reviewed = JSON.parse(readFileSync(new URL('../src/data/catalogueImages.json', import.meta.url)));
const imageAudit = JSON.parse(readFileSync(new URL('../docs/product-image-review.json', import.meta.url)));
assert.equal(USER_PRODUCTS.length, 1383);
assert.equal(CATALOGUE_SKU_COUNT, 10435);
assert.equal(CATEGORIES.length, 29);
assert.equal(CATEGORIES.reduce((n, c) => n + c.children.length, 0), 64);
assert.equal(CATEGORIES.reduce((n, c) => n + c.children.reduce((m, s) => m + s.children.length, 0), 0), 90);
assert.equal(CATEGORIES.reduce((n, c) => n + c.count, 0), USER_PRODUCTS.length);
const allCodes = new Set();
for (const row of source) {
  const product = getProductByCode(row.code);
  assert.equal(product.name, row.name);
  assert.equal(product.categoryName, row.categoryName);
  assert.equal(product.submenu, row.submenu);
  assert.equal(product.subcategory, row.technicalType);
  assert.deepEqual(product.variants, row.variants);
  assert.equal(product.variants.length, row.itemCount);
  assert(matchesCatalogCategory(product, product.categorySlug, row.submenu));
  assert(matchesCatalogCategory(product, product.categorySlug, row.technicalType));
  assert.equal(product.stockKnown, false);
  assert.equal(product.inquiryOnly, true);
  assert.equal(product.prices.retail, 0);
  assert.equal(product.rating, undefined);
  assert.equal(product.images.length, reviewed[product.code]?.files.length || 0);
  for (const variant of product.variants) {
    assert(!allCodes.has(variant.code)); allCodes.add(variant.code);
    assert.equal(getProductByCode(variant.code).code, product.code);
    assert(matchesProductSearch(product, variant.code));
  }
}
assert.equal(allCodes.size, 10435);
assert.equal(USER_PRODUCTS.filter(p => p.images.length).length, Object.keys(reviewed).length);
assert.equal(imageAudit.items.length, 869);
assert.equal(new Set(imageAudit.items.map(i => i.file)).size, 869);
const publicImages = new Set();
for (const [familyCode, review] of Object.entries(reviewed)) {
  assert.equal(getProductByCode(familyCode).name, review.familyName);
  for (const file of review.files) {
    assert(!publicImages.has(file), `Image assigned to multiple products: ${file}`);
    publicImages.add(file);
    const audit = imageAudit.items.find(i => i.file === file);
    assert.equal(audit.status, 'matched-product-type');
    assert.equal(audit.familyCode, familyCode);
    assert.equal(audit.skuVerified, false);
  }
}
for (let n = 1; n <= 869; n++) {
  const audit = imageAudit.items.find(i => i.file === `e(${n}).png`);
  assert(audit?.observed && audit.reason && /^[a-f0-9]{64}$/.test(audit.sha256));
  assert.equal(publicImages.has(audit.file), audit.status === 'matched-product-type');
}
assert.equal(publicImages.size, imageAudit.matchedImages);
// The green domed cover is not a bearing. Guard against the old misidentification.
assert.equal(getProductByCode('FAM-32242').images.length, 0);
assert(reviewed['FAM-41309'].files.includes('e(386).png'));
assert.equal(USER_PRODUCTS.filter(p => p.categoryName === 'تسمه و انتقال نیرو' && p.images.length).length, 0);
assert(getInstantSearchResults('۳۲۸۹۳').products.some(p => p.code === 'FAM-32893'));
const empty = renderToStaticMarkup(React.createElement(ProductImage, { alt: 'تسمه' }));
assert(empty.includes('تصویر هنوز ثبت نشده')); assert(!empty.includes('<img'));
const menu = renderToStaticMarkup(React.createElement(MemoryRouter, null, CATEGORIES.map(c => React.createElement(CategoryNavigation, { key: c.slug, nodes: c.children, categorySlug: c.slug }))));
assert(!menu.includes('FAM-'));
assert(!menu.includes('تسمه REFLEX SPA خارجی'));
const variants = renderToStaticMarkup(React.createElement(ProductVariants, { variants: getProductByCode('32893').variants, selected: '32893', onSelect() {} }));
assert(variants.includes('32893')); assert(variants.includes('32906')); assert(variants.includes('انتخاب‌شده'));
console.log('Verified: 1,383 families; 10,435 unique SKUs; 29/64/90 navigation; exact source names and variants; image whitelist; search; empty images; variant selector.');
