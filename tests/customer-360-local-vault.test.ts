import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

test('customer image originals are saved automatically in device-local IndexedDB without a permission prompt', () => {
  const vault = read('src/services/customerImageVault.ts');
  assert.ok(vault.includes('indexedDB.open'));
  assert.ok(vault.includes('new Blob([blob], { type: mimeType })'));
  assert.ok(vault.includes('createObjectStore(STORE_NAME'));
  assert.ok(vault.includes('blob: storedBlob'));
  assert.ok(!vault.includes('navigator.storage.persist('));
  assert.ok(!vault.includes('export async function delete'));
  assert.ok(!vault.includes('localStorage'));
});

test('new customer-image processing does not write image bytes to server disk or GitHub', () => {
  const server = read('server.ts');
  const start = server.indexOf('async function persistCustomerImage');
  const end = server.indexOf('function validatePresetImageImportUrl', start);
  assert.ok(start >= 0 && end > start, 'customer image processor must exist');
  const processor = server.slice(start, end);
  for (const forbidden of ['writeFile', 'mkdir(', 'IMAGE_AI_DIR', 'syncCustomerImageToGitHub']) {
    assert.ok(!processor.includes(forbidden), 'image processor must not use ' + forbidden);
  }
  assert.ok(!server.includes('syncCustomerImageToGitHub'));
  assert.ok(!server.includes('GITHUB_BACKUP_REPO'));
  assert.ok(!server.includes('customerImageMemoryCache'));
  assert.ok(!server.includes('cacheCustomerImageBuffer'));
  assert.ok(!server.includes('customerImagePublicUrl'));
  assert.ok(server.includes('imageHash:crypto.createHash'));
  assert.ok(server.includes('imageUrl: saved.dataUrl'));
  assert.ok(server.includes('customerImageBuffer:uploaded.buffer'));
  assert.ok(!server.includes('customerUrl'));
  assert.ok(!server.includes('customerImageUrl:customerUrl'));
});

test('customer intelligence API stores only device metadata and verifies selected recognition candidates', () => {
  const api = read('server/db/customerIntelligenceApi.ts');
  for (const required of [
    'req.body?.imageBase64',
    'فایل تصویر فقط روی دستگاه مشتری',
    'customer_image_identifications',
    'deviceImageId',
    'recognition_result',
    'CUSTOMER_360_LOCAL_VAULT_ENABLED',
    'این کد در نتایج همین شناسایی وجود ندارد',
  ]) assert.ok(api.includes(required), 'API should include ' + required);
  assert.ok(api.includes('resolveCustomerTarget'));
  const resultRoute = api.slice(api.indexOf("app.post('/api/customer-intelligence/image-identifications/:id/result'"), api.indexOf("app.post('/api/customer-intelligence/image-identifications/:id/select'"));
  assert.ok(!resultRoute.includes('selected_product_code='));
});

test('Customer 360 schema has RLS, no image blob columns, and supports CRM-only follow-ups', () => {
  const migration = read('supabase/adopted/migrations/20261109010000_customer_360_local_vault.sql');
  const tables = [
    'customer_image_identifications',
    'customer_ai_consultations',
    'customer_product_interests',
    'customer_product_consultation_items',
    'customer_followups',
  ];
  for (const table of tables) {
    assert.ok(migration.includes('create table if not exists public.' + table));
    assert.ok(migration.includes('alter table public.' + table + ' enable row level security'));
  }
  const schema = migration.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  for (const forbidden of ['bytea', 'storage_path', 'image_url']) {
    assert.ok(!schema.toLowerCase().includes(forbidden), 'schema must not include ' + forbidden);
  }
  assert.ok(migration.includes('unique(user_id, device_image_id)'));
  assert.ok(migration.includes('crm_customer_id text references public.crm_customers(id)'));
  assert.ok(migration.includes('check ((user_id is not null) <> (crm_customer_id is not null))'));
});

