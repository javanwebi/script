import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL('../' + relative, import.meta.url)), 'utf8');

test('KIKI entry, camera, automatic region detection and inline results share one real identification flow', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  assert.ok(modal.includes('<VisionEntryPage'));
  assert.ok(modal.includes('full-screen-camera-experience'));
  assert.ok(modal.includes('<ImageRegionReview'));
  assert.ok(modal.includes('kiki-vision-results-shell'));
  assert.ok(modal.includes('forza-vision-catalog-sheet-header'));
  assert.ok(modal.includes('forza-vision-catalog-results'));
  assert.ok(modal.includes('src={selectedImage}'));
  assert.ok(modal.includes("void handleAnalyze('quick',region,localImageId,true)"));
  assert.ok(modal.includes('analysisComplete={Boolean(analysisResult)}'));
  assert.ok(modal.includes('aiVisualSearchService.analyzePartWithAi'));
});

test('local segmenter preserves aspect ratio and exposes ranked object candidates', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const segmentation = source('src/utils/clientAiSegmentation.ts');
  const segmentationWorker = source('src/utils/clientAiSegmentation.worker.ts');
  const foreground = source('src/utils/foregroundRegion.ts');
  assert.ok(segmentation.includes("new URL('./clientAiSegmentation.worker.ts', import.meta.url)"));
  assert.ok(segmentationWorker.includes('ort.env.wasm.proxy = false'));
  assert.ok(segmentationWorker.includes('session.run'));
  assert.ok(segmentationWorker.includes('getForegroundRegions'));
  assert.ok(segmentation.includes('const MAX_IMAGE_DIMENSION = 720'));
  assert.ok(modal.includes('const detectedRegions = segmented.regions'));
  assert.ok(modal.includes('setCandidateRegions(detectedRegions.length ? detectedRegions : [region])'));
  assert.ok(segmentation.includes('const modelScale = Math.min(MODEL_INPUT_SIZE / width, MODEL_INPUT_SIZE / height)'));
  assert.ok(segmentation.includes('modelLeft'));
  assert.ok(segmentation.includes('modelTop'));
  assert.ok(segmentation.includes('modelRect'));
  assert.ok(foreground.includes('componentsAtThreshold'));
  assert.ok(foreground.includes('new Int32Array(total)'));
  assert.ok(foreground.includes('Eight-way connectivity'));
});

test('local segmenter is warmed and can win without serial server crop detection', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const fast = modal.slice(
    modal.indexOf('const detectUploadedImageRegions'),
    modal.indexOf('const uploadAndPrepareImage'),
  );
  assert.ok(modal.includes('preloadClientAiSegmentation()'));
  assert.ok(fast.includes('const localDetection = segmentImageWithClientAi(imageUrl)'));
  assert.ok(fast.includes('Promise.race'));
  assert.ok(fast.includes('aiVisualSearchService.detectImageRegions(imageUrl)'));
  assert.ok(fast.includes('sequence !== regionDetectionSequenceRef.current'));
  assert.ok(fast.includes('const region = detectedRegions[0]'));
  assert.ok(fast.indexOf('const localDetection') < fast.indexOf('aiVisualSearchService.detectImageRegions'));
  assert.ok(modal.includes('saveCustomerDeviceImage(blob'));
  assert.ok(modal.includes('customerImageBlobToDataUrl(blob)'));
  assert.ok(modal.includes('Promise.all(['));
  assert.ok(modal.includes('temporaryImageDataUrl || await customerImageBlobToDataUrl(localRecord.blob)'));
});

test('mobile KIKI result sheet supports pull-up while region changes return to automatic inline analysis', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const css = source('src/components/search/vision-camera-design.css');
  assert.ok(modal.includes('resultsSwipeStartY'));
  assert.ok(modal.includes('data-sheet-expanded={mobileResultsExpanded}'));
  assert.ok(modal.includes('aria-expanded={mobileResultsExpanded}'));
  assert.ok(modal.includes('setMobileResultsExpanded(true)'));
  assert.ok(modal.includes('setMobileResultsExpanded(false)'));
  assert.ok(!modal.includes('onFullImageSearch'));
  assert.ok(modal.includes('autoSelect'));
  assert.ok(modal.includes('onChange={handleRegionSelection}'));
  assert.ok(modal.includes('setCurrentStep(1)'));
  assert.ok(modal.includes('onRegionChange={handleRegionSelection}'));
  assert.ok(css.includes('KIKI mobile results: swipe up to expand'));
  assert.ok(css.includes('data-sheet-expanded="true"'));
  assert.ok(css.includes('prefers-reduced-motion'));
});

