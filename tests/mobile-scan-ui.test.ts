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

test("camera flow captures only a real frame and holds it for explicit review", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  assert.match(modal, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(modal, /facingMode: facing/);
  assert.match(modal, /!isCameraReady \|\| !video \|\| !canvas \|\| !video\.videoWidth \|\| !video\.videoHeight/);
  assert.match(modal, /getTracks\(\)\.forEach/);
  assert.match(modal, /disabled=\{!isCameraReady\}/);
  const capture = modal.slice(modal.indexOf("const captureCameraFrame"), modal.indexOf("const retakeCameraPhoto"));
  assert.match(capture, /setCameraReviewImage\(dataUrl\)/);
  assert.match(capture, /setScreen\('review'\)/);
  assert.match(capture, /stopCameraStream\(\)/);
  assert.doesNotMatch(capture, /launchDirectVisualResults/);
});

test("mobile/tablet dock and branded KIKI scanner preserve RTL and desktop header", () => {
  const css = source("src/components/layout/industrial-mobile-nav.css");
  const scan = source("src/components/search/industrial-scan.css");
  const layout = source("src/components/layout/Layout.tsx");
  assert.match(css, /max-width: 1023px/);
  assert.match(css, /min-width:768px/);
  assert.match(css, /max-width:370px/);
  assert.match(css, /direction: rtl/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(scan, /\.fv-camera-stage/);
  assert.match(scan, /\.fv-scan-laser/);
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

test("FORZA floating actions expose support separately and open the swipe-to-enter contact sheet", () => {
  const floating = source("src/components/common/AiFloatingButton.tsx");
  const layout = source("src/components/layout/Layout.tsx");
  const styles = source("src/components/common/floating-quick-actions.css");
  const bottomBar = source("src/components/layout/MobileBottomBar.tsx");
  assert.match(floating, /className="store-help-launcher"/);
  assert.match(floating, /open-mobile-support/);
  assert.match(floating, /setSheetOpen\(true\)/);
  assert.match(floating, /dragOffsetRef\.current > 58/);
  assert.match(floating, /navigate\("\/ai-consult"\)/);
  assert.match(bottomBar, /addEventListener\("open-mobile-support", openSupport\)/);
  assert.match(layout, /<AiFloatingButton showAssistant=/);
  assert.match(styles, /\.storefront \.store-ai-quick-actions > \.store-help-launcher/);
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
  assert.match(provider, /<Studio[\s\S]*?initialCamera=\{startWithCamera\}[\s\S]*?fullScreen/);
  assert.match(modal, /screen === 'camera'/);
  assert.match(modal, /screen === 'review'/);
  assert.match(modal, /data-testid="full-screen-camera-experience"/);
  assert.match(modal, /data-testid="kiki-vision-review-shell"/);
  assert.match(modal, /onClick=\{confirmCameraPhoto\}/);
  assert.match(modal, /onClick=\{retakeCameraPhoto\}/);
  assert.match(modal, /تأیید و شناسایی قطعه/);
  assert.match(modal, /عکس‌برداری مجدد/);
  assert.match(modal, /setCameraReviewImage\(dataUrl\)/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("captured camera image is not uploaded until the customer confirms it", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const capture = modal.slice(modal.indexOf("const captureCameraFrame"), modal.indexOf("const retakeCameraPhoto"));
  const confirm = modal.slice(modal.indexOf("const confirmCameraPhoto"), modal.indexOf("const handleCloseAction"));
  assert.match(capture, /setCameraReviewImage\(dataUrl\)/);
  assert.match(capture, /setScreen\('review'\)/);
  assert.doesNotMatch(capture, /launchDirectVisualResults/);
  assert.match(confirm, /launchDirectVisualResults\(image, image/);
  assert.match(confirm, /originalName: 'camera-capture\.jpg'/);
  assert.doesNotMatch(confirm, /handleAnalyze/);
});

test("full-screen identification hides storefront dock and floating actions across capture, review and results", () => {
  const layout = source("src/components/layout/Layout.tsx");
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const modal = source("src/components/ui/Modal.tsx");
  assert.match(provider, /const IdentificationOverlayContext = createContext\(false\)/);
  assert.match(provider, /useIdentificationOverlayOpen/);
  assert.match(provider, /<IdentificationOverlayContext.Provider value=\{open\}>/);
  assert.match(layout, /const identificationOpen = useIdentificationOverlayOpen\(\)/);
  assert.match(layout, /!identificationOpen && isStorefrontBottomNavRoute\(location.pathname\)/);
  assert.match(layout, /\{showStorefrontDock && \(/);
  assert.match(modal, /fullScreen \? "z-\[100\]" : "z-50"/);
});

test("mobile commerce dock route whitelist excludes checkout, AI, forms and dashboards", () => {
  const routes = source("src/components/layout/storefrontBottomNavVisibility.ts");
  assert.match(routes, /SHOPPING_SECTION_PREFIXES/);
  assert.match(routes, /pathnameWithoutTrailingSlash.startsWith\(prefix \+ "\/"\)/);
  for (const route of ["/products", "/categories", "/category", "/product", "/cart", "/search"]) {
    assert.ok(routes.includes(`"${route}"`), `${route} must support the commerce dock`);
  }
  for (const excluded of ["/checkout", "/inquiry", "/club", "/admin", "/account", "/ai-forza", "/ai-consult", "/identify-part"]) {
    assert.ok(!routes.includes(`"${excluded}"`), `${excluded} must not have the commerce dock`);
  }
});

test("KIKI identification progress reports the real catalog-matching state accessibly", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const styles = source("src/components/search/industrial-scan.css");
  assert.match(modal, /data-testid="vision-analyzing-screen"/);
  assert.match(modal, /role="status"/);
  assert.match(modal, /aria-live="polite"/);
  assert.match(modal, /isMatching && \(/);
  assert.match(modal, /fv-indeterminate-bar/);
  assert.doesNotMatch(modal, /۸۶۴ قلمی|بازرگانی اطلس/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("identification hides mobile dock with React state, scoped class and CSS fallback", () => {
  const layout = source("src/components/layout/Layout.tsx");
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const css = source("src/components/layout/industrial-mobile-nav.css");
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  assert.match(layout, /showStorefrontDock \? "has-mobile-dock" : "no-mobile-dock"/);
  assert.match(provider, /document\.body\.classList\.add\(['"]sanat-identification-open['"]\)/);
  assert.match(provider, /document\.body\.classList\.remove\(['"]sanat-identification-open['"]\)/);
  assert.match(css, /body\.sanat-identification-open \.storefront \.store-bottom-nav/);
  assert.match(css, /\.storefront\.no-mobile-dock \.store-ai-quick-actions/);
  assert.match(modal, /className=\{shellPositionClass\}/);
  assert.match(modal, /'fv-workbench fixed inset-0 z-\[110\] overflow-y-auto'/);
});

test("KIKI scanner uses a real camera, gallery, torch, switch-camera and honest live optical HUD", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const css = source("src/components/search/industrial-scan.css");
  assert.match(modal, /cameraGalleryRef/);
  assert.match(modal, /const switchCamera/);
  assert.match(modal, /const toggleTorch/);
  assert.match(modal, /className="fv-camera-stage/);
  assert.match(modal, /className="fv-corner-brackets/);
  assert.match(modal, /className="fv-scan-laser/);
  assert.match(modal, /disabled=\{!isCameraReady\}/);
  assert.doesNotMatch(modal, /OPTICAL_BENCH_ART|confidence,\s*motionPercent/);
  assert.match(css, /\.fv-camera-stage\s*\{/);
  assert.match(css, /\.fv-corner-brackets\s*\{/);
  assert.match(css, /\.fv-scan-laser\s*\{/);
  assert.match(modal, /env\(safe-area-inset-bottom\)/);
});

test("standalone identification route uses KIKI entry UI with the existing full-screen route", () => {
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  assert.match(provider, /export function PartIdentificationPage/);
  assert.match(provider, /<Studio[\\s\\S]*?isOpen[\\s\\S]*?standalone[\\s\\S]*?fullScreen/);
  const workspace = source("src/pages/AiConsultPage.tsx");
  assert.match(workspace, /navigate\('\/identify-part\?from=workspace'\)/);
  assert.match(workspace, /entryParams\.get\('view'\) === 'visual'/);
  assert.match(workspace, /identificationOnly \|\| entryParams\.get\('view'\) === 'visual'/);
  assert.match(modal, /data-testid="forza-vision-entry"/);
  assert.match(modal, /data-testid="forza-vision-upload-panel"/);
  assert.match(modal, /onClick=\{\(\) => void startCamera\(\)\}/);
  assert.match(modal, /onClick=\{\(\) => fileInputRef\.current\?\.click\(\)\}/);
  assert.match(modal, /onDrop=\{\(e\) =>/);
});

test("visual identification preserves the existing production image input path", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const match = modal.slice(modal.indexOf("const runRegionVisualMatch"), modal.indexOf("const handleImagePointSelect"));
  assert.match(match, /getCustomerDeviceImage\(effectiveLocalImageId\)/);
  assert.match(match, /customerImageBlobToDataUrl\(localRecord\.blob\)/);
  assert.match(match, /aiVisualSearchService\.analyzePartWithAi/);
  assert.match(match, /region: opts\.region/);
  assert.match(match, /detectionId: opts\.detectionId/);
  assert.match(match, /imageBase64: payloadImage\.startsWith/);
  assert.match(modal, /const saved = await saveCustomerDeviceImage/);
});

test("workspace vision entry, image review and results use KIKI presentation while retaining production recognition", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const service = source("src/services/aiVisualSearchService.ts");
  const styles = source("src/components/search/industrial-scan.css");
  assert.match(modal, /data-testid="kiki-vision-review-shell"/);
  assert.match(modal, /data-testid="kiki-vision-results-shell"/);
  assert.match(modal, /data-testid="forza-vision-catalog-sheet-header"/);
  assert.match(modal, /data-testid="vision-kiki-no-match"/);
  assert.match(modal, /aiVisualSearchService\.analyzePartWithAi/);
  assert.match(provider, /useOnnxPartSegmentation/);
  assert.match(service, /\/api\/ai\/analyze-part/);
  assert.match(styles, /\.fv-workbench/);
});

