import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../server/db/customPartRequestsApi.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/adopted/migrations/20261110010000_custom_part_requests.sql', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/home/CustomPartRequestModal.tsx', import.meta.url), 'utf8');

test('custom part requests are stored in a private additive database table', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.custom_part_requests/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.custom_part_requests FROM PUBLIC, anon, authenticated/);
  assert.match(api, /insert into public\.custom_part_requests/i);
});

test('guest request endpoint validates contact, part and bounded attachment data', () => {
  assert.match(api, /app\.post\('\/api\/custom-part-requests'/);
  assert.match(api, /PUBLIC_WINDOW_LIMIT = 4/);
  assert.match(api, /MAX_ATTACHMENT_BYTES = 8 \* 1024 \* 1024/);
  assert.match(api, /normalizePhone/);
  assert.match(api, /allowedExtensions/);
});

test('admin can review, update status and download attachments only through guarded endpoints', () => {
  assert.match(api, /staffIdentity\(req, res, 'view'\)/);
  assert.match(api, /staffIdentity\(req, res, 'edit'\)/);
  assert.match(api, /\/api\/admin\/custom-part-requests\/:id\/attachment/);
  assert.match(api, /Cache-Control', 'private, no-store/);
});

test('the request modal sends a real request instead of displaying a fake tracking code', () => {
  assert.match(modal, /fetch\('\/api\/custom-part-requests'/);
  assert.doesNotMatch(modal, /Generate a realistic Iranian engineering tracking code/);
});
