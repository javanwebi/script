import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { getProductImageUrl } from '../src/assets/imagesproducts';

test('existing canonical catalog originals resolve to persistent storage', () => {
  assert.equal(getProductImageUrl('e(1).png'), '/storage/products/catalog/e(1).png');
  assert.equal(getProductImageUrl('e(869).png'), '/storage/products/catalog/e(869).png');
  assert.equal(getProductImageUrl('/storage/products/catalog/e(123).png'),
    '/storage/products/catalog/e(123).png');
  assert.equal(getProductImageUrl('e(870).png'), '');
});

test('historic GitHub image references are normalized to local volume URLs', () => {
  assert.equal(
    getProductImageUrl('https://raw.githubusercontent.com/javanweb/imagesatlas/main/e(31).png'),
    '/storage/products/catalog/e(31).png',
  );
  assert.equal(
    getProductImageUrl('https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@main/e(869).png'),
    '/storage/products/catalog/e(869).png',
  );
});

test('new uploads and local previews remain available', () => {
  assert.equal(
    getProductImageUrl('/storage/products/12345678-1234-1234-1234-123456789abc.webp'),
    '/storage/products/12345678-1234-1234-1234-123456789abc.webp',
  );
  assert.equal(getProductImageUrl('blob:https://sanatpish.com/example'), 'blob:https://sanatpish.com/example');
  assert.equal(getProductImageUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
});

test('unknown external or unsafe product image URL never loads outside storage', () => {
  assert.equal(getProductImageUrl('https://example.com/unknown.jpg'), '');
  assert.equal(getProductImageUrl('https://evil.example/e(1).png'), '');
  assert.equal(getProductImageUrl('javascript:alert(1)'), '');
});

test('catalog image HTTP handlers never fall back to vendored Git copies', () => {
  const source = readFileSync('server/productImageStorage.ts', 'utf8');
  assert.ok(!source.includes('vendoredRoot'));
  assert.ok(!source.includes('||vendored'));
  assert.match(source, /if\(!onVolume\)return res\.status\(404\)/);
});

test('GitHub image backfill runs only when operator explicitly opts in', () => {
  const source = readFileSync('server.ts', 'utf8');
  assert.match(source, /process\.env\.CATALOG_IMAGE_VOLUME_MIGRATE_ON_BOOT === 'true'/);
  assert.match(source, /void beginImageVolumeMigration\(/);
});
