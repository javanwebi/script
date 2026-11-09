import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serverSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');

function sourceSection(startMarker: string, endMarker: string) {
  const start = serverSource.indexOf(startMarker);
  assert.notEqual(start, -1, 'missing source marker: ' + startMarker);
  const end = serverSource.indexOf(endMarker, start);
  assert.notEqual(end, -1, 'missing source end marker: ' + endMarker);
  return serverSource.slice(start, end);
}

test('customer image uploads are processed in bounded process memory only', () => {
  const ingest = sourceSection(
    'async function prepareCustomerImageInMemory(',
    '\nconst GITHUB_BACKUP_REPO'
  );
  assert.match(ingest, /cacheCustomerImageBuffer\(fileName, optimized, 'image\/jpeg'\)/);
  assert.doesNotMatch(ingest, /fs\.promises\.writeFile|writeFileSync|createWriteStream|copyFile|renameSync/);
  assert.doesNotMatch(ingest, /syncCustomerImageToGitHub|GITHUB_BACKUP/);

  const cache = sourceSection(
    'const customerImageMemoryCache = new Map<string, CachedCustomerImage>();',
    '// New customer uploads are served only from this bounded'
  );
  assert.match(cache, /CUSTOMER_IMAGE_MEMORY_TTL_MS/);
  assert.match(cache, /CUSTOMER_IMAGE_MEMORY_MAX_ENTRIES/);
  assert.match(cache, /CUSTOMER_IMAGE_MEMORY_MAX_BYTES/);
  assert.match(cache, /while \(customerImageMemoryCache\.size/);

  const imageRoute = sourceSection(
    "app.get(['/imageai/:fileName', '/imagemoshtari/:fileName']",
    '// Fallback to disk folder'
  );
  assert.match(imageRoute, /private, no-store, max-age=0/);
  assert.match(imageRoute, /Date\.now\(\) - cached\.createdAt/);
  assert.match(imageRoute, /return res\.status\(404\)\.end\(\)/);

  const uploadRoute = sourceSection(
    "app.post(\n  '/api/ai/customer-images'",
    '// Preset catalogue photos'
  );
  assert.match(uploadRoute, /prepareCustomerImageInMemory/);
});

test('customer image cache does not keep duplicate base64 data URLs', () => {
  const cacheType = sourceSection(
    'interface CachedCustomerImage {',
    'const customerImageMemoryCache'
  );
  assert.match(cacheType, /buffer: Buffer/);
  assert.match(cacheType, /createdAt: number/);
  assert.doesNotMatch(cacheType, /dataUrl/);
});
