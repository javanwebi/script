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
  assert.match(app, /pages\\/AllCategoriesPage/);
  assert.match(app, /pages\\/DirectSkuDetailPage/);
  assert.match(app, /pages\\/PopdProductDetailPage/);
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

  assert.match(api, /e869_linked_catalog\\.json/);
  assert.match(api, /assignment\\?\\.targetKind !== 'variant'/);
  assert.match(api, /e869ImageBySku\\.get\\(variantKey\\)/);
  assert.match(api, /const images = e869Image \\? \\[e869Image\\] : \\[\\]/);
  assert.match(api, /e869Assignments\\.length !== 869/);
  assert.match(api, /missingActiveE869Skus/);
  assert.match(api, /image\\.scope === 'family'/);
  assert.match(api, /image\\.identityVerified === true/);
  assert.match(api, /product\\.image = familyImages\\[0\\] \\|\\| ''/);
  assert.match(api, /familyImageOwnersByUrl/);
  assert.match(api, /owners\\.size === 1/);
  assert.doesNotMatch(api, /galleryByVariant/);
  assert.doesNotMatch(api, /product\\.image = familyImages\\[0\\] \\|\\| product\\.image/);
  assert.doesNotMatch(category, /resolveSiteProductImage/);
  assert.match(category, /تصویر معتبر ثبت نشده/);
  assert.doesNotMatch(detail, /resolveSiteProductImage/);
  assert.match(detail, /تصویر مرجع خانواده/);
  assert.match(detail, /disableFallback=\\{true\\}/);
  assert.match(detail, /image\\.scope === 'variant'/);
  assert.match(detail, /String\\(image\\.variantCode \\|\\| ''\\)\\.toLowerCase\\(\\) === activeSkuCode\\.toLowerCase\\(\\)/);
  assert.match(media, /hasVerifiedRealPhoto: Boolean\\(dbImg\\)/);
  assert.match(media, /familyPhotos: \\['', '', ''\\]/);
  assert.doesNotMatch(media, /familyMedia\\.familyPhotos\\.forEach/);
  assert.match(media, /activeSkuMedia\\?\\.realProductImage && activeSkuMedia\\.profileDrawingWebp/);
  const nonBelt = read('src/components/product/NonBeltFamilyGrid.tsx');
  assert.match(nonBelt, /images: uniqueImageUrl \\? \\[uniqueImageUrl\\] : \\[\\]/);
  assert.match(nonBelt, /image: uniqueImageUrl \\|\\| undefined/);
  assert.doesNotMatch(nonBelt, /product\\.images\\?\\.slice\\(0, 1\\)/);
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
