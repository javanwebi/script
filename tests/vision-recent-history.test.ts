import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
  loadVisionRecentSearches,
  recordVisionRecentSearch,
} from '../src/components/search/visionRecentHistory';

const LEGACY_KEY = 'sanatpish_forza_vision_recent_v1';
const STORAGE_KEY = 'sanatpish_forza_vision_recent_v2';
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return { storage, values };
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('history starts empty and never injects sample records', () => {
  const { values } = installStorage();
  assert.deepEqual(loadVisionRecentSearches(), []);
  assert.equal(values.has(STORAGE_KEY), false);
});

test('legacy v1 history is deleted instead of restoring arbitrary customer image URLs', () => {
  const { values } = installStorage();
  values.set(LEGACY_KEY, JSON.stringify([{
    id: 'old',
    title: 'تصویر مشتری',
    subtitle: 'نمونه قدیمی',
    timeLabel: 'امروز',
    imageUrl: 'data:image/jpeg;base64,PRIVATE_CUSTOMER_IMAGE',
    code: 'PRIVATE-1',
  }]));

  assert.deepEqual(loadVisionRecentSearches(), []);
  assert.equal(values.has(LEGACY_KEY), false);
});

test('history stores metadata but rejects data URLs, blob URLs and remote images', () => {
  const { values } = installStorage();
  const items = recordVisionRecentSearch({
    code: 'TEST-101',
    title: 'بلبرینگ آزمایشی',
    subtitle: 'نتیجه کاتالوگ',
    imageUrl: 'data:image/jpeg;base64,PRIVATE_CUSTOMER_IMAGE',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].code, 'TEST-101');
  assert.equal(items[0].imageUrl, undefined);
  const stored = values.get(STORAGE_KEY) || '';
  assert.ok(!stored.includes('data:image'));
  assert.ok(!stored.includes('blob:'));
  assert.ok(!stored.includes('PRIVATE_CUSTOMER_IMAGE'));

  recordVisionRecentSearch({
    code: 'TEST-102',
    title: 'پولی آزمایشی',
    imageUrl: 'blob:https://sanatpish.com/private-preview',
  });
  recordVisionRecentSearch({
    code: 'TEST-103',
    title: 'چرخ‌دنده آزمایشی',
    imageUrl: 'https://external.invalid/private-photo.webp',
  });
  recordVisionRecentSearch({
    code: 'TEST-104',
    title: 'تصویر بارگذاری‌شده',
    imageUrl: '/storage/products/550e8400-e29b-41d4-a716-446655440000.webp',
  });
  const afterRemote = values.get(STORAGE_KEY) || '';
  assert.ok(!afterRemote.includes('blob:'));
  assert.ok(!afterRemote.includes('https://'));
  assert.ok(!afterRemote.includes('550e8400-e29b-41d4-a716-446655440000'));
});

test('history accepts only a registered public catalogue image path', () => {
  const { values } = installStorage();
  const items = recordVisionRecentSearch({
    code: 'AT-E003',
    title: 'قطعه کاتالوگ',
    imageUrl: '/storage/products/catalog/e(3).png',
  });

  assert.equal(items[0].imageUrl, '/storage/products/catalog/e(3).png');
  const stored = JSON.parse(values.get(STORAGE_KEY) || '[]') as Array<{ imageUrl?: string }>;
  assert.equal(stored[0]?.imageUrl, '/storage/products/catalog/e(3).png');
});

test('history de-duplicates by product code and keeps at most eight entries', () => {
  installStorage();
  for (let i = 0; i < 10; i++) {
    recordVisionRecentSearch({ code: `SKU-${i}`, title: `قطعه ${i}` });
  }
  recordVisionRecentSearch({ code: 'SKU-9', title: 'قطعه نهم - به‌روزرسانی' });
  const items = loadVisionRecentSearches();
  assert.equal(items.length, 8);
  assert.equal(items[0].title, 'قطعه نهم - به‌روزرسانی');
  assert.equal(items.filter(item => item.code === 'SKU-9').length, 1);
});
