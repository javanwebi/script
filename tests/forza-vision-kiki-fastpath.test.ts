import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL('../' + relative, import.meta.url)), 'utf8');

test('KIKI entry, camera, crop review and results share one real identification flow', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  assert.ok(modal.includes('<VisionEntryPage'));
  assert.ok(modal.includes('full-screen-camera-experience'));
  assert.ok(modal.includes('<ImageRegionReview'));
  assert.ok(modal.includes('kiki-vision-results-shell'));
  assert.ok(modal.includes('forza-vision-catalog-sheet-header'));
  assert.ok(modal.includes('forza-vision-catalog-results'));
  assert.ok(modal.includes('src={selectedImage}'));
  assert.ok(modal.includes('onConfirm={confirmRegionAndAnalyze}'));
  assert.ok(modal.includes('aiVisualSearchService.analyzePartWithAi'));
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

test('mobile KIKI result sheet supports pull-up and image-return without dropping crop actions', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const css = source('src/components/search/vision-camera-design.css');
  assert.ok(modal.includes('resultsSwipeStartY'));
  assert.ok(modal.includes('data-sheet-expanded={mobileResultsExpanded}'));
  assert.ok(modal.includes('aria-expanded={mobileResultsExpanded}'));
  assert.ok(modal.includes('setMobileResultsExpanded(true)'));
  assert.ok(modal.includes('setMobileResultsExpanded(false)'));
  assert.ok(modal.includes('onFullImageSearch'));
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

test('real multi-part lens exposes KIKI quick-select buttons without auto-running analysis', () => {
  const picker = source('src/components/search/ImageRegionSelector.tsx');
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const optical = source('src/components/search/vision-camera-design.css');
  const review = source('src/components/search/image-region-review.css');
  const styles = source('src/components/search/industrial-scan.css');
  assert.ok(picker.includes('data-testid="vision-region-candidates"'));
  assert.ok(picker.includes('candidates.length > 1'));
  assert.ok(picker.includes('onClick={() => { setDraft(undefined); onChange(region); }}'));
  assert.ok(picker.includes('aria-pressed={sameRegion(selected, region)}'));
  assert.ok(modal.includes('data-testid="forza-vision-optical-toolbar"'));
  assert.ok(modal.includes('setMobileResultsExpanded(false); resetForm();'));
  assert.ok(modal.includes('resetForm(); setCameraFlowActive(true); void startCamera();'));
  assert.ok(optical.includes('.fv-kiki-optical-toolbar'));
  assert.ok(review.includes('.kiki-region-review'));
  assert.ok(review.includes('.sanat-region-picker__canvas'));
  assert.ok(review.includes('.sanat-region-picker__search'));
  assert.ok(review.includes('.sanat-region-picker__full-image'));
  assert.ok(styles.includes('.fv-region-candidates__item.is-active'));
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
