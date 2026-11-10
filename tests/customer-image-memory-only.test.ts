import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const vault = await readFile(new URL('../src/services/customerImageVault.ts', import.meta.url), 'utf8');
const history = await readFile(new URL('../server/db/customerIntelligenceApi.ts', import.meta.url), 'utf8');
const modal = await readFile(new URL('../src/components/search/AiVisualPartSearchModal.tsx', import.meta.url), 'utf8');

test('original customer images and crops are retained in the device IndexedDB vault', () => {
  assert.match(vault, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(vault, /createObjectStore\(STORE_NAME, \{ keyPath: 'id' \}\)/);
  assert.match(vault, /blob: Blob/);
  assert.match(vault, /tx\.objectStore\(STORE_NAME\)\.put\(record\)/);
  assert.match(vault, /getCustomerDeviceImageMetadata/);
  assert.match(vault, /return \{[\s\S]*sha256: record\.sha256[\s\S]*createdAt: record\.createdAt[\s\S]*\};/);
  assert.doesNotMatch(vault, /fetch\(['"]\/api\/ai\/customer-images/);
  assert.doesNotMatch(vault, /localStorage\.setItem/);
});

test('CRM history stores only metadata and recognition results, never the original image bytes or URL', () => {
  assert.match(history, /Never accept image bytes, data URLs, permanent image URLs, or server paths/);
  assert.match(history, /base64\|dataurl\|imageurl\|storagepath\|filepath\|imagebytes\|bloburl/i);
  assert.match(history, /فایل تصویر فقط روی دستگاه مشتری نگهداری می‌شود/);
  assert.match(history, /deviceImageId/);
  assert.match(history, /image_sha256/);
  assert.match(history, /matched_product_codes/);
  assert.match(history, /similar_product_codes/);
  assert.doesNotMatch(history, /attachment_bytes|storage\.from\(/);
});

test('identification sends a temporary image to the AI processor while preserving the local original', () => {
  assert.match(modal, /getCustomerDeviceImage\(effectiveLocalImageId\)/);
  assert.match(modal, /customerImageBlobToDataUrl\(localRecord\.blob\)/);
  assert.match(modal, /createCustomerImageIdentification\(/);
  assert.match(modal, /completeCustomerImageIdentification\(/);
  assert.match(modal, /selectCustomerImageProduct\(/);
  assert.match(modal, /temporaryImageDataUrl/);
  assert.match(modal, /imageBase64/);
});
