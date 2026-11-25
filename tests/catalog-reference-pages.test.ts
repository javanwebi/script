import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

test('catalog reference API reads the engineered POPD archive without mutating catalog tables', () => {
  const api = read('server/catalogReferenceApi.ts');
  assert.match(api, /app_private\.source_archives/);
  assert.match(api, /github\/javanwebi\/POPD\/server\/data\/engineeredCatalog\.json/);
  assert.match(api, /resolvedAssignment/);
  assert.match(api, /identity_verified/);
  assert.doesNotMatch(api, /\b(?:INSERT\s+INTO|UPDATE\s+public\.catalog_|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE)\b/i);
});

test('POPD reference API is used for family detail while category appearance remains in SCRIPT', () => {
  const detail = read('src/pages/PopdProductDetailPage.tsx');
  const category = read('src/pages/CategoryPage.tsx');
  assert.match(detail, /\/api\/catalog\/reference\/product\//);
  assert.doesNotMatch(detail, /useCatalog\s*\(|CatalogContext/);
  assert.match(category, /from '\.\/ExcelMenuCategoryPage'/);
  assert.doesNotMatch(category, /PopdExcelMenuCategoryPage/);
});

test('category and direct-SKU page appearance stays in SCRIPT while family detail uses POPD', () => {
  const app = read('src/App.tsx');
  const wrapper = read('src/pages/CategoryPage.tsx');
  assert.match(app, /pages\/AllCategoriesPage/);
  assert.match(app, /pages\/DirectSkuDetailPage/);
  assert.match(app, /pages\/PopdProductDetailPage/);
  assert.doesNotMatch(app, /PopdAllCategoriesPage/);
  assert.match(wrapper, /ExcelMenuCategoryPage/);
  assert.doesNotMatch(wrapper, /PopdExcelMenuCategoryPage/);
});

test('catalog price panel keeps POPD default-on persisted panel mode', () => {
  const hook = read('src/hooks/useCatalogPanelMode.ts');
  assert.match(hook, /sanatpish_panel_mode_v1/);
  assert.match(hook, /getItem\(PANEL_MODE_KEY\) !== '0'/);
});

test('belt family media can resolve canonical families through legacy family codes', () => {
  const media = read('src/utils/beltCatalogMedia.ts');
  assert.match(media, /legacyFamilyCodes/);
  assert.match(media, /hasVerifiedRealPhoto/);
});


test('POPD e869 SKU images are attached by exact SKU code while family artwork stays identity-verified', () => {
  const api = read('server/catalogReferenceApi.ts');
  const category = read('src/pages/PopdExcelMenuCategoryPage.tsx');
  const detail = read('src/pages/PopdProductDetailPage.tsx');
  const media = read('src/utils/beltCatalogMedia.ts');

  assert.match(api, /e869_linked_catalog\.json/);
  assert.match(api, /assignment\?\.targetKind !== 'variant'/);
  assert.match(api, /e869ImageBySku\.get\(variantKey\)/);
  assert.match(api, /!e869ImageUrls\.has\(normalizeCode\(row\.url\)\)/);
  assert.match(api, /e869ImageUrls\.has\(normalizeCode\(image\.url\)\)/);
  assert.match(api, /const images = e869Image \? \[e869Image\] : \[\]/);
  assert.match(api, /e869Assignments\.length !== 869/);
  assert.match(api, /missingActiveE869Skus/);
  assert.match(api, /image\.scope === 'family'/);
  assert.match(api, /image\.identityVerified === true/);
  assert.match(api, /product\.image = familyImages\[0\] \|\| ''/);
  assert.match(api, /familyImageOwnersByUrl/);
  assert.match(api, /owners\.size === 1/);
  assert.doesNotMatch(api, /galleryByVariant/);
  assert.doesNotMatch(api, /product\.image = familyImages\[0\] \|\| product\.image/);
  assert.doesNotMatch(category, /resolveSiteProductImage/);
  assert.match(category, /تصویر معتبر ثبت نشده/);
  assert.doesNotMatch(detail, /resolveSiteProductImage/);
  assert.match(detail, /تصویر مرجع خانواده/);
  assert.match(detail, /disableFallback=\{true\}/);
  assert.match(detail, /image\.scope === 'variant'/);
  assert.match(detail, /String\(image\.variantCode \|\| ''\)\.toLowerCase\(\) === activeSkuCode\.toLowerCase\(\)/);
  // Family artwork is sourced from the pinned POPD media manifest, never a DB thumbnail.
  assert.match(media, /popdMedia\.families\[clean\]/);
  assert.match(media, /const hasVerifiedRealPhoto = familyPhotos\.length > 0/);
  assert.match(media, /existingDbImage: null/);
  assert.match(media, /familyPhotos,/);
  assert.match(media, /hasVerifiedSpecSheet: hasVerifiedRealPhoto/);
  assert.match(media, /familyMedia\.familyPhotos\.forEach/);
  assert.match(media, /activeSkuMedia\?\.realProductImage && activeSkuMedia\.profileDrawingWebp/);
  const nonBelt = read('src/components/product/NonBeltFamilyGrid.tsx');
  assert.match(nonBelt, /images: uniqueImageUrl \? \[uniqueImageUrl\] : \[\]/);
  assert.match(nonBelt, /image: uniqueImageUrl \|\| undefined/);
  assert.doesNotMatch(nonBelt, /product\.images\?\.slice\(0, 1\)/);
});

test('legacy family image rows are attached by their original family code', () => {
  const api = read('server/catalogReferenceApi.ts');
  assert.match(api, /legacyCodesByCanonical/);
  assert.match(api, /attachGallery\(galleryByFamily\.get\(candidate\)\)/);
  assert.doesNotMatch(api, /familyByOldCode\.get\(directKey\)/);
});



test('category artwork mapping remains the existing SCRIPT design', () => {
  const artwork = read('src/utils/excelCategoryCatalog.ts');
  assert.match(artwork, /excel-v2-1-1.*timingBeltHero/);
  assert.match(artwork, /excel-v2-2-1.*categories\.conveyor/);
  assert.doesNotMatch(artwork, /excel-v2-1-5/);
});

test('all active Supabase categories and their database group assignments remain visible', () => {
  const api = read('server/catalogReferenceApi.ts');
  assert.match(api, /const activeCategorySlugs = categoryRes\.rows\.length/);
  assert.match(api, /const activeGroupCategorySlugs = new Set/);
  assert.match(api, /dbGroup\?\.categorySlugs/);
  assert.match(api, /metadata\.children/);
  assert.match(api, /hasMetadataChildren \? metadataChildren/);
  assert.match(api, /hasMetadataSubcategories/);
  assert.match(api, /categoryRowsBySlug\.get\(slug\)/);
  assert.match(api, /activeVerifiedVariantImageUrls/);
  assert.match(api, /verifiedVariantImageCount: activeVerifiedVariantImageUrls\.size/);
  assert.match(api, /categoryRows\.map\(\(dbCategory: any\)/);
  assert.match(api, /ungrouped\.length \|\| unknownGroupCategories\.length/);
});

test('reference catalog reports only attached artwork and preserves legacy product routes', () => {
  const api = read('server/catalogReferenceApi.ts');
  const detail = read('src/pages/PopdProductDetailPage.tsx');
  assert.match(api, /activeVerifiedFamilyImageUrls/);
  assert.match(api, /verifiedFamilyImageCount: activeVerifiedFamilyImageUrls\.size/);
  assert.match(detail, /LegacyProductDetailPage/);
  assert.match(detail, /status === 'not-found'/);
});


test('POPD 869-image release is staged for canary and used by both product and vision image readers', () => {
  const storage = read('server/productImageStorage.ts');
  const server = read('server.ts');
  const sync = read('scripts/sync-popd-catalog-images.mjs');
  const deploy = read('ops/deploy-single-port-vps.sh');
  assert.match(storage, /CATALOG_IMAGE_READ_DIR/);
  assert.match(storage, /CATALOG_IMAGE_READ_DIR_MISSING/);
  assert.ok(server.includes('activeCatalogDirectory(productStorageDirectory())'));
  assert.ok(sync.includes('CATALOG_IMAGE_RELEASE_ID'));
  assert.ok(sync.includes('CATALOG_IMAGE_ACTIVATE !== "false"'));
  assert.ok(deploy.includes('node scripts/sync-popd-catalog-images.mjs'));
  assert.ok(deploy.includes('CATALOG_IMAGE_READ_DIR=$POPD_CATALOG_IMAGE_RELEASE_DIR'));
  assert.ok(deploy.includes('CATALOG_IMAGE_ACTIVATE=false'));
  const imageStage = deploy.slice(deploy.indexOf('STAGE AND VERIFY PINNED POPD'), deploy.indexOf('PRIVATE CANARY WITHOUT A HOST PORT'));
  assert.ok(imageStage.includes('PRODUCT_STORAGE_DIR=$POPD_CATALOG_STORAGE_ROOT'));
  assert.ok(!imageStage.includes('--env-file "$ENV_FILE"'), 'image-only staging must not receive application secrets');
});


test('missing verified POPD family photos are synced from the pinned source before builds', () => {
  const pkg = JSON.parse(read('package.json'));
  const sync = read('scripts/sync-popd-family-images.mjs');
  assert.ok(pkg.scripts.prebuild.includes('scripts/sync-popd-family-images.mjs'));
  assert.ok(pkg.scripts.predev.includes('scripts/sync-popd-family-images.mjs'));
  assert.ok(pkg.scripts['pretest:portal'].includes('scripts/sync-popd-family-images.mjs'));
  assert.match(sync, /e81218f2a248f1db9a72349a67e46af55c7977ee/);
  assert.ok(sync.includes('images=${ASSETS.length}'));
  assert.match(sync, /gitBlobSha/);
  assert.match(sync, /POPD_FAMILY_IMAGE_SHA_MISMATCH/);
});


test('Excel menu category pages use the authoritative POPD reference payload for families and products', () => {
  const page = read('src/pages/ExcelMenuCategoryPage.tsx');
  const api = read('server/catalogReferenceApi.ts');
  assert.match(page, /\/api\/catalog\/reference\/menu-category\//);
  assert.match(page, /Array\.isArray\(body\.products\)/);
  assert.match(page, /\(data\?\.products \|\| \[\]\)/);
  assert.doesNotMatch(page, /getAllProducts\(\)/);
  assert.doesNotMatch(page, /\/api\/catalog\/menu-category\//);
  assert.match(api, /function categoryPayload\(snapshot: Snapshot, slug: string\)/);
  assert.match(api, /matchedProducts\.push\(/);
  assert.match(api, /products: matchedProducts/);
  assert.match(api, /snapshot\.assignmentsByFamily\.get\(product\.code\)/);
});


test('all category surfaces derive subnavigation only from POPD family assignments and archive-owned direct SKUs', () => {
  const api = read('server/catalogReferenceApi.ts');
  const detail = read('src/pages/ExcelMenuCategoryPage.tsx');
  const directory = read('src/pages/AllCategoriesPage.tsx');
  const megaMenu = read('src/components/catalog/ReferenceMegaMenu.tsx');

  assert.match(api, /function buildReferenceCategoryChildren\(/);
  assert.match(api, /function referenceCategoryTaxonomy\(snapshot: Snapshot, category: Category\)/);
  assert.match(api, /snapshot\.products\.flatMap/);
  assert.match(api, /snapshot\.directSkuAssignments/);
  assert.match(api, /payload\.directSkus/);
  assert.doesNotMatch(api, /from public\.catalog_direct_skus/);
  assert.match(api, /const children = buildReferenceCategoryChildren\(\[\.\.\.familyAssignments, \.\.\.directSkuAssignments\]\)/);
  assert.match(api, /children,\s*subcategories: children\.map\(\(node\) => node\.name\)/);
  assert.doesNotMatch(api, /referenceChildren\.length\s*\?/);
  assert.match(api, /categories: snapshot\.categories\.map\(\(category\) => referenceCategoryTaxonomy\(snapshot, category\)\)/);
  assert.match(api, /standaloneDirectSkuRows: directSkus\.length/);
  assert.match(api, /directSkus: snapshot\.directSkus\.filter/);
  assert.match(detail, /const directSkus = data\?\.directSkus \|\| \[\]/);
  assert.doesNotMatch(detail, /useDirectSkus\(slug\)/);

  assert.match(detail, /\/api\/catalog\/reference\/menu-category\//);
  assert.match(directory, /\/api\/catalog\/reference\/categories/);
  assert.match(directory, /\/api\/catalog\/reference\/navigation-groups/);
  assert.match(megaMenu, /\/api\/catalog\/reference\/categories/);
  assert.match(megaMenu, /\/api\/catalog\/reference\/navigation-groups/);
});
