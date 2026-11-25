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

test('category and family screens use the Supabase-backed POPD reference API', () => {
  const all = read('src/pages/PopdAllCategoriesPage.tsx');
  const category = read('src/pages/PopdExcelMenuCategoryPage.tsx');
  const detail = read('src/pages/PopdProductDetailPage.tsx');
  assert.match(all, /\/api\/catalog\/reference\/categories/);
  assert.match(all, /\/api\/catalog\/reference\/navigation-groups/);
  assert.match(category, /\/api\/catalog\/reference\/menu-category\//);
  assert.match(detail, /\/api\/catalog\/reference\/product\//);
  assert.doesNotMatch(detail, /useCatalog\s*\(|CatalogContext/);
});

test('only category and family route components are switched to POPD-derived pages', () => {
  const app = read('src/App.tsx');
  const wrapper = read('src/pages/CategoryPage.tsx');
  assert.match(app, /PopdAllCategoriesPage/);
  assert.match(app, /PopdProductDetailPage/);
  assert.match(wrapper, /PopdExcelMenuCategoryPage/);
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


test('family and SKU artwork only use identity-verified matches and never generic fallbacks', () => {
  const api = read('server/catalogReferenceApi.ts');
  const category = read('src/pages/PopdExcelMenuCategoryPage.tsx');
  const detail = read('src/pages/PopdProductDetailPage.tsx');
  const media = read('src/utils/beltCatalogMedia.ts');

  assert.match(api, /image\.scope === 'family'/);
  assert.match(api, /image\.identityVerified === true/);
  assert.match(api, /product\.image = familyImages\[0\] \|\| ''/);
  assert.match(api, /image\.scope === 'variant'/);
  assert.match(api, /when gi\.scope = 'variant' then ia\.family_code/);
  assert.match(api, /auditedCanonicalOwner === canonicalCode/);
  assert.match(api, /familyImageOwnersByUrl/);
  assert.match(api, /owners\.size === 1/);
  assert.doesNotMatch(api, /product\.image = familyImages\[0\] \|\| product\.image/);
  assert.doesNotMatch(category, /resolveSiteProductImage/);
  assert.match(category, /تصویر معتبر ثبت نشده/);
  assert.doesNotMatch(detail, /resolveSiteProductImage/);
  assert.match(detail, /تصویر مرجع خانواده/);
  assert.match(detail, /disableFallback=\{true\}/);
  assert.match(detail, /image\.scope === 'variant'/);
  assert.match(detail, /String\(image\.variantCode \|\| ''\)\.toLowerCase\(\) === activeSkuCode\.toLowerCase\(\)/);
  const nonBelt = read('src/components/product/NonBeltFamilyGrid.tsx');
  assert.match(nonBelt, /images: uniqueImageUrl \? \[uniqueImageUrl\] : \[\]/);
  assert.match(nonBelt, /image: uniqueImageUrl \|\| undefined/);
  assert.doesNotMatch(nonBelt, /product\.images\?\.slice\(0, 1\)/);
  assert.match(media, /hasVerifiedRealPhoto: Boolean\(dbImg\)/);
  assert.match(media, /familyPhotos: \['', '', ''\]/);
  assert.doesNotMatch(media, /familyMedia\.familyPhotos\.forEach/);
  assert.match(media, /activeSkuMedia\?\.realProductImage && activeSkuMedia\.profileDrawingWebp/);
});

test('legacy family image rows are attached by their original family code', () => {
  const api = read('server/catalogReferenceApi.ts');
  assert.match(api, /legacyCodesByCanonical/);
  assert.match(api, /attachGallery\(galleryByFamily\.get\(candidate\)\)/);
  assert.doesNotMatch(api, /familyByOldCode\.get\(directKey\)/);
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
