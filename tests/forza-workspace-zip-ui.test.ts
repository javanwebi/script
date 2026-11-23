import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('FORZA workspace uses the approved ZIP icon and modal components', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  const icons = read('src/components/forza/ForzaWorkspaceIcons.tsx');
  const modals = read('src/components/forza/ForzaWorkspaceModals.tsx');

  assert.match(page, /ForzaWorkspaceIcons/);
  assert.match(page, /ForzaWorkspaceModals/);
  assert.match(page, /<NewComposeIcon/);
  assert.match(page, /<LiveVoiceIcon/);
  assert.match(page, /<VisualScannerIcon/);
  for (const icon of ['BeltIcon', 'PulleyIcon', 'BearingIcon', 'ChainCouplingIcon', 'KilnRollerIcon', 'MechanicalSealIcon']) {
    assert.match(page, new RegExp('icon: ' + icon));
  }
  assert.match(page, /const CategoryIcon = category\.icon/);
  assert.match(page, /<DinCalculatorModal/);
  assert.match(page, /<WorkspaceSettingsModal/);
  assert.doesNotMatch(page, /Belt Calculator Modal \(DIN 2215\) with Touch-Friendly UI/);
  assert.match(icons, /export const BeltIcon/);
  assert.match(icons, /export const DinCalculatorIcon/);
  assert.match(modals, /aria-modal="true"/);
  assert.match(modals, /setConfirmClear\(true\)/);
});

test('FORZA vision restores the approved ZIP contour pipeline and local ONNX segmentation', () => {
  const modal = read('src/components/search/AiVisualPartSearchModal.tsx');
  const provider = read('src/components/search/PartIdentificationProvider.tsx');
  const contours = read('src/utils/smartPartContour.ts');
  const history = read('src/components/search/visionRecentHistory.ts');
  const segmentation = read('src/utils/clientAiSegmentation.ts');
  const styles = read('src/components/search/industrial-scan.css');

  assert.match(modal, /analyzeImageAutoContour/);
  assert.match(modal, /refineAutoContoursWithAiMask/);
  assert.match(modal, /segmentPartAtTapPoint/);
  assert.match(modal, /inferVisualDescriptor/);
  assert.match(modal, /useOnnxPartSegmentation/);
  assert.match(modal, /recordVisionRecentSearch/);
  assert.match(provider, /export function useOnnxPartSegmentation/);
  assert.match(provider, /preloadClientAiSegmentation/);
  assert.match(contours, /export async function analyzeImageAutoContour/);
  assert.match(contours, /export async function segmentPartAtTapPoint/);
  assert.match(history, /export function recordVisionRecentSearch/);
  assert.match(segmentation, /wasmPaths = '\/forza-runtime\/ort\//);
  assert.doesNotMatch(provider, /wasmPaths = '\/ort\//);
  assert.match(styles, /\.fv-camera-stage/);
  assert.match(styles, /\.fv-scan-laser/);
});

test('mobile FORZA launcher preserves the swipe-up contact sheet and direct desktop entry', () => {
  const launcher = read('src/components/common/AiFloatingButton.tsx');
  const styles = read('src/components/common/floating-quick-actions.css');

  assert.match(launcher, /data-testid="forza-mobile-contact-sheet"/);
  assert.match(launcher, /data-testid="forza-swipe-instruction"/);
  assert.match(launcher, /onTouchStart=\{onTouchStart\}/);
  assert.match(launcher, /onTouchMove=\{onTouchMove\}/);
  assert.match(launcher, /dragOffsetRef\.current > 58/);
  assert.match(launcher, /navigate\("\/ai-consult"\)/);
  assert.match(launcher, /matchMedia\("\(max-width: 1023px\)"\)/);
  assert.match(styles, /sp-forza-contact__sheet/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test('ZIP tap-to-isolate uses contour-aware sub-part selection and optical feedback', () => {
  const contours = read('src/utils/smartPartContour.ts');
  const styles = read('src/components/search/industrial-scan.css');
  const scanner = read('src/components/search/AiVisualPartSearchModal.tsx');
  assert.match(scanner, /segmentPartAtTapPoint/);
  assert.match(scanner, /isPointInsidePolygon/);
  assert.match(scanner, /fv-tap-ripple/);
  assert.match(scanner, /fv-object-dot/);
  assert.match(contours, /export async function segmentPartAtTapPoint/);
  assert.match(contours, /export function isPointInsidePolygon/);
  assert.match(styles, /\.fv-tap-ripple/);
  assert.match(styles, /\.fv-object-dot/);
  assert.match(styles, /prefers-reduced-motion/);
});

test('approved ZIP workspace keeps the catalog drawer and live consultation callbacks', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  assert.match(page, /isCatalogSearchOpen/);
  assert.match(page, /Collapsible Catalog Search Drawer/);
  assert.match(page, /openCatalogFinder/);
  assert.match(page, /setIsCatalogSearchOpen\(true\)/);
  assert.match(page, /startCatalogFamilyConsultation\(family\)/);
  assert.match(page, /onAddToConsultation=\{product =>/);
  assert.match(page, /const startCatalogConsultation = \(product: ConsultationProduct\)/);
  assert.match(page, /setIsCatalogSearchOpen\(false\)/);
  assert.match(page, /consumeForzaTextStream/);
});
