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

test('customer image originals are not persisted or retrievable from server storage', () => {
  const ingest = sourceSection(
    'async function prepareCustomerImageForRequest(',
    'function validatePresetImageImportUrl('
  );
  assert.match(ingest, /data:image\/jpeg;base64/);
  assert.match(ingest, /buffer: optimized/);
  assert.doesNotMatch(ingest, /writeFile|createWriteStream|copyFile|renameSync|IMAGE_AI_DIR|storage\.from|bytea/i);

  for (const forbidden of [
    'customerImageMemoryCache',
    'cacheCustomerImageBuffer',
    'customerImagePublicUrl',
    'syncCustomerImageToGitHub',
    'GITHUB_BACKUP_REPO',
  ]) assert.equal(serverSource.includes(forbidden), false, 'server must not retain customer image mechanism: ' + forbidden);

  assert.doesNotMatch(serverSource, /app\.get\(\s*\[['"]\/imageai\/:[^\]]+\]\s*,/);
});

test('region detection accepts request-scoped image bytes and retains only a digest with crop metadata', () => {
  const detect = sourceSection(
    "app.post('/api/ai/detect-regions'",
    "app.post('/api/ai/analyze-part'"
  );
  assert.match(detect, /req\.body\?\.imageBase64/);
  assert.match(detect, /createHash\('sha256'\)/);
  assert.match(detect, /imageDigest/);
  assert.doesNotMatch(detect, /localVisionDetectionCache\.set\(detectionId,\s*\{\s*imageUrl/);
});

test('Customer 360 image records are metadata-only and never expose a server image URL', () => {
  const api = sourceSection(
    "app.post('/api/customer-intelligence/image-identifications'",
    "app.post('/api/customer-intelligence/image-identifications/:id/result'"
  );
  assert.match(api, /deviceImageId/);
  assert.match(api, /image_sha256/);
  assert.doesNotMatch(api, /imageBase64|data:image|imageUrl|storage_path|bytea/i);
});