test('new presentation remains isolated from FORZA voice and catalog data', () => {
  const styles = source('src/components/search/vision-camera-design.css');
  const reviewStyles = source('src/components/search/image-region-review.css');
  const service = source('src/services/aiVisualSearchService.ts');
  assert.ok(reviewStyles.includes('.kiki-vision-review-shell'));
  assert.ok(styles.includes('.fv-catalog-sheet__header'));
  assert.ok(service.includes('/api/ai/analyze-part'));
  assert.ok(service.includes('/api/ai/detect-regions'));
  assert.ok(service.includes('const interval = polls++ === 0 ? 450 : polls === 2 ? 850 : 1200;'));
  assert.ok(!styles.includes('body * {'));
});

test('VISION entry uses original KIKI portal layout while retaining real image handlers', () => {
  const entry = source('src/components/search/VisionEntryPage.tsx');
  assert.ok(entry.includes('data-testid="forza-vision-entry"'));
  assert.ok(entry.includes('data-testid="forza-vision-upload-panel"'));
  assert.ok(entry.includes('تشخیص خودکار کانتور و کد فنی'));
  assert.ok(entry.includes('قطعه را با یک عکس بشناسید و نمونه مشابه را پیدا کنید'));
  assert.ok(entry.includes('Photographic Optical Showcase'));
  assert.ok(entry.includes('/images/company/ai-search-mobile.webp'));
  assert.ok(entry.includes('onClick={onCamera}'));
  assert.ok(entry.includes('onClick={onUpload}'));
  assert.ok(entry.includes('onDropFile?.(f)'));
  assert.ok(entry.includes('disabled={isUploading}'));
  assert.ok(entry.includes('onRecentClick?.(item)'));
  assert.ok(!entry.includes('handleFile(f)'));
  assert.ok(!entry.includes('/src/assets/'));
});

test('multi-part lens auto-selects a detected object and starts catalog search without manual crop confirmation', () => {
  const picker = source('src/components/search/ImageRegionSelector.tsx');
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const review = source('src/components/search/ImageRegionReview.tsx');
  const styles = source('src/components/search/image-region-review.css');
  assert.ok(picker.includes('autoSelect?:boolean;'));
  assert.ok(picker.includes('onClick={selectCandidateAtPoint}'));
  assert.ok(picker.includes('findImageRegionAtPoint(p,candidates)'));
  assert.ok(picker.includes("variant?:'default'|'viewer';"));
  assert.ok(picker.includes('sanat-region-picker--viewer'));
  assert.ok(modal.includes('autoAnalysisKeyRef.current===key'));
  assert.ok(modal.includes("void handleAnalyze('quick',region,localImageId,true)"));
  assert.ok(modal.includes('setCandidateRegions(detectedRegions.length?detectedRegions:(primaryRegion?[primaryRegion]:[]))'));
  assert.ok(modal.includes('setSelectedProductId(undefined)'));
  assert.ok(review.includes('data-testid="kiki-inline-catalog-results"'));
  assert.ok(review.includes('onSelectProduct'));
  assert.ok(review.includes('onOpenProduct'));
  assert.ok(review.includes('onOpenProduct(item.id)'));
  assert.ok(review.includes('مشاهده صفحه محصول و مشخصات'));
  assert.ok(modal.includes('const productCode=item?.code || item?.familyCode'));
  assert.ok(modal.includes("navigate('/product/'+encodeURIComponent(productCode))"));
  assert.ok(styles.includes('.kiki-image-workspace__family-image-note'));
  assert.ok(styles.includes('max-height: min(calc(58dvh - 210px), 420px)'));
  assert.ok(styles.includes('max-height: min(calc(54dvh - 210px), 440px)'));
  assert.ok(styles.includes('background: transparent'));
  assert.ok(styles.includes('.kiki-image-workspace__result-card.is-selected'));
  assert.ok(styles.includes('.sanat-region-picker--viewer .sanat-region-picker__handles'));
  assert.ok(styles.includes('display: none !important'));
});

test('no-match catalogue view uses real custom-request actions and truthful privacy language', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const style = source('src/components/search/vision-camera-design.css');
  assert.ok(modal.includes('data-testid="vision-kiki-no-match"'));
  assert.ok(modal.includes('onClick={() => void openCustomManufacturingRequest()}'));
  assert.ok(modal.includes('href="tel:03535254703"'));
  assert.ok(modal.includes('https://wa.me/989903427027'));
  assert.ok(modal.includes('محتوای لازم برای تحلیل به API شناسایی ارسال می‌شود'));
  assert.ok(!modal.includes('tel:02166700000'));
  assert.ok(!modal.includes('wa.me/989120000000'));
  assert.ok(style.includes('.fv-kiki-empty-state__rail'));
});

