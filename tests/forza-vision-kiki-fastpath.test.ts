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
  const foreground = source('src/utils/foregroundRegion.ts');
  assert.ok(modal.includes('getForegroundRegions(segmented)'));
  assert.ok(modal.includes('setCandidateRegions(detectedRegions.length ? detectedRegions : [region])'));
  assert.ok(segmentation.includes('const modelScale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height)'));
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
  assert.ok(fast.includes('getForegroundRegion(segmented)'));
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


test('automatic viewer disables detected-region selection while busy and removes manual crop actions', () => {
  const picker = source('src/components/search/ImageRegionSelector.tsx');
  const review = source('src/components/search/ImageRegionReview.tsx');
  assert.ok(picker.includes('autoSelect?:boolean;'));
  assert.ok(picker.includes('onClick={selectCandidateAtPoint}'));
  assert.ok(picker.includes('if(autoSelect||disabled||event.button!==0||!event.isPrimary)return;'));
  assert.ok(picker.includes('if(autoSelect){'));
  assert.ok(picker.includes('disabled={disabled}'));
  assert.ok(review.includes('const selectorDisabled = preparing || Boolean(busy) || Boolean(analysisBusy);'));
  assert.ok(review.includes('disabled={selectorDisabled}'));
  assert.ok(review.includes('analysisBusy'));
  assert.ok(!review.includes('onFullImageSearch'));
  assert.ok(!review.includes('viewer-actions'));
});
