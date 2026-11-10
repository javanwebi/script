import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../server/db/customPartRequestsApi.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/adopted/migrations/20261110010000_custom_part_requests.sql', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/components/home/CustomPartRequestModal.tsx', import.meta.url), 'utf8');
const vision = readFileSync(new URL('../src/components/search/AiVisualPartSearchModal.tsx', import.meta.url), 'utf8');
const crm = readFileSync(new URL('../src/admin/modules/RealCustomersCrmModule.tsx', import.meta.url), 'utf8');
const adminRequests = readFileSync(new URL('../src/admin/modules/CustomPartRequestsPanel.tsx', import.meta.url), 'utf8');
const deploy = readFileSync(new URL('../ops/deploy-single-port-vps.sh', import.meta.url), 'utf8');

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
  assert.match(deploy, /20261110010000_custom_part_requests\.sql/);
  assert.match(deploy, /CUSTOMER_360_LOCAL_VAULT_ENABLED=true/);
});


test('a no-match vision result opens a prefilled manufacturing request only after the customer clicks', () => {
  assert.match(vision, /const openCustomManufacturingRequest = async/);
  assert.match(vision, /getCustomerDeviceImage\(localImageId\)/);
  assert.match(vision, /createManufacturingImageFile\(imageBlob, originalName\)/);
  assert.match(vision, /onClick=\{\(\) => void openCustomManufacturingRequest\(\)\}/);
  assert.match(vision, /initialFile=\{customRequestDraft\.file\}/);
  assert.match(vision, /observedDimensions/);
  assert.match(vision, /unknownParameters/);
  assert.match(vision, /initialAlloyCondition=\{customRequestDraft\.alloyCondition\}/);
  assert.match(vision, /MAX_MANUFACTURING_IMAGE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(vision, /canvas\.toBlob/);
  assert.match(modal, /initialQuantity\?: string/);
  assert.match(vision, /تصویر اصلی تا زمان ارسال نهایی فرم فقط روی دستگاه شما می‌ماند/);
  assert.match(vision, /customRequestOpen && customRequestDraft/);
});

test('the build request carries image, part details and quantity into the existing private admin CRM', () => {
  assert.match(modal, /initialPartName\?: string/);
  assert.match(modal, /initialFile\?: File \| null/);
  assert.match(modal, /setSelectedFile\(initialFile \|\| null\)/);
  assert.match(modal, /attachmentBase64/);
  assert.match(modal, /contactName, phoneNumber, companyName, partName, partType, dimensions/);
  assert.match(modal, /alloyCondition, quantity, notes/);
  assert.match(crm, /section === 'manufacturing'/);
  assert.match(crm, /<CustomPartRequestsPanel\/>/);
  assert.match(adminRequests, /img src=\{attachmentUrl\}/);
  assert.match(adminRequests, /selected\.contact_name/);
  assert.match(adminRequests, /selected\.phone/);
});
