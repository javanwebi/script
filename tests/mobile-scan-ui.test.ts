
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("mobile scan action uses existing product identification context, not a duplicate backend", () => {
  const nav = source("src/components/layout/MobileBottomBar.tsx");
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  assert.match(nav, /className="store-scan-action"/);
  assert.match(nav, /openIdentification\?\.\("camera"\)/);
  assert.match(provider, /startWithCamera/);
  assert.match(provider, /initialCamera=\{startWithCamera\}/);
  assert.match(provider, /<Studio isOpen/);
});

test("camera flow captures only a real frame and releases media tracks", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  assert.match(modal, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(modal, /facingMode: "environment"/);
  assert.match(modal, /!isCameraReady \|\| !video\.videoWidth/);
  assert.match(modal, /getTracks\(\)\.forEach/);
  assert.match(modal, /disabled=\{!isCameraReady\}/);
  assert.match(modal, /uploadSelectedImage\(dataUrl\)/);
});

test("mobile/tablet dock and branded scanner preserve RTL and desktop header", () => {
  const css = source("src/components/layout/industrial-mobile-nav.css");
  const scan = source("src/components/search/industrial-scan.css");
  const layout = source("src/components/layout/Layout.tsx");
  assert.match(css, /max-width: 1023px/);
  assert.match(css, /min-width:768px/);
  assert.match(css, /max-width:370px/);
  assert.match(css, /direction: rtl/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(scan, /precision-scan-technical-overlay\.svg/);
  assert.match(layout, /pb-28 lg:pb-0/);
});