test('FORZA consultation supports exact catalogue SKU selection and product-page entry', () => {
  const catalog = read('src/components/search/WorkspaceCatalog.tsx');
  const page = read('src/pages/AiConsultPage.tsx');
  const detail = read('src/pages/ProductDetailPage.tsx');
  for (const required of ['onAddToConsultation', 'variant.code']) assert.ok(catalog.includes(required));
  for (const required of ['selectedConsultProducts', 'productCodes: selectedConsultProducts.map', 'saveCustomerConsultation']) {
    assert.ok(page.includes(required));
  }
  assert.ok(page.includes('sessionMessages.slice(-32)'));
  assert.ok(page.includes('text: message.text.slice(0, 1800)'));
  assert.ok(detail.includes('ai-consult?productCode='));
});

test('CRM exposes image history, FORZA consultations, purchase analytics and CRM-only follow-ups', () => {
  const ui = read('src/admin/modules/RealCustomersCrmModule.tsx');
  const api = read('server/db/adminCustomersApi.ts');
  const intelligence = read('server/db/customerIntelligenceApi.ts');
  for (const required of ['تاریخچه تصاویر شناسایی', 'مشاوره FORZA', 'تحلیل خرید', 'ثبت پیگیری جدید', 'image_sha256']) {
    assert.ok(ui.includes(required), 'CRM UI should include ' + required);
  }
  for (const required of ['monthlyPurchases', 'yearlyPurchases', 'topProducts', 'customer_ai_consultations', 'crm_customer_id']) {
    assert.ok(api.includes(required), 'CRM API should include ' + required);
  }
  assert.ok(intelligence.includes('crm_customer_id'));
  assert.ok(intelligence.includes('host !== req.headers.host'));
  assert.ok(intelligence.includes('catalog_variants where code = any($1::text[])'));
  assert.ok(intelligence.includes('نتیجه شناسایی فقط می‌تواند کدهای واقعی کاتالوگ را ثبت کند'));
});

test('customer image bytes are never published to a server image directory for worker or candidate verification', () => {
  const server = read('server.ts');
  const workerStart = server.indexOf('async function callPartRecognitionWorker(');
  const workerEnd = server.indexOf('function buildWorkerAnalysisPrompt', workerStart);
  assert.ok(workerStart >= 0 && workerEnd > workerStart);
  const worker = server.slice(workerStart, workerEnd);
  assert.ok(!worker.includes('createVisionImagePublisher'));
  assert.ok(!worker.includes('publishImage'));
  const verifyStart = server.indexOf('async function verifyCandidatesVisuallyWithGemini(');
  const verifyEnd = server.indexOf('function workerCatalogAuthStatus', verifyStart);
  assert.ok(verifyStart >= 0 && verifyEnd > verifyStart);
  const verify = server.slice(verifyStart, verifyEnd);
  assert.ok(!verify.includes('createVisionImagePublisher'));
  assert.ok(!verify.includes('publishImage'));
});

test('guest image recognition stays available and camera frames are not saved before confirmation', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  const modal = read('src/components/search/AiVisualPartSearchModal.tsx');
  assert.ok(!page.includes('برای ثبت سابقه شناسایی در پرونده مشتری، ابتدا وارد حساب خود شوید'));
  assert.ok(page.includes("currentUser?.id || 'guest'"));
  const pageCamera = page.slice(page.indexOf('const capturePhoto'), page.indexOf('const handleFileUpload'));
  assert.ok(!pageCamera.includes('persistCapturedImageOnDevice'));
  const modalCamera = modal.slice(modal.indexOf('const capturePhoto'), modal.indexOf('// Use the existing secure camera'));
  assert.ok(modalCamera.includes('setCameraReview(true)'));
  assert.ok(!modalCamera.includes('saveCustomerDeviceImage'));
  assert.ok(!modalCamera.includes('uploadAndPrepareImage'));
  const confirm = modal.slice(modal.indexOf('const confirmCameraPhoto'), modal.indexOf('// Resolve a match image'));
  assert.ok(confirm.includes('uploadAndPrepareImage(selectedImage, "camera-capture.jpg")'));
  assert.ok(!confirm.includes('handleAnalyze'));
});

test('FORZA uses a shared evidence-led engineering consultation strategy', () => {
  const prompt = read('server/ai/baiConsult.ts');
  for (const required of ['یک سؤال تکمیلی', 'تأیید سازگاری', 'هیچ محصول، قیمت، موجودی یا استانداردی نسازید', 'محصولی را از کاتالوگ برای مشاوره انتخاب کرده']) {
    assert.ok(prompt.includes(required), 'FORZA prompt should include ' + required);
  }
});
