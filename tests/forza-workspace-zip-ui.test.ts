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

test('FORZA vision keeps the current scanner engine and adds the ZIP optical HUD', () => {
  const modal = read('src/components/search/AiVisualPartSearchModal.tsx');
  const selector = read('src/components/search/ImageRegionSelector.tsx');
  const styles = read('src/components/search/vision-camera-design.css');

  assert.match(modal, /vision-camera-design\.css/);
  assert.match(modal, /fv-camera-stage/);
  assert.match(modal, /fv-corner-brackets/);
  assert.match(modal, /fv-scan-laser/);
  assert.match(selector, /fv-lens-corner--tl/);
  assert.match(selector, /fv-lens-corner--br/);
  assert.match(styles, /\.fv-camera-stage/);
  assert.match(styles, /\.fv-lens-corner--br/);
  assert.doesNotMatch(styles.match(/\.fv-corner-brackets\s*\{[^}]*\}/)?.[0] || '', /position:\s*relative/);
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

test('approved optical tap feedback is cosmetic and retains the live region selector', () => {
  const selector = read('src/components/search/ImageRegionSelector.tsx');
  const styles = read('src/components/search/industrial-scan.css');
  const scanner = read('src/components/search/AiVisualPartSearchModal.tsx');
  assert.match(selector, /tapFeedback/);
  assert.match(selector, /fv-tap-ripple/);
  assert.match(selector, /fv-object-dot--active/);
  assert.match(selector, /findImageRegionAtPoint/);
  assert.match(selector, /tapImageRegion/);
  assert.match(styles, /fv-approved-tap-ripple/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(scanner, /ImageRegionSelector/);
  assert.match(scanner, /clientAiSegmentation/);
});

test('approved workspace keeps catalog search collapsible without dropping live callbacks', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  assert.match(page, /isCatalogSearchOpen/);
  assert.match(page, /forza-workspace-catalog-drawer/);
  assert.match(page, /setIsCatalogSearchOpen\(open => !open\)/);
  assert.match(page, /startCatalogFamilyConsultation\(family\)/);
  assert.match(page, /onAddToConsultation=\{startCatalogConsultation\}/);
  assert.match(page, /const startCatalogConsultation = \(product: ConsultationProduct\)/);
  assert.match(page, /setIsCatalogSearchOpen\(false\)/);
  assert.match(page, /consumeForzaTextStream/);
});


test('VISION history keeps only product metadata and registered public catalogue images', () => {
  const modal = read('src/components/search/AiVisualPartSearchModal.tsx');
  const entry = read('src/components/search/VisionEntryPage.tsx');
  const history = read('src/components/search/visionRecentHistory.ts');
  assert.match(modal, /recordVisionRecentSearch/);
  assert.match(modal, /loadVisionRecentSearches/);
  assert.match(entry, /forza-vision-recent-history/);
  assert.match(history, /sanatpish_forza_vision_recent_v2/);
  assert.match(history, /getCatalogDisplayImageCandidates/);
  assert.match(history, /removeItem\\(LEGACY_STORAGE_KEY\\)/);
  assert.doesNotMatch(history, /DEFAULT_RECENT_SEARCHES/);
});
