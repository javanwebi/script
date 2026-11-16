import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import manifestRaw from '../src/generated/beltCatalogManifest';
import {
  buildBeltGalleryImages,
  getBeltFamilyMedia,
  getBeltManifestTotals,
  getBeltSkuMedia,
  isExcludedBeltFamily,
  isExcludedBeltSku,
  isRealBeltFamily,
  isRealBeltSku,
  type BeltCatalogManifest,
} from '../src/utils/beltCatalogMedia';
import type { Product, ProductGalleryImage } from '../src/types';

const manifest = manifestRaw as unknown as BeltCatalogManifest;
const BELTS_ASSET_ROOT = path.resolve('src/assets/catalog/belts');
const FAMILIES_DIR = path.join(BELTS_ASSET_ROOT, 'families');
const SKUS_DIR = path.join(BELTS_ASSET_ROOT, 'skus');

const EXCLUDED_PURE_FAMILIES = [
  'FAM-31942',
  'FAM-32711',
  'FAM-10415',
  'FAM-32245',
  'FAM-40642',
  'FAM-35743',
  'FAM-33996',
  'FAM-32247',
  'FAM-32246',
  'FAM-39114',
  'FAM-40601',
] as const;

test('generated belt media manifest records exact inventory counts and contains zero external URLs', () => {
  const rawText = JSON.stringify(manifest);
  assert.equal(/https?:\/\//i.test(rawText), false, 'Manifest must never contain external http(s) URLs');

  const totals = getBeltManifestTotals();
  assert.deepEqual(totals, {
    realBeltFamilies: 614,
    realBeltSkus: 7429,
    excludedPureNonBeltFamilies: 11,
    excludedMixedNonBeltSkus: 22,
    exactVerifiedRealSkuImages: 2,
  });

  assert.equal(Object.keys(manifest.families).length, 614);
  assert.equal(Object.keys(manifest.skus).length, 7429);
  assert.equal(manifest.excludedFamilyIds.length, 11);
  assert.equal(manifest.excludedMixedSkuIds.length, 22);
  assert.deepEqual(manifest.exactRealSkuIds, ['52009', '52050']);

  for (const excludedFam of EXCLUDED_PURE_FAMILIES) {
    assert.equal(manifest.excludedFamilyIds.includes(excludedFam), true);
    assert.equal(Object.prototype.hasOwnProperty.call(manifest.families, excludedFam), false);
  }
});

test('beltCatalogMedia helpers enforce exclusions, DB e(*).png priority, and honest SKU photo status', () => {
  for (const excludedFam of EXCLUDED_PURE_FAMILIES) {
    assert.equal(isExcludedBeltFamily(excludedFam), true);
    assert.equal(isRealBeltFamily(excludedFam), false);
    assert.equal(getBeltFamilyMedia(excludedFam), null);
  }

  assert.equal(isRealBeltFamily('FAM-34388'), true);
  assert.equal(isRealBeltFamily('FAM-80151'), true);
  assert.equal(isRealBeltFamily('FAM-31929'), true);
  assert.equal(isRealBeltFamily('FAM-NONEXISTENT-99999'), false);

  // Mixed-family non-belt SKUs (pulleys/scrapers) must remain excluded
  assert.equal(isExcludedBeltSku('80151'), true);
  assert.equal(isExcludedBeltSku('31929'), true);
  assert.equal(isRealBeltSku('80151'), false);
  assert.equal(isRealBeltSku('31929'), false);
  assert.equal(getBeltSkuMedia('FAM-80151', '80151'), null);
  assert.equal(getBeltSkuMedia('FAM-31929', '31929'), null);

  // Exact verified real SKU images: ONLY 52009 and 52050
  for (const verifiedSku of ['52009', '52050']) {
    assert.equal(isRealBeltSku(verifiedSku), true);
    const media = getBeltSkuMedia('FAM-34388', verifiedSku);
    assert.ok(media);
    assert.equal(media.realImageStatus, 'EXACT_SKU_IMAGE_FOUND');
    assert.equal(media.realProductImage, `/src/assets/catalog/belts/skus/${verifiedSku}/real-product-image.webp`);
    assert.equal(media.technicalDrawingWebp, `/src/assets/catalog/belts/skus/${verifiedSku}/technical-drawing.webp`);
    assert.equal(media.technicalDrawingSvg, `/src/assets/catalog/belts/skus/${verifiedSku}/technical-drawing.svg`);
  }

  // Other SKUs in FAM-34388 must clearly report REAL_IMAGE_NOT_FOUND with null realProductImage
  const s34388 = getBeltSkuMedia('FAM-34388', '34388');
  assert.ok(s34388);
  assert.equal(s34388.realImageStatus, 'REAL_IMAGE_NOT_FOUND');
  assert.equal(s34388.realProductImage, null);
  assert.equal(s34388.realImageStatusLabelFa, 'تصویر واقعی هنوز تأمین نشده است');
  assert.equal(s34388.technicalDrawingWebp, '/src/assets/catalog/belts/skus/34388/technical-drawing.webp');

  // Mismatched family/sku lookup must reject
  assert.equal(getBeltSkuMedia('FAM-35525', '52009'), null);

  // Existing official owner DB e(*).png must remain primaryThumbnail
  const fam35525 = getBeltFamilyMedia('FAM-35525');
  assert.ok(fam35525);
  assert.equal(fam35525.existingDbImage, '/storage/products/catalog/e(159).png');
  assert.equal(fam35525.primaryThumbnail, '/storage/products/catalog/e(159).png');
  assert.equal(fam35525.specSheetWebp, '/src/assets/catalog/belts/families/FAM-35525/family-specifications.webp');
  assert.equal(fam35525.specSheetSvg, '/src/assets/catalog/belts/families/FAM-35525/family-specifications.svg');
});

test('buildBeltGalleryImages preserves official e(*).png first, adds 4 family visuals, and attaches verified real photos only for 52009/52050 plus active SKU profile', () => {
  const fam35525Product: Pick<Product, 'code' | 'name' | 'image' | 'images' | 'variants'> = {
    code: 'FAM-35525',
    name: 'تسمه B اپتی بلت',
    image: '/storage/products/catalog/e(159).png',
    images: ['/storage/products/catalog/e(159).png'],
    variants: [
      { code: '35525', name: 'تسمه B105', size: 'B105', price: 0, stock: 0 },
    ],
  };
  const base35525: ProductGalleryImage[] = [
    { id: 'db-1', url: '/storage/products/catalog/e(159).png', scope: 'family', title: 'کاتالوگ اصلی', order: 1 },
  ];
  const gallery35525 = buildBeltGalleryImages(fam35525Product, base35525);
  assert.equal(gallery35525[0].url, '/storage/products/catalog/e(159).png');
  assert.equal(gallery35525[0].scope, 'family');
  assert.equal(gallery35525.filter((g) => g.scope === 'family').length, 5);
  assert.equal(gallery35525[1].url, '/src/assets/catalog/belts/families/FAM-35525/family-image-01.webp');
  assert.equal(gallery35525[4].url, '/src/assets/catalog/belts/families/FAM-35525/family-specifications.webp');
  assert.equal(gallery35525.length, 6);
  assert.equal(
    gallery35525.filter((g) => g.scope === 'variant').every((g) => g.url.endsWith('/profile-drawing.webp')),
    true,
  );
  assert.equal(
    gallery35525.some((g) => g.url.includes('real-product-image.webp')),
    false,
  );

  const fam34388Product: Pick<Product, 'code' | 'name' | 'image' | 'images' | 'variants'> = {
    code: 'FAM-34388',
    name: 'تسمه تایم L اپتی بلت',
    image: '',
    images: [],
    variants: [
      { code: '34388', name: 'تسمه 150L 050', size: '150L 050', price: 0, stock: 0 },
      { code: '52009', name: 'تسمه 300L 075', size: '300L 075', price: 0, stock: 0 },
      { code: '52050', name: 'تسمه 540L 075', size: '540L 075', price: 0, stock: 0 },
    ],
  };
  const gallery34388 = buildBeltGalleryImages(fam34388Product, []);
  const familyImgs = gallery34388.filter((g) => g.scope === 'family');
  const variantImgs = gallery34388.filter((g) => g.scope === 'variant');
  // 3 family photos + 1 family-specifications.webp = 4 family visuals
  assert.equal(familyImgs.length, 4);
  // 2 exact real photos (52009, 52050) + default active SKU (34388) profile-drawing.webp
  assert.equal(variantImgs.length, 3);
  assert.deepEqual(
    variantImgs.filter((g) => !String(g.id || '').startsWith('belt-sku-profile-')).map((g) => g.variantCode),
    ['52009', '52050'],
  );
  assert.equal(
    variantImgs.some(
      (g) =>
        g.variantCode === '34388' &&
        g.url === '/src/assets/catalog/belts/skus/34388/profile-drawing.webp',
    ),
    true,
  );

  // Switching activeSkuCode to 52050 switches the active SKU CAD profile drawing to 52050
  const gallery52050 = buildBeltGalleryImages(fam34388Product, [], '52050');
  assert.equal(
    gallery52050.some(
      (g) =>
        g.variantCode === '52050' &&
        g.url === '/src/assets/catalog/belts/skus/52050/profile-drawing.webp',
    ),
    true,
  );
  assert.equal(
    gallery52050.some((g) => g.url === '/src/assets/catalog/belts/skus/34388/profile-drawing.webp'),
    false,
  );

  // Excluded family leaves baseGallery completely untouched
  const excludedBase: ProductGalleryImage[] = [
    { id: 'ex-1', url: '/storage/products/catalog/e(1).png', scope: 'family', title: 'تست', order: 1 },
  ];
  const excludedResult = buildBeltGalleryImages(
    { code: 'FAM-31942', name: 'دستگاه آپارات', image: '', images: [], variants: [] },
    excludedBase,
  );
  assert.equal(excludedResult, excludedBase);
});

test('all 614 family dirs and 7,429 SKU dirs exist cleanly on disk with zero staging leftovers and valid image/SVG formatting', async () => {
  assert.equal(fs.existsSync(path.join(BELTS_ASSET_ROOT, '_candidates')), false, '_candidates staging dir must not exist');
  assert.equal(fs.existsSync(path.join(BELTS_ASSET_ROOT, '_master')), false, '_master staging dir must not exist');

  const famDirs = fs.readdirSync(FAMILIES_DIR);
  const skuDirs = fs.readdirSync(SKUS_DIR);
  assert.equal(famDirs.length, 614);
  assert.equal(skuDirs.length, 7429);

  for (const excludedFam of EXCLUDED_PURE_FAMILIES) {
    assert.equal(fs.existsSync(path.join(FAMILIES_DIR, excludedFam)), false);
  }
  for (const excludedSku of manifest.excludedMixedSkuIds) {
    assert.equal(fs.existsSync(path.join(SKUS_DIR, excludedSku)), false);
  }

  for (const famId of Object.keys(manifest.families)) {
    const dir = path.join(FAMILIES_DIR, famId);
    for (const fileName of [
      'family-image-01.webp',
      'family-image-02.webp',
      'family-image-03.webp',
      'family-specifications.svg',
      'family-specifications.webp',
    ]) {
      const stat = fs.statSync(path.join(dir, fileName));
      assert.ok(stat.size > 100, `Expected non-empty asset: ${famId}/${fileName}`);
    }
  }

  let realSkuPhotoFilesFound = 0;
  for (const skuCode of Object.keys(manifest.skus)) {
    const dir = path.join(SKUS_DIR, skuCode);
    for (const fileName of ['technical-drawing.svg', 'technical-drawing.webp']) {
      const stat = fs.statSync(path.join(dir, fileName));
      assert.ok(stat.size > 100, `Expected non-empty asset: ${skuCode}/${fileName}`);
    }
    const realFile = path.join(dir, 'real-product-image.webp');
    if (fs.existsSync(realFile)) {
      realSkuPhotoFilesFound++;
      assert.ok(['52009', '52050'].includes(skuCode), `Unexpected real-product-image.webp on SKU ${skuCode}`);
      assert.ok(fs.statSync(realFile).size > 1000);
    }
  }
  assert.equal(realSkuPhotoFilesFound, 2);

  // Sample WebP metadata + SVG hygiene across every division (one representative family + SKU each)
  const seenDivisions = new Set<string>();
  const sampleSkusByFam = new Map<string, string>();
  for (const [skuCode, famCode] of Object.entries(manifest.skus)) {
    if (!sampleSkusByFam.has(famCode)) sampleSkusByFam.set(famCode, skuCode);
  }

  for (const [famId, entry] of Object.entries(manifest.families)) {
    if (seenDivisions.has(entry.d)) continue;
    seenDivisions.add(entry.d);

    const specWebpMeta = await sharp(path.join(FAMILIES_DIR, famId, 'family-specifications.webp')).metadata();
    assert.equal(specWebpMeta.format, 'webp');
    assert.ok((specWebpMeta.width || 0) >= 800 && (specWebpMeta.height || 0) >= 400);

    const famPhotoMeta = await sharp(path.join(FAMILIES_DIR, famId, 'family-image-01.webp')).metadata();
    assert.equal(famPhotoMeta.format, 'webp');
    assert.ok((famPhotoMeta.width || 0) >= 240 && (famPhotoMeta.height || 0) >= 240);

    const famSvg = fs.readFileSync(path.join(FAMILIES_DIR, famId, 'family-specifications.svg'), 'utf8');
    assert.ok(famSvg.includes('<svg') && famSvg.includes('</svg>'));
    assert.equal(/@import\s+url/i.test(famSvg), false);
    assert.equal(/https?:\/\//i.test(famSvg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')), false);

    const repSku = sampleSkusByFam.get(famId);
    assert.ok(repSku, `Representative SKU missing for ${famId}`);
    const cadMeta = await sharp(path.join(SKUS_DIR, repSku, 'technical-drawing.webp')).metadata();
    assert.equal(cadMeta.format, 'webp');
    assert.ok((cadMeta.width || 0) >= 800 && (cadMeta.height || 0) >= 400);

    const skuSvg = fs.readFileSync(path.join(SKUS_DIR, repSku, 'technical-drawing.svg'), 'utf8');
    assert.ok(skuSvg.includes('<svg') && skuSvg.includes('</svg>'));
    assert.equal(/@import\s+url/i.test(skuSvg), false);
    assert.equal(/https?:\/\//i.test(skuSvg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')), false);
  }
  assert.equal(seenDivisions.size, 12, 'Expected representative coverage across all 12 dominant family divisions');
});

test('missing SKU real images audit JSON & Markdown reports reconcile 7,427 missing SKUs and all 16 SKU divisions render valid CAD drawings', async () => {
  const jsonReport = JSON.parse(
    fs.readFileSync(path.resolve('docs/belt-missing-sku-real-images.json'), 'utf8'),
  ) as {
    totalRealBeltSkus: number;
    exactVerifiedRealSkuImagesCount: number;
    missingRealImageCount: number;
    missingByDivision: Record<string, number>;
    missingSkus: { skuCode: string; division: string; status: string }[];
    excludedPureNonBeltFamilies: string[];
    excludedMixedNonBeltSkus: { skuCode: string }[];
  };

  assert.equal(Object.keys(jsonReport.missingByDivision).length, 16);
  const seenSkuDivisions = new Set<string>();
  for (const row of jsonReport.missingSkus) {
    if (seenSkuDivisions.has(row.division)) continue;
    seenSkuDivisions.add(row.division);
    const cadMeta = await sharp(path.join(SKUS_DIR, row.skuCode, 'technical-drawing.webp')).metadata();
    assert.equal(cadMeta.format, 'webp');
    assert.ok((cadMeta.width || 0) >= 800 && (cadMeta.height || 0) >= 400);
    const skuSvg = fs.readFileSync(path.join(SKUS_DIR, row.skuCode, 'technical-drawing.svg'), 'utf8');
    assert.ok(skuSvg.includes('<svg') && skuSvg.includes('</svg>'));
  }
  assert.equal(seenSkuDivisions.size, 16, 'Expected representative CAD check across all 16 SKU divisions');

  assert.equal(jsonReport.totalRealBeltSkus, 7429);
  assert.equal(jsonReport.exactVerifiedRealSkuImagesCount, 2);
  assert.equal(jsonReport.missingRealImageCount, 7427);
  assert.equal(jsonReport.missingSkus.length, 7427);
  assert.equal(jsonReport.excludedPureNonBeltFamilies.length, 11);
  assert.equal(jsonReport.excludedMixedNonBeltSkus.length, 22);
  assert.equal(jsonReport.missingSkus.some((x) => x.skuCode === '52009' || x.skuCode === '52050'), false);
  assert.ok(jsonReport.missingSkus.every((x) => x.status === 'REAL_IMAGE_NOT_FOUND'));

  const mdReport = fs.readFileSync(path.resolve('docs/belt-missing-sku-real-images.md'), 'utf8');
  assert.ok(mdReport.includes('614'));
  assert.ok(mdReport.includes('7429'));
  assert.ok(mdReport.includes('7427'));
  assert.ok(mdReport.includes('52009'));
  assert.ok(mdReport.includes('52050'));
});