test('KIKI results header stays within the independently scrollable catalogue pane', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const style = source('src/components/search/vision-camera-design.css');
  const layout = modal.indexOf('className="fv-catalog-sheet__layout"');
  const panel = modal.indexOf('className="fv-catalog-sheet__results"', layout);
  const header = modal.indexOf('className="fv-catalog-sheet__header"', layout);
  assert.ok(layout > 0 && panel > layout && header > panel);
  assert.ok(style.includes('.fv-catalog-sheet__results > .fv-catalog-sheet__header'));
  assert.ok(style.includes('.sp-vision-result-panel[data-sheet-expanded="true"]'));
});


test('automatic viewer keeps manual drag-to-crop available when automatic segmentation misses a part', () => {
  const picker = source('src/components/search/ImageRegionSelector.tsx');
  const review = source('src/components/search/ImageRegionReview.tsx');
  const styles = source('src/components/search/image-region-review.css');
  assert.ok(picker.includes('autoSelect?:boolean;'));
  assert.ok(picker.includes('onClick={selectCandidateAtPoint}'));
  assert.ok(picker.includes("mode:autoSelect?'draw':inside?'move':'draw'"));
  assert.ok(picker.includes('suppressNextClickRef'));
  assert.ok(picker.includes('data-manual-crop-enabled={!disabled}'));
  assert.doesNotMatch(picker, /if\(autoSelect\|\|disabled\|\|event\.button/);
  assert.ok(review.includes('kiki-mobile-results-sheet-handle'));
  assert.ok(review.includes('onPointerMove={handleSheetPointerMove}'));
  assert.ok(review.includes('kiki-manual-crop-hint'));
  assert.ok(styles.includes('touch-action: none !important'));
  assert.ok(styles.includes('.sanat-region-picker--viewer .sanat-region-picker__draft'));
  assert.ok(styles.includes('.sanat-region-picker--viewer.is-manual-crop .sanat-region-picker__handles'));
});

test('mobile catalogue results float over the submitted photo in a draggable half-screen sheet', () => {
  const review = source('src/components/search/ImageRegionReview.tsx');
  const styles = source('src/components/search/image-region-review.css');
  assert.ok(review.includes('data-sheet-expanded={sheetExpanded}'));
  assert.ok(review.includes('data-sheet-dragging={sheetDragging}'));
  assert.ok(review.includes('aria-expanded={sheetExpanded}'));
  assert.ok(review.includes('setPointerCapture(event.pointerId)'));
  assert.ok(styles.includes('height: 56dvh'));
  assert.ok(styles.includes('overflow-y: auto'));
  assert.ok(styles.includes('translate3d(0, calc(var(--kiki-sheet-base-offset)'));
  assert.ok(styles.includes('data-sheet-expanded="true"'));
});

test('manual selection is encoded as a real cropped image when server region detection is unavailable', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const region = source('src/utils/imageRegion.ts');
  assert.ok(modal.includes('cropImageDataUrlToRegion(imageBase64, selectedRegionForRequest)'));
  assert.ok(modal.includes('clientCropFallback'));
  assert.ok(modal.includes('Boolean(selectedRegionForRequest) && !regionDetectionId'));
  assert.ok(modal.includes('const requestRegion = regionDetectionId ? selectedRegionForRequest : undefined'));
  assert.ok(modal.includes('detectionId: requestRegion ? regionDetectionId || undefined : undefined'));
  assert.ok(modal.includes('if (clientCropFallback && selectedRegionForRequest)'));
  assert.ok(modal.includes('setQueryRegion(selectedRegionForRequest)'));
  assert.ok(modal.includes('Its returned proposal') === false);
  assert.ok(modal.includes('not the original customer photo'));
  assert.ok(modal.includes("analysisMimeType = 'image/jpeg'"));
  assert.ok(region.includes('imageRegionToPixelBounds'));
  assert.ok(region.includes('Math.floor(region.x * width)'));
  assert.ok(region.includes('Math.ceil((region.x + region.width) * width)'));
});


test('nearest catalogue results are requested and displayed as unconfirmed exploration, not exact identification', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const review = source('src/components/search/ImageRegionReview.tsx');
  const styles = source('src/components/search/image-region-review.css');
  assert.ok(modal.includes('includeNearest: true'));
  assert.ok(modal.includes('analysisResult?.nearestCatalogSuggestions'));
  assert.ok(modal.includes("matchBasis:'explore' as const"));
  assert.ok(modal.includes('گزینه نزدیک برای بررسی؛ تطبیق قطعی نیست'));
  assert.ok(review.includes("item.matchBasis === 'explore'"));
  assert.ok(review.includes('data-match-basis={item.matchBasis ||'));
  assert.ok(styles.includes('[data-match-basis="explore"]'));
});
