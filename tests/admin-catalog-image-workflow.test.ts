import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=(path:string)=>fs.readFile(new URL(path,import.meta.url),'utf8');

test('image confirmation persists family images and does not only open a draft',async()=>{
  const audit=await read('../src/admin/modules/ProductImageAudit.tsx');
  const module=await read('../src/admin/modules/ProductsModule.tsx');
  assert.match(audit,/await onAssignFamilyImage\(/);
  assert.match(audit,/await onImageSaved\(/);
  assert.match(module,/fetch\('\/api\/catalog\/overrides\/family'/);
  assert.match(module,/images:nextGallery\.filter\(image=>image\.scope==='family'\)/);
});

test('new SKU creation accepts an explicit code and binds the image to that SKU',async()=>{
  const audit=await read('../src/admin/modules/ProductImageAudit.tsx');
  const module=await read('../src/admin/modules/ProductsModule.tsx');
  assert.match(audit,/newSkuCode/);
  assert.match(audit,/categorySlug:category/);
  assert.match(audit,/await onCreateSku\(/);
  assert.match(module,/variantCode:skuCode/);
  assert.match(module,/images:nextGallery\.filter\(image=>image\.scope==='family'\)/);
});

test('gallery deletion and admin shell isolation are explicit',async()=>{
  const adopted=await read('../server/db/adopted.ts');
  const navigation=await read('../server/catalogNavigationApi.ts');
  const layout=await read('../src/components/layout/Layout.tsx');
  const gallery=await read('../src/data/mockGenerator.ts');
  const storage=await read('../server/productImageStorage.ts');
  assert.match(adopted,/delete from public\.catalog_gallery_images/);
  assert.match(adopted,/const normalizedVariants(?::Row\[\])?=vs\.map/);
  assert.match(navigation,/update public\.catalog_families set category_slug/);
  assert.match(gallery,/familyImageUrls\.has\(url\)/);
  assert.match(storage,/const familyBaseImages=\[\.\.\.new Set/);
  assert.match(layout,/isAdminIsolatedRoute\(location\.pathname\)/);
});

test('direct SKU image links are loaded and refreshed in the audit list',async()=>{
  const audit=await read('../src/admin/modules/ProductImageAudit.tsx');
  const assignments=await read('../src/data/imageAssignments.ts');
  const module=await read('../src/admin/modules/ProductsModule.tsx');
  const navigation=await read('../server/catalogNavigationApi.ts');
  assert.match(audit,/fetch\('\/api\/catalog\/direct-skus'/);
  assert.match(audit,/catalog-direct-skus-updated/);
  assert.match(audit,/getImageAssignmentAudit\(products,records,directSkus\)/);
  assert.match(audit,/row\.directSkus/);
  assert.match(audit,/تصویر بدون اتصال/);
  assert.match(assignments,/directBindings/);
  assert.match(module,/catalog-direct-skus-updated/);
  assert.match(navigation,/app\.post\('\/api\/catalog\/direct-skus'/);
  assert.match(navigation,/insert into public\.catalog_direct_skus/);
});

test('production deploy gate runs admin catalog and image assignment regressions',async()=>{
  const deploy=await read('../ops/deploy-single-port-vps.sh');
  const workflow=await read('../.github/workflows/unified-main-bluegreen.yml');
  const packageJson=JSON.parse(await read('../package.json')) as {scripts?:Record<string,string>};
  assert.match(deploy,/npm run test:portal/);
  assert.match(deploy,/tests\/admin-catalog-image-workflow\.test\.ts/);
  assert.match(deploy,/tests\/image-assignments\.test\.ts/);
  assert.match(workflow,/npm run test:portal/);
  assert.match(workflow,/tests\/admin-catalog-image-workflow\.test\.ts/);
  assert.match(workflow,/tests\/image-assignments\.test\.ts/);
  assert.ok(packageJson.scripts?.['test:portal']?.includes('tests/admin-catalog-image-workflow.test.ts'));
});


test('image assignment form selection survives modal close and a fresh admin page load',async()=>{
  const audit=await read('../src/admin/modules/ProductImageAudit.tsx');
  const draft=await read('../src/data/imageAssignmentDraft.ts');
  const module=await read('../src/admin/modules/ProductsModule.tsx');
  assert.match(audit,/readImageAssignmentDraft/);
  assert.match(audit,/writeImageAssignmentDraft/);
  assert.match(audit,/restoredDraft\?\.familyCode/);
  assert.match(audit,/closeSelection=\(persistedImage\?/);
  assert.match(draft,/IMAGE_ASSIGNMENT_DRAFT_STORAGE_KEY/);
  assert.match(draft,/blob:/);
  assert.match(module,/hasFamilyImage/);
  assert.match(module,/hasSkuImage/);
  assert.match(module,/تأیید اتصال تصویر به کد مستقیم/);
  assert.match(audit,/متصل به کد کالا/);
});

test('direct SKU image writes are cache-invalidated and publicly re-readable',async()=>{
  const navigation=await read('../server/catalogNavigationApi.ts');
  const module=await read('../src/admin/modules/ProductsModule.tsx');
  assert.match(navigation,/invalidatePublicCatalogCache\(\)/);
  assert.match(navigation,/res\.setHeader\('Cache-Control','no-store'\)/);
  assert.match(navigation,/imageUrl:selectedImage/);
  assert.match(module,/\/api\/catalog\/direct-skus\?categorySlug=/);
  assert.match(module,/stored\.imageUrl!==input\.imageUrl/);
});
