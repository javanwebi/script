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

test('customer image bytes are request-scoped and never written or cached on the server', () => {
  const processor = sourceSection('async function persistCustomerImage(', '\nfunction validatePresetImageImportUrl');
  assert.match(processor, /sharp\(/);
  assert.match(processor, /dataUrl:/);
  assert.match(processor, /buffer: input/);
  assert.doesNotMatch(processor, /writeFile|appendFile|createWriteStream|mkdir|IMAGE_AI_DIR|cacheCustomerImageBuffer|customerImageMemoryCache|syncCustomerImageToGitHub|GITHUB_BACKUP/);

  const resolver = sourceSection('async function resolveCustomerImageBufferAndInfo(', '// Backward compatibility alias');
  assert.match(resolver, /persistCustomerImage/);
  assert.doesNotMatch(resolver, /customerImageMemoryCache|cacheCustomerImageBuffer|writeFile|IMAGE_AI_DIR/);

  const base64 = sourceSection('async function saveBase64CustomerImageForWorker(', "app.get('/api/ai/catalog-images/:id'");
  assert.match(base64, /imageUrl: prepared\.dataUrl/);
  assert.doesNotMatch(base64, /writeFile|appendFile|mkdir|cacheCustomerImageBuffer|customerImageMemoryCache|syncCustomerImageToGitHub/);
});

test('customer images are never published to IMAGE_AI_DIR for worker or Gemini comparison', () => {
  const worker = sourceSection('async function callPartRecognitionWorker(', 'function buildWorkerAnalysisPrompt');
  assert.doesNotMatch(worker, /createVisionImagePublisher|publishImage/);
  const verification = sourceSection('async function verifyCandidatesVisuallyWithGemini(', 'function workerCatalogAuthStatus');
  assert.doesNotMatch(verification, /createVisionImagePublisher|publishImage/);
  const analysis = sourceSection('async function analyzePartWithWorker(', 'async function saveBase64CustomerImageForWorker');
  assert.match(analysis, /catalogImagePublisher/);
  assert.doesNotMatch(analysis, /workerVision\(\[\{role:'user',parts\}\],\{publishImage/);
  assert.doesNotMatch(analysis, /verifyCandidatesVisuallyWithGemini\([\s\S]*?createVisionImagePublisher/);
});

test('server has no customer image disk, object-store, GitHub or public-memory cache path', () => {
  assert.doesNotMatch(serverSource, /GITHUB_BACKUP_REPO|GITHUB_BACKUP_TOKEN|syncCustomerImageToGitHub/);
  assert.doesNotMatch(serverSource, /customerImageMemoryCache|cacheCustomerImageBuffer|customerImagePublicUrl/);
  assert.match(serverSource, /customerImageBuffer:uploaded\.buffer/);
  assert.doesNotMatch(serverSource, /customerImageUrl:\s*uploaded\.imageUrl|customerImageUrl:\s*customerUrl/);
  assert.match(serverSource, /imageHash:crypto\.createHash\('sha256'\)\.update\(uploaded\.buffer\)/);
  assert.doesNotMatch(serverSource, /customerImageUrl:\s*uploaded\.imageUrl/);
});

test('raw customer upload compatibility route returns a request-scoped data URL', () => {
  const route = sourceSection("app.post(\n  '/api/ai/customer-images'", '// Preset catalogue photos');
  assert.match(route, /persistCustomerImage/);
  assert.match(route, /imageUrl: saved\.dataUrl/);
  assert.doesNotMatch(route, /customerImagePublicUrl|writeFile|cacheCustomerImageBuffer/);
});
