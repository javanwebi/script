import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogListFields, positive } from '../server/db/catalogApi';
import { publicCatalog } from '../src/utils/catalogPrivacy';

test('pagination never exposes unbounded page sizes', () => {
  assert.equal(positive('24', 24, 100), 24);
  assert.equal(positive('2000000', 24, 100), 100);
  assert.equal(positive('-9', 24, 100), 24);
  assert.equal(positive('1.2', 24, 100), 24);
  assert.equal(positive('NaN', 24, 100), 24);
});
test('lightweight list DTO keeps real codes and drops heavy runtime payload', () => {
  const family = {
    code: 'BELT-REAL-01', name: 'تسمه صنعتی', brand: 'TEST',
    category_slug: 'تسمه-و-انتقال-نیرو', category_name: 'تسمه و انتقال نیرو',
    images: ['/storage/products/example.webp'], technical_specs: [],
    tags: [], has_catalogue_image: true, is_active: true,
    runtime_payload: { oversized: true }, dealer_price: 900,
  };
  const product = catalogListFields(family, [
    { code: 'REAL-SKU-01', size: 'A', name: 'سایز A', active: true },
  ]);
  assert.equal(product.code, family.code);
  assert.equal(product.variants[0].code, 'REAL-SKU-01');
  assert.equal(product.images[0], family.images[0]);
  assert.ok(!('runtime_payload' in product));
  assert.ok(!('dealer_price' in product));
});
test('public output removes commercial fields recursively', () => {
  const product = catalogListFields({
    code: 'BELT-REAL-01', name: 'تسمه', images: [], technical_specs: [], tags: [],
  }, [{ code: 'SKU', size: 'A', prices: { retail: 10 }, stock: 20 }]);
  const safe = publicCatalog({ product, price: 500, stock: 5 });
  assert.equal(safe.price, undefined);
  assert.equal(safe.stock, undefined);
  assert.equal(safe.product.variants[0].prices, undefined);
  assert.equal(safe.product.variants[0].stock, undefined);
  assert.equal(safe.product.variants[0].code, 'SKU');
});
