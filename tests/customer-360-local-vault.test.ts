import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('customer image originals are stored in a device-local IndexedDB vault', () => {
  const vault = read('src/services/customerImageVault.ts');
  assert.match(vault, /indexedDB\.open/);
  assert.match(vault, /navigator\.storage/);
  assert.match(vault, /storage\.persist\(\)/);
  assert.match(vault, /createObjectStore\(STORE_NAME/);
  assert.match(vault, /blob,\s*$/m);
  assert.doesNotMatch(vault, /export\s+async\s+function\s+delete/i);
  assert.doesNotMatch(vault, /localStorage/);
});

test('new customer-image processing has no permanent disk or GitHub mirror write', () => {
  const server = read('server.ts');
  const start = server.indexOf('async function persistCustomerImage');
  const end = server.indexOf('function validatePresetImageImportUrl', start);
  assert.ok(start >= 0 && end > start, 'customer image processor must exist');
  const processor = server.slice(start, end);
  assert.doesNotMatch(processor, /writeFile|mkdir\(|IMAGE_AI_DIR|syncCustomerImageToGitHub/);
  assert.doesNotMatch(server, /syncCustomerImageToGitHub|GITHUB_BACKUP_REPO/);
  assert.match(server, /imageUrl: saved\.dataUrl/);
  assert.match(server, /device-local:\/\/temporary-processing/);
});

test('customer intelligence API rejects image bytes and only records device metadata', () => {
  const api = read('server/db/customerIntelligenceApi.ts');
  assert.match(api, /req\.body\?\.imageBase64/);
  assert.match(api, /فایل تصویر فقط روی دستگاه مشتری/);
  assert.match(api, /customer_image_identifications/);
  assert.match(api, /deviceImageId/);
  assert.match(api, /recognition_result/);
  assert.match(api, /CUSTOMER_360_LOCAL_VAULT_ENABLED/);
});

test('Customer 360 schema has RLS and no image blob or permanent storage path', () => {
  const migration = read('supabase/adopted/migrations/20261109010000_customer_360_local_vault.sql');
  for (const table of ['customer_image_identifications','customer_ai_consultations','customer_product_interests','customer_followups']) {
    assert.match(migration, new RegExp('create table if not exists public\\.' + table));
    assert.match(migration, new RegExp('alter table public\\.' + table + ' enable row level security'));
  }
  assert.doesNotMatch(migration, /\bbytea\b|\bstorage_path\b|\bimage_url\b/i);
  assert.match(migration, /unique\(user_id, device_image_id\)/);
});

test('FORZA consultation supports exact catalogue SKU selection and product-page entry', () => {
  const catalog = read('src/components/search/WorkspaceCatalog.tsx');
  const page = read('src/pages/AiConsultPage.tsx');
  const detail = read('src/pages/ProductDetailPage.tsx');
  assert.match(catalog, /onAddToConsultation/);
  assert.match(catalog, /variant\.code/);
  assert.match(page, /selectedConsultProducts/);
  assert.match(page, /productCodes: selectedConsultProducts\.map/);
  assert.match(page, /saveCustomerConsultation/);
  assert.match(detail, /ai-consult\?productCode=/);
});

test('CRM exposes customer image history, FORZA consultations, purchase analytics and follow-ups', () => {
  const ui = read('src/admin/modules/RealCustomersCrmModule.tsx');
  const api = read('server/db/adminCustomersApi.ts');
  assert.match(ui, /تاریخچه تصاویر شناسایی/);
  assert.match(ui, /مشاوره FORZA/);
  assert.match(ui, /تحلیل خرید/);
  assert.match(ui, /ثبت پیگیری جدید/);
  assert.match(api, /monthlyPurchases/);
  assert.match(api, /yearlyPurchases/);
  assert.match(api, /topProducts/);
  assert.match(api, /customer_ai_consultations/);
});

test('FORZA uses a shared evidence-led engineering consultation strategy', () => {
  const prompt = read('server/ai/baiConsult.ts');
  assert.match(prompt, /یک سؤال تکمیلی/);
  assert.match(prompt, /تأیید سازگاری/);
  assert.match(prompt, /هیچ محصول، قیمت، موجودی یا استانداردی نسازید/);
  assert.match(prompt, /محصولی را از کاتالوگ برای مشاوره انتخاب کرده/);
});
