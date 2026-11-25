import test from 'node:test';
import assert from 'node:assert/strict';
import { getForegroundRegion, postprocessU2NetMask } from '../src/utils/clientAiSegmentation';
import { getForegroundRegions } from '../src/utils/foregroundRegion';
import { imageRegionToPixelBounds } from '../src/utils/imageRegion';

test('foreground region rejects empty or invalid masks', () => {
  assert.equal(getForegroundRegion({ width: 4, height: 4, alphaMask: new Uint8Array(16) }), null);
  assert.equal(getForegroundRegion({ width: 4, height: 4, alphaMask: new Uint8Array(4) }), null);
});

test('foreground region returns a padded normalized bounding box', () => {
  const width = 100;
  const height = 80;
  const mask = new Uint8Array(width * height);
  for (let y = 20; y < 55; y++) {
    for (let x = 30; x < 70; x++) mask[y * width + x] = 255;
  }
  const region = getForegroundRegion({ width, height, alphaMask: mask });
  assert.ok(region);
  assert.ok(region.x < 0.30);
  assert.ok(region.y < 0.25);
  assert.ok(region.x + region.width > 0.70);
  assert.ok(region.y + region.height > 0.68);
});

test('foreground region rejects an implausible full-frame mask', () => {
  const width = 40;
  const height = 40;
  const mask = new Uint8Array(width * height).fill(255);
  assert.equal(getForegroundRegion({ width, height, alphaMask: mask }), null);
});

test('U2Net mask postprocessing rejects invalid output and resizes valid saliency maps', () => {
  assert.equal(postprocessU2NetMask(new Float32Array(10), 20, 20), null);
  const values = new Float32Array(320 * 320);
  for (let y = 80; y < 240; y++) {
    for (let x = 80; x < 240; x++) values[y * 320 + x] = 1;
  }
  const mask = postprocessU2NetMask(values, 64, 48);
  assert.ok(mask);
  assert.equal(mask.length, 64 * 48);
});


test('adaptive saliency thresholds keep a small secondary part selectable', () => {
  const width = 200;
  const height = 120;
  const mask = new Uint8Array(width * height);
  for (let y = 20; y < 60; y++) {
    for (let x = 18; x < 58; x++) mask[y * width + x] = 230;
  }
  // A second darker part is below the primary threshold but above the softer pass.
  for (let y = 48; y < 82; y++) {
    for (let x = 132; x < 170; x++) mask[y * width + x] = 92;
  }
  const regions = getForegroundRegions({ width, height, alphaMask: mask }, 110, 6);
  assert.ok(regions.length >= 2);
  assert.ok(regions.some(region => region.x > 0.6), 'the darker part should remain available as a candidate');
});

test('normalized manual crop maps to source pixels and clamps to image bounds', () => {
  assert.deepEqual(
    imageRegionToPixelBounds({ x: 0.2, y: 0.25, width: 0.4, height: 0.5 }, 1000, 800),
    { x: 200, y: 200, width: 400, height: 400 },
  );
  assert.deepEqual(
    imageRegionToPixelBounds({ x: 0.9, y: 0.8, width: 0.1, height: 0.2 }, 100, 100),
    { x: 90, y: 80, width: 10, height: 20 },
  );
  assert.equal(imageRegionToPixelBounds({ x: -0.1, y: 0, width: 0.2, height: 0.2 }, 100, 100), null);
});
