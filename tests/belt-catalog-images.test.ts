import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import manifestRaw from "../src/generated/beltCatalogManifest";
import popdManifestRaw from "../src/generated/popdBeltMediaManifest";
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
} from "../src/utils/beltCatalogMedia";
import type { Product, ProductGalleryImage } from "../src/types";

const manifest = manifestRaw as unknown as BeltCatalogManifest;
const popd = popdManifestRaw as unknown as {
  sourceCommit: string;
  totals: {
    familiesWithImages: number;
    familyImageFiles: number;
    missingFamilyImages: string[];
    skusWithRealImages: number;
    skuWebImages: number;
    skuRealMarkingImages: number;
  };
  families: Record<string, Array<{ sourcePath: string; targetFile: string; sha: string; size: number }>>;
  skuPhotos: Record<string, { sourcePath: string; targetFile: string; sha: string; size: number; kind: string }>;
};
const BELTS_ROOT = path.resolve("src/assets/catalog/belts");
const FAMILY_ROOT = path.join(BELTS_ROOT, "families");
const SKU_ROOT = path.join(BELTS_ROOT, "skus");

function isWebp(filePath: string) {
  const bytes = fs.readFileSync(filePath);
  return bytes.length > 1000 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

test("POPD belt source manifest is pinned and reconciles exact family/SKU coverage", () => {
  assert.match(popd.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(popd.totals.familiesWithImages, 613);
  assert.equal(popd.totals.familyImageFiles, 1496);
  assert.deepEqual(popd.totals.missingFamilyImages, ["FAM-32929"]);
  assert.equal(popd.totals.skusWithRealImages, 214);
  assert.equal(popd.totals.skuWebImages, 193);
  assert.equal(popd.totals.skuRealMarkingImages, 21);
  assert.equal(Object.keys(popd.families).length, 613);
  assert.equal(Object.keys(popd.skuPhotos).length, 214);
  assert.equal(getBeltManifestTotals().exactVerifiedRealSkuImages, 214);
  assert.deepEqual(
    [...manifest.exactRealSkuIds].sort((a, b) => a.localeCompare(b, "en")),
    Object.keys(popd.skuPhotos).sort((a, b) => a.localeCompare(b, "en")),
  );
});

test("family and SKU helpers never substitute another code's POPD image", () => {
  const photoFamily = Object.keys(popd.families)[0];
  const photoSku = Object.keys(popd.skuPhotos)[0];
  const noPhotoSku = Object.keys(manifest.skus).find(code => !popd.skuPhotos[code]);
  assert.ok(photoFamily);
  assert.ok(photoSku);
  assert.ok(noPhotoSku);

  const family = getBeltFamilyMedia(photoFamily);
  assert.ok(family);
  assert.equal(family.familyPhotos.length, popd.families[photoFamily].length);
  assert.equal(family.hasVerifiedRealPhoto, true);
  assert.equal(family.hasVerifiedSpecSheet, true);
  assert.equal(family.existingDbImage, null);

  const missingFamily = getBeltFamilyMedia("FAM-32929");
  assert.ok(missingFamily);
  assert.deepEqual(missingFamily.familyPhotos, []);
  assert.equal(missingFamily.hasVerifiedRealPhoto, false);
  assert.equal(missingFamily.hasVerifiedSpecSheet, false);

  const skuFamily = manifest.skus[photoSku];
  const photo = getBeltSkuMedia(skuFamily, photoSku);
  assert.ok(photo);
  assert.equal(photo.realImageStatus, "EXACT_SKU_IMAGE_FOUND");
  assert.equal(photo.realProductImage, `/src/assets/catalog/belts/skus/${photoSku}/real-product-image.webp`);

  const missing = getBeltSkuMedia(manifest.skus[noPhotoSku], noPhotoSku);
  assert.ok(missing);
  assert.equal(missing.realImageStatus, "REAL_IMAGE_NOT_FOUND");
  assert.equal(missing.realProductImage, null);

  assert.equal(getBeltSkuMedia("FAM-INVALID", photoSku), null);
  assert.equal(isRealBeltFamily(photoFamily), true);
  assert.equal(isRealBeltSku(photoSku), true);
  assert.equal(isExcludedBeltFamily("FAM-31942"), true);
  assert.equal(isExcludedBeltSku("80151"), true);
});

test("belt gallery includes only exact POPD family and SKU photos", () => {
  const photoSku = Object.keys(popd.skuPhotos)[0];
  const noPhotoSku = Object.keys(manifest.skus).find(code => !popd.skuPhotos[code]);
  const familyCode = manifest.skus[photoSku];
  const familyPhotos = popd.families[familyCode] || [];
  assert.ok(noPhotoSku);
  assert.ok(familyPhotos.length > 0);

  const product: Pick<Product, "code" | "name" | "image" | "images" | "variants"> = {
    code: familyCode,
    name: "خانواده تسمه آزمون",
    image: "",
    images: [],
    variants: [
      { code: photoSku, name: "SKU دارای تصویر", size: "A-TEST", price: 0, stock: 0 },
      { code: noPhotoSku, name: "SKU بدون تصویر", size: "B-TEST", price: 0, stock: 0 },
    ],
  };
  const gallery = buildBeltGalleryImages(product, [], photoSku);
  const familyGallery = gallery.filter(image => image.scope === "family");
  const variantGallery = gallery.filter(image => image.scope === "variant");

  assert.equal(familyGallery.length, familyPhotos.length + 1); // POPD family photos + technical spec sheet
  assert.equal(
    familyGallery.filter(image => /family-image-\\d+\\.webp$/.test(image.url)).length,
    familyPhotos.length,
  );
  assert.equal(
    variantGallery.some(image => image.variantCode === photoSku && image.url.endsWith("/real-product-image.webp")),
    true,
  );
  assert.equal(
    variantGallery.some(image => image.variantCode === photoSku && image.url.endsWith("/profile-drawing.webp")),
    true,
  );
  assert.equal(variantGallery.some(image => image.variantCode === noPhotoSku), false);

  const noPhotoGallery = buildBeltGalleryImages(product, [], noPhotoSku);
  assert.equal(
    noPhotoGallery.some(image => image.scope === "variant" && image.variantCode === noPhotoSku),
    false,
  );
});

test("on-disk belt photos exactly match POPD: 613 families, 214 SKUs, and no stale fallback photos", () => {
  assert.equal(fs.existsSync(path.join(BELTS_ROOT, "_candidates")), false);
  assert.equal(fs.existsSync(path.join(BELTS_ROOT, "_master")), false);

  for (const familyCode of Object.keys(manifest.families)) {
    const dir = path.join(FAMILY_ROOT, familyCode);
    const expected = new Set((popd.families[familyCode] || []).map(entry => entry.targetFile));
    for (const file of [
      "family-image-01.webp",
      "family-image-02.webp",
      "family-image-03.webp",
      "family-image-04.webp",
    ]) {
      const filePath = path.join(dir, file);
      assert.equal(fs.existsSync(filePath), expected.has(file), `${familyCode}/${file} must exactly match POPD`);
      if (expected.has(file)) assert.equal(isWebp(filePath), true, `${familyCode}/${file} must be a valid WebP`);
    }
    assert.ok(fs.statSync(path.join(dir, "family-specifications.webp")).size > 1000);
  }

  let foundSkuPhotos = 0;
  for (const skuCode of Object.keys(manifest.skus)) {
    const filePath = path.join(SKU_ROOT, skuCode, "real-product-image.webp");
    const expected = Object.prototype.hasOwnProperty.call(popd.skuPhotos, skuCode);
    assert.equal(fs.existsSync(filePath), expected, `SKU ${skuCode} photo presence must match POPD`);
    if (expected) {
      foundSkuPhotos++;
      assert.equal(isWebp(filePath), true, `SKU ${skuCode} must be a valid WebP`);
    }
  }
  assert.equal(foundSkuPhotos, 214);
});
