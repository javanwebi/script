
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

test("mobile capsule has four destinations, a detached camera, and no support dock tab", () => {
  const nav = source("src/components/layout/MobileBottomBar.tsx");
  const css = source("src/components/layout/industrial-mobile-nav.css");
  const markup = nav.split('<nav className="store-bottom-nav store-industrial-bottom-nav"')[1].split("</nav>")[0];
  assert.doesNotMatch(markup, /راهنما|راهنمای خرید|Headphones/);
  assert.match(markup, /store-scan-action/);
  assert.match(markup, /<span>خانه<\/span>/);
  assert.match(markup, /<span>دسته‌ها<\/span>/);
  assert.match(markup, /<span>سبد خرید<\/span>/);
  assert.match(markup, /<span>حساب من<\/span>/);
  assert.match(css, /grid-template-columns: 72px repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /store-industrial-bottom-nav::before/);
  assert.match(css, /border-radius: 50%/);
});

test("support icon above the FORZA button reuses the original help sheet", () => {
  const floating = source("src/components/common/AiFloatingButton.tsx");
  const nav = source("src/components/layout/MobileBottomBar.tsx");
  const layout = source("src/components/layout/Layout.tsx");
  const styles = source("src/components/common/floating-quick-actions.css");
  assert.match(floating, /open-mobile-support/);
  assert.match(floating, /className="store-help-launcher"/);
  assert.match(nav, /addEventListener\("open-mobile-support"/);
  assert.match(nav, /setSheet\("support"\)/);
  assert.match(nav, /راهنمای خرید و پشتیبانی/);
  assert.match(layout, /<AiFloatingButton showAssistant=/);
  assert.match(styles, /flex-direction: column/);
  assert.match(styles, /inset-block-end: calc\(106px/);
});
