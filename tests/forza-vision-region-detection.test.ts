import assert from 'node:assert/strict';
import test from 'node:test';
import { getForegroundRegion, getForegroundRegions } from '../src/utils/foregroundRegion';

function maskWithParts() {
  const width = 120;
  const height = 90;
  const alphaMask = new Uint8Array(width * height);
  const paint = (left: number, top: number, boxWidth: number, boxHeight: number, value = 230) => {
    for (let y = top; y < top + boxHeight; y++) {
      for (let x = left; x < left + boxWidth; x++) alphaMask[y * width + x] = value;
    }
  };
  paint(40, 22, 42, 38, 245);
  paint(8, 12, 16, 17, 218);
  paint(112, 82, 2, 2, 255);
  return { width, height, alphaMask };
}

test('foreground extraction ranks separate mechanical objects and discards isolated mask noise', () => {
  const source = maskWithParts();
  const regions = getForegroundRegions(source);
  assert.equal(regions.length, 2);
  assert.ok(regions[0].x < 0.4);
  assert.ok(regions[0].x + regions[0].width > 0.68);
  assert.ok(regions[0].y < 0.3);
  assert.ok(regions[0].height > 0.38);
  assert.ok(regions[1].x < 0.25);
  assert.ok(regions.every(region =>
    region.x >= 0 && region.y >= 0 &&
    region.width >= 0.03 && region.height >= 0.03 &&
    region.x + region.width <= 1 && region.y + region.height <= 1
  ));
  assert.deepEqual(getForegroundRegion(source), regions[0]);
});

test('foreground extraction retries with a softer threshold for low-contrast objects', () => {
  const width = 100;
  const height = 80;
  const alphaMask = new Uint8Array(width * height);
  for (let y = 20; y < 60; y++) {
    for (let x = 28; x < 72; x++) alphaMask[y * width + x] = 92;
  }
  const regions = getForegroundRegions({ width, height, alphaMask });
  assert.equal(regions.length, 1);
  assert.ok(regions[0].width > 0.4);
  assert.ok(regions[0].height > 0.4);
});

test('empty, malformed and full-frame masks do not invent a precise object crop', () => {
  const width = 64;
  const height = 64;
  assert.deepEqual(getForegroundRegions({ width, height, alphaMask: new Uint8Array(20) }), []);
  assert.deepEqual(getForegroundRegions({ width, height, alphaMask: new Uint8Array(width * height) }), []);
  assert.deepEqual(getForegroundRegions({
    width,
    height,
    alphaMask: new Uint8Array(width * height).fill(255),
  }), []);
  assert.equal(getForegroundRegion({
    width,
    height,
    alphaMask: new Uint8Array(width * height),
  }), null);
});
