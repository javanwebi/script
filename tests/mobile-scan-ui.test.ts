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
  assert.match(modal, /facingMode: facing/);
  assert.match(modal, /!isCameraReady \|\| !video\.videoWidth/);
  assert.match(modal, /getTracks\(\)\.forEach/);
  assert.match(modal, /disabled=\{!isCameraReady\}/);
  // Legacy camera launches may prepare immediately; dock launches hold the
  // frame for explicit customer confirmation before upload or analysis.
  assert.match(modal, /uploadAndPrepareImage\(dataUrl,\s*["']camera-capture\.jpg["']\)/);
  const capture = modal.slice(modal.indexOf("const capturePhoto"), modal.indexOf("// Use the existing secure camera"));
  assert.match(capture, /if \(cameraFlowActive\)/);
  assert.match(capture, /setCameraReview\(true\)/);
  assert.doesNotMatch(capture, /handleAnalyze/);
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
  assert.match(provider, /<Studio isOpen standalone initialCamera=\{startWithCamera\} fullScreen/);
  assert.match(modal, /cameraFlowActive/);
  assert.match(modal, /data-testid="full-screen-camera-experience"/);
  assert.match(modal, /sanat-camera-experience__video/);
  assert.match(modal, /sanat-camera-experience__preview/);
  assert.match(modal, /onClick=\{confirmCameraPhoto\}/);
  assert.match(modal, /onClick=\{retakeCameraPhoto\}/);
  assert.match(modal, /تأیید و جستجوی قطعه/);
  assert.match(modal, /عکس‌برداری مجدد/);
  assert.match(modal, /setCameraReview\(true\)/);
  assert.match(modal, /onConfirm=\{confirmRegionAndAnalyze\}/);
  assert.match(modal, /onFullImageSearch=\{confirmFullImageAndAnalyze\}/);
  assert.match(modal, /void uploadAndPrepareImage\(selectedImage\)/);
  assert.match(styles, /height: 100dvh/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("captured camera image is not uploaded until the customer confirms it", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const capture = modal.slice(modal.indexOf("const capturePhoto"), modal.indexOf("// Use the existing secure camera"));
  const confirm = modal.slice(modal.indexOf("const confirmCameraPhoto"), modal.indexOf("// Calculate inquiry price for user"));
  const reviewBranch = capture.indexOf("if (cameraFlowActive)");
  const stopAndReturn = capture.indexOf("return;", reviewBranch);
  const upload = capture.indexOf("uploadAndPrepareImage(dataUrl)");
  assert.ok(reviewBranch >= 0, "camera launch must enter the review flow");
  assert.ok(stopAndReturn > reviewBranch, "camera must stop and hold the frame for review");
  assert.equal(upload, -1, "camera capture must not send the image before customer confirmation");
  assert.match(confirm, /uploadAndPrepareImage\(selectedImage/);
  assert.doesNotMatch(confirm, /handleAnalyze/, "camera confirmation must not bypass crop approval");
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

test("image identification progress uses a dedicated responsive UI with real progress and no obsolete 864 atlas claim", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const view = source("src/components/search/VisionAnalysisProgress.tsx");
  const css = source("src/components/search/vision-analysis-progress.css");
  assert.match(modal, /<VisionAnalysisProgress/);
  assert.match(modal, /currentStep === "analyzing"/);
  assert.match(modal, /data-testid="vision-analyzing-screen"/);
  assert.doesNotMatch(modal, /۸۶۴ قلمی|بازرگانی اطلس/);
  assert.match(view, /در انتظار گزارش سرور/);
  assert.match(view, /aria-valuenow=\{value === null \? undefined : value\}/);
  assert.match(view, /فقط نتایج قابل بررسی از کاتالوگ/);
  assert.match(css, /min-width: 800px/);
  assert.match(css, /max-width: 480px/);
  assert.match(css, /prefers-reduced-motion/);
});

test("identification hides mobile dock with React state, scoped class and CSS fallback", () => {
  const layout = source("src/components/layout/Layout.tsx");
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const css = source("src/components/layout/industrial-mobile-nav.css");
  assert.match(layout, /showStorefrontDock \? "has-mobile-dock" : "no-mobile-dock"/);
  assert.match(provider, /document\.body\.classList\.add\("sanat-identification-open"\)/);
  assert.match(provider, /document\.body\.classList\.remove\("sanat-identification-open"\)/);
  assert.match(css, /body\.sanat-identification-open \.storefront \.store-bottom-nav/);
  assert.match(css, /\.storefront\.no-mobile-dock \.store-ai-quick-actions/);
  assert.match(source("src/components/search/AiVisualPartSearchModal.tsx"), /fullScreen=\{standalone \|\| fullScreen \|\| initialCamera \|\| cameraFlowActive \|\| currentStep === "analyzing" \|\| currentStep === 1 \|\| currentStep === "results"\}/);
});

test("reference-design scanner has actual gallery, reversible lens and flash controls, a round shutter and scan-line", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const css = source("src/components/search/industrial-scan.css");
  assert.match(modal, /sanat-camera-reference/);
  assert.match(modal, /cameraGalleryRef/);
  assert.match(modal, /switchCamera/);
  assert.match(modal, /toggleTorch/);
  assert.match(modal, /sanat-camera-experience__instruction/);
  assert.match(css, /sanat-camera-experience__scan-line/);
  assert.match(modal, /fv-camera-stage/);
  assert.match(modal, /fv-corner-brackets/);
  assert.match(modal, /fv-scan-laser/);
  assert.match(css, /\.fv-workbench\s*\{/);
  assert.match(css, /\.fv-camera-stage\s*\{/);
  assert.match(css, /\.fv-corner-brackets\s*\{/);
  assert.match(css, /\.fv-scan-laser\s*\{/);
});


test("standalone identification route uses the new entry design and existing camera/upload pipeline", () => {
  const provider = source("src/components/search/PartIdentificationProvider.tsx");
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const entry = source("src/components/search/VisionEntryPage.tsx");
  assert.match(provider, /<Studio isOpen standalone fullScreen/);
  assert.match(modal, /currentStep === 1 && !selectedImage/);
  assert.match(modal, /setCameraFlowActive\(true\); void startCamera\(\)/);
  assert.match(modal, /onUpload=\{\(\) => fileInputRef\.current\?\.click\(\)\}/);
  assert.match(entry, /data-testid="forza-vision-entry"/);
  assert.match(entry, /data-testid="forza-vision-upload-panel"/);
  assert.match(entry, /تشخیص خودکار کانتور و کد فنی/);
  assert.match(entry, /onDropFile\?: \(file: File\) => void/);
  assert.match(entry, /onCamera/);
  assert.match(entry, /onUpload/);
  assert.match(entry, /قطعه را با یک عکس بشناسید و نمونه مشابه را پیدا کنید/);
  assert.doesNotMatch(entry, /02166700000|989120000000|DEFAULT_RECENT_SEARCHES/);
});


test("visual identification preserves the existing production image input path", () => {
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  assert.match(modal, /imageBase64 = localSegmentation\.result\.whiteBgDataUrl/);
  assert.doesNotMatch(modal, /renderSegmentedVisionCutout|extractAlphaMaskContours|selectAlphaMaskContour/);
});


test("workspace vision entry, split image review and results use KIKI without replacing the recognition pipeline", () => {
  const review = source("src/components/search/ImageRegionReview.tsx");
  const reviewStyles = source("src/components/search/image-region-review.css");
  const picker = source("src/components/search/ImageRegionSelector.tsx");
  const modal = source("src/components/search/AiVisualPartSearchModal.tsx");
  const entry = source("src/components/search/VisionEntryPage.tsx");
  const styles = source("src/components/search/vision-camera-design.css");

  assert.match(modal, /<ImageRegionReview/);
  assert.match(modal, /data-testid="kiki-vision-results-shell"/);
  assert.doesNotMatch(modal, /sanat-visual-search-hero|sanat-visual-stepper|kiki-vision-review-shell__status/);
  assert.match(review, /data-testid="image-region-review"/);
  assert.match(review, /kiki-image-workspace/);
  assert.match(review, /محصولات مشابه کاتالوگ/);
  assert.match(review, /ثبت سفارش ساخت/);
  assert.match(review, /onCamera/);
  assert.match(review, /onSearch=\{onConfirm\}/);
  assert.match(review, /onFullImageSearch=\{onFullImageSearch\}/);
  assert.doesNotMatch(review, /تأیید تصویر و شروع تحلیل|تأیید برش و شروع تحلیل|sp-region-review__scanner-steps|دریافت تصویر|یافتن قطعه/);
  assert.match(reviewStyles, /\.kiki-vision-review-shell\.kiki-image-workspace/);
  assert.match(reviewStyles, /\.sanat-region-picker--viewer \.sanat-region-picker__canvas/);
  assert.doesNotMatch(reviewStyles, /background:\s*#172231|background:\s*#111b27/);
  assert.match(picker, /sanat-region-picker--viewer/);
  assert.match(picker, /sanat-region-picker__handle/);
  assert.match(picker, /mode:'resize'/);

  assert.match(modal, /بازگشت به میزکار از نتایج شناسایی/);
  assert.doesNotMatch(modal, /sp-vision-journey/);
  assert.match(entry, /شروع اسکن با دوربین/);
  assert.match(entry, /انتخاب تصویر از دستگاه/);
  assert.match(modal, /onConfirm=\{confirmRegionAndAnalyze\}/);
  assert.match(modal, /data-testid="kiki-vision-image-evidence"/);
  assert.match(modal, /ImageRegionSelector/);
  assert.match(modal, /clientAiSegmentation/);
  assert.match(entry, /قطعه را با یک عکس بشناسید/);
  assert.match(entry, /تشخیص خودکار کانتور و کد فنی/);
  assert.match(styles, /sp-vision-result-panel:has\(> \.sanat-region-picker\)/);
});
