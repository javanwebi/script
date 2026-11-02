
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
  assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\) 72px/);
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

test("RTL pill items follow home, categories, cart, account, camera; active colors follow orange brand", () => {
  const nav = source("src/components/layout/MobileBottomBar.tsx");
  const css = source("src/components/layout/industrial-mobile-nav.css");
  const markup = nav.split('<nav className="store-bottom-nav store-industrial-bottom-nav"')[1].split("</nav>")[0];
  const expected = ["<span>خانه</span>", "<span>دسته‌ها</span>", "<span>سبد خرید</span>", "<span>حساب من</span>", "store-scan-action"];
  let previous = -1;
  for (const term of expected) {
    const position = markup.indexOf(term);
    assert.ok(position > previous, `Invalid RTL dock order: ${term}`);
    previous = position;
  }
  assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\) 72px/);
  assert.match(css, /inset-inline-start: 0;\s*inset-inline-end: 69px/);
  assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\) 80px/);
  assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\) 62px/);
  assert.match(css, /background: linear-gradient\(135deg,#E06518,#C95210\)/);
  assert.match(css, /background: linear-gradient\(145deg,#F28A43,#E06518\)/);
  assert.doesNotMatch(css, /#182465|#3544aa|#25368c|#15215f|#3b4bb0/i);
});

test("dock camera opens a full-screen live preview, local review, retake, and explicit confirm", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const styles = source("src/components/search/industrial-scan.css");
  assert.match(provider, /fullScreen=\{startWithCamera\}/);
  assert.match(modal, /cameraFlowActive/);
  assert.match(modal, /data-testid="full-screen-camera-experience"/);
  assert.match(modal, /sanat-camera-experience__video/);
  assert.match(modal, /sanat-camera-experience__preview/);
  assert.match(modal, /onClick=\{confirmCameraPhoto\}/);
  assert.match(modal, /onClick=\{retakeCameraPhoto\}/);
  assert.match(modal, /تأیید و جستجوی قطعه/);
  assert.match(modal, /عکس‌برداری مجدد/);
  assert.match(modal, /setCameraReview\(true\)/);
  assert.match(modal, /handleAnalyze\("quick"\)/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("captured camera image is not uploaded until the customer confirms it", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const capture = modal.slice(modal.indexOf("const capturePhoto"), modal.indexOf("// Use the existing secure camera"));
  const reviewBranch = capture.indexOf("if (cameraFlowActive)");
  const stopAndReturn = capture.indexOf("return;", reviewBranch);
  const upload = capture.indexOf("uploadSelectedImage(dataUrl)");
  assert.ok(reviewBranch >= 0, "camera launch must enter the review flow");
  assert.ok(stopAndReturn > reviewBranch, "camera must stop and hold the frame for review");
  assert.ok(upload > stopAndReturn, "legacy inline camera upload must remain after the review-only return");
});
