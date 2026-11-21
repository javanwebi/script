import test from 'node:test';
import assert from 'node:assert/strict';
import { getForegroundRegion, postprocessU2NetMask } from '../src/utils/clientAiSegmentation';

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
