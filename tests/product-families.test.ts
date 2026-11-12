import './catalogFixtures';
import test from 'node:test';
import assert from 'node:assert/strict';
import { USER_PRODUCTS, USER_PRODUCTS_RAW, PRODUCT_FAMILY_ALIASES } from '../src/data/userProducts';
import { groupProductFamilies } from '../src/data/productFamilies';
import { getProductByCode } from '../src/data/mockGenerator';

test('grouping conserves every SKU and its exact recorded specifications', () => {
  const variants = (products: typeof USER_PRODUCTS) => products.flatMap(p => (p.variants || []).map(({code,size,name}) => ({code,size,name}))).sort((a,b) => a.code.localeCompare(b.code));
  assert.deepEqual(variants(USER_PRODUCTS), variants(USER_PRODUCTS_RAW));
  assert.deepEqual(groupProductFamilies(USER_PRODUCTS), USER_PRODUCTS);
});
test('ZZ bearing sizes share one family while 2RS remains separate', () => {
  const zz = getProductByCode('41648');
  assert.equal(zz?.name, 'بلبرینگ ZZ');
  assert.equal(zz?.variants?.length, 14);
  assert.equal(getProductByCode('FAM-41648')?.code, zz?.code);
  assert.notEqual(getProductByCode('FAM-33066')?.code, zz?.code);
  assert.equal(PRODUCT_FAMILY_ALIASES.get('fam-41648'), zz?.code);
});
test('technical and brand differences prevent accidental family merging', () => {
  const base = USER_PRODUCTS_RAW[0];
  assert.equal(groupProductFamilies([{...base, code:'a'}, {...base,code:'b',brand:'other'}]).length,2);
  assert.equal(groupProductFamilies([{...base, code:'a'}, {...base,code:'b',subcategory:'other'}]).length,2);
});

test('families cover chain pitches, ribbed belts, pulleys and roller parts across the catalog', () => {
  const cases = [
    ['FAM-70355', 'FAM-70359'],
    ['FAM-70356', 'FAM-70358'],
    ['FAM-34270', 'FAM-53001'],
    ['FAM-39823', 'FAM-39229'],
  ];
  for (const [a,b] of cases) assert.equal(getProductByCode(a)?.code, getProductByCode(b)?.code, `${a} / ${b}`);
  assert.notEqual(getProductByCode('FAM-70356')?.code, getProductByCode('FAM-10114')?.code, 'simplex and duplex chains stay separate');
  assert.ok(USER_PRODUCTS.length < 1300, 'catalog-wide grouping must extend beyond bearings');
});

test('every historical family resolves to a family containing its exact original SKUs', () => {
  for (const raw of USER_PRODUCTS_RAW) {
    const family = getProductByCode(raw.code);
    assert.ok(family, raw.code);
    for (const variant of raw.variants || []) assert.ok(family.variants?.some(v => v.code === variant.code), `${raw.code} / ${variant.code}`);
  }
});
