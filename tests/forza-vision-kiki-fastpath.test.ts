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

test('active local catalogue encoder owns region proposals; browser segmentation is fallback only', () => {
  const modal = source('src/components/search/AiVisualPartSearchModal.tsx');
  const fast = modal.slice(
    modal.indexOf('const detectUploadedImageRegions'),
    modal.indexOf('const uploadAndPrepareImage'),
  );
  assert.ok(modal.includes('localVisionServerEnabledRef'));
  assert.ok(modal.includes('localVisionStatusPromiseRef'));
  assert.ok(modal.includes('if(!enabled)void preloadClientAiSegmentation()'));
  assert.ok(fast.includes('const serverPreferred='));
  assert.ok(fast.includes('await statusPromise'));
  assert.ok(fast.includes('if(sequence!==regionDetectionSequenceRef.current || !isOpen)return;'));
  assert.ok(fast.includes('if(serverPreferred){'));
  assert.ok(fast.includes('const localDetection = segmentImageWithClientAi(imageUrl)'));
  assert.ok(fast.includes('aiVisualSearchService.detectImageRegions(imageUrl)'));
  assert.ok(fast.includes('sequence!==regionDetectionSequenceRef.current'));
  assert.ok(fast.includes('commitServerDetection(detection)'));
  assert.ok(fast.indexOf('if(serverPreferred){') < fast.indexOf('const localDetection'));
  assert.ok(modal.includes('saveCustomerDeviceImage(blob'));
  assert.ok(modal.includes('customerImageBlobToDataUrl(blob)'));
  assert.ok(modal.includes('Promise.all(['));
  assert.ok(modal.includes('temporaryImageDataUrl || await customerImageBlobToDataUrl(localRecord.blob)'));
  assert.ok(modal.includes('React.useMemo<VisionWorkspaceResult[]>'));
  const server=source('server.ts');
  const status=server.slice(server.indexOf("app.get('/api/ai/local-vision-status'"),server.indexOf('const localVisionDetectionCache'));
  assert.ok(status.includes('app.get(\'/api/ai/local-vision-status\', (_req,res)=>'));
  assert.ok(status.includes('void catalogVisualIndex.load().catch(()=>undefined)'));
  assert.ok(!status.includes('await catalogVisualIndex.load'));
  assert.ok(!status.includes('buildCatalogImageCorpus'));
  assert.ok(server.includes('canReuseLocalVisionQuery(cachedDetection,body.region,body.fullImage===true)'));
  assert.ok(server.includes('body.fullImage===true ? [] : body.region ? [body.region]'));
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
  assert.ok(review.includes("import { Link } from 'react-router-dom'"));
  assert.ok(review.includes('to={productHref}'));
  assert.ok(review.includes('onSelectProduct(item.id)'));
  assert.ok(review.includes("aria-label={'مشاهده صفحه محصول ' + item.name}"));
  assert.ok(!review.includes('onOpenProduct'));
  assert.ok(!modal.includes('onOpenProduct='));
  assert.ok(styles.includes('.kiki-image-workspace__family-image-note'));
  assert.ok(styles.includes('max-height: min(calc(58dvh - 145px), 480px)'));
  assert.ok(styles.includes('max-height: min(calc(54dvh - 145px), 480px)'));
  assert.ok(styles.includes('border: 1px solid rgba(224,101,30,.58)'));
  assert.ok(styles.includes('background: transparent'));
  assert.ok(styles.includes('display: none !important'));
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
