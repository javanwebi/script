import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { loadVisionRecentSearches, recordVisionRecentSearch } from '../src/components/search/visionRecentHistory';

const read = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

const LEGACY_KEY = 'sanatpish_forza_vision_recent_v1';
const STORAGE_KEY = 'sanatpish_forza_vision_recent_v2';
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function installStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  } as Storage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return { storage, values };
}

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

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
  assert.match(page, /setIsCatalogSearchOpen\(false\)/);
  assert.match(page, /startCatalogFamilyConsultation\(family\)/);
  assert.match(page, /onAddToConsultation=\{product => \{\s*setIsCatalogSearchOpen\(false\);\s*startCatalogConsultation\(product\);\s*\}\}/);
  assert.match(page, /const startCatalogConsultation = \(product: ConsultationProduct\)/);
  assert.match(page, /setIsCatalogSearchOpen\(false\)/);
  assert.match(page, /consumeForzaTextStream/);
});


test('workspace visual-identification actions open the standalone VISION route', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  const provider = read('src/components/search/PartIdentificationProvider.tsx');
  assert.match(page, /navigate\('\/identify-part\?from=workspace'\)/);
  assert.match(page, /entryParams\.get\('view'\) === 'visual'/);
  assert.match(page, /aria-controls="forza-workspace-catalog-drawer"/);
  assert.match(page, /aria-expanded=\{isCatalogSearchOpen\}/);
  assert.match(provider, /KikiVisualPartSearchModal/);
  assert.match(provider, /Studio isOpen standalone/);
  assert.match(provider, /fullScreen/);
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
  assert.ok(history.includes('removeItem(LEGACY_STORAGE_KEY)'));
  assert.doesNotMatch(history, /DEFAULT_RECENT_SEARCHES/);
});


test('history starts empty and never injects sample records', () => {
  const { values } = installStorage();
  assert.deepEqual(loadVisionRecentSearches(), []);
  assert.equal(values.has(STORAGE_KEY), false);
});

test('legacy v1 history is deleted instead of restoring arbitrary customer image URLs', () => {
  const { values } = installStorage();
  values.set(LEGACY_KEY, JSON.stringify([{
    id: 'old',
    title: 'تصویر مشتری',
    subtitle: 'نمونه قدیمی',
    timeLabel: 'امروز',
    imageUrl: 'data:image/jpeg;base64,PRIVATE_CUSTOMER_IMAGE',
    code: 'PRIVATE-1',
  }]));

  assert.deepEqual(loadVisionRecentSearches(), []);
  assert.equal(values.has(LEGACY_KEY), false);
});

test('history stores metadata but rejects data URLs, blob URLs and remote images', () => {
  const { values } = installStorage();
  const items = recordVisionRecentSearch({
    code: 'TEST-101',
    title: 'بلبرینگ آزمایشی',
    subtitle: 'نتیجه کاتالوگ',
    imageUrl: 'data:image/jpeg;base64,PRIVATE_CUSTOMER_IMAGE',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].code, 'TEST-101');
  assert.equal(items[0].imageUrl, undefined);
  const stored = values.get(STORAGE_KEY) || '';
  assert.ok(!stored.includes('data:image'));
  assert.ok(!stored.includes('blob:'));
  assert.ok(!stored.includes('PRIVATE_CUSTOMER_IMAGE'));

  recordVisionRecentSearch({
    code: 'TEST-102',
    title: 'پولی آزمایشی',
    imageUrl: 'blob:https://sanatpish.com/private-preview',
  });
  recordVisionRecentSearch({
    code: 'TEST-103',
    title: 'چرخ‌دنده آزمایشی',
    imageUrl: 'https://external.invalid/private-photo.webp',
  });
  recordVisionRecentSearch({
    code: 'TEST-104',
    title: 'تصویر بارگذاری‌شده',
    imageUrl: '/storage/products/550e8400-e29b-41d4-a716-446655440000.webp',
  });
  const afterRemote = values.get(STORAGE_KEY) || '';
  assert.ok(!afterRemote.includes('blob:'));
  assert.ok(!afterRemote.includes('https://'));
  assert.ok(!afterRemote.includes('550e8400-e29b-41d4-a716-446655440000'));
});

test('history accepts only a registered public catalogue image path', () => {
  const { values } = installStorage();
  const items = recordVisionRecentSearch({
    code: 'AT-E003',
    title: 'قطعه کاتالوگ',
    imageUrl: '/storage/products/catalog/e(3).png',
  });

  assert.equal(items[0].imageUrl, '/storage/products/catalog/e(3).png');
  const stored = JSON.parse(values.get(STORAGE_KEY) || '[]') as Array<{ imageUrl?: string }>;
  assert.equal(stored[0]?.imageUrl, '/storage/products/catalog/e(3).png');
});

test('history de-duplicates by product code and keeps at most eight entries', () => {
  installStorage();
  for (let i = 0; i < 10; i++) {
    recordVisionRecentSearch({ code: `SKU-${i}`, title: `قطعه ${i}` });
  }
  recordVisionRecentSearch({ code: 'SKU-9', title: 'قطعه نهم - به‌روزرسانی' });
  const items = loadVisionRecentSearches();
  assert.equal(items.length, 8);
  assert.equal(items[0].title, 'قطعه نهم - به‌روزرسانی');
  assert.equal(items.filter(item => item.code === 'SKU-9').length, 1);
});


test('KIKI vision studio uses progressive local recognition and preserves private customer images', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  const provider = read('src/components/search/PartIdentificationProvider.tsx');
  const scanner = read('src/components/search/KikiVisualPartSearchModal.tsx');
  const history = read('src/components/search/visionRecentHistory.ts');

  assert.match(page, /KikiVisualPartSearchModal/);
  assert.match(page, /navigate\('\/identify-part\?from=workspace/);
  assert.match(provider, /KikiVisualPartSearchModal/);
  assert.match(provider, /useOnnxPartSegmentation/);
  assert.match(provider, /preloadStudio/);
  assert.match(scanner, /payloadIsCropped/);
  assert.match(scanner, /queryRegions/);
  assert.match(scanner, /analyzeImageAutoContour\(fastDetectUrl, 0\)/);
  assert.match(scanner, /const aiSegPromise = segmentWithOnnx\(fastDetectUrl\)/);
  assert.match(scanner, /void segmentationRefinementPromise\.finally/);
  assert.doesNotMatch(scanner, /customerImageBlobToDataUrl\(blob\)/);
  assert.doesNotMatch(scanner, /inferVisualDescriptor/);
  assert.match(scanner, /formatVisionRecentTime\(item.createdAt\)/);
  assert.match(scanner, /stage: 'first-contour'/);
  assert.match(scanner, /stage: 'catalog-result'/);
  assert.match(history, /sanatpish_forza_vision_recent_v2/);
  assert.match(history, /safeCatalogImage/);
});


test('all production image-search entry points use the KIKI studio and prewarm it', () => {
  const home = read('src/pages/HomePage.tsx');
  const header = read('src/components/layout/Header.tsx');
  const voice = read('src/components/forza/AiForzaCallExperience.tsx');
  const routePreload = read('src/components/layout/RouteIntentPreload.tsx');
  const workspace = read('src/pages/AiConsultPage.tsx');
  const provider = read('src/components/search/PartIdentificationProvider.tsx');

  for (const source of [home, header, voice, routePreload, workspace, provider]) {
    assert.match(source, /KikiVisualPartSearchModal/);
  }
  for (const source of [home, header, voice, routePreload, workspace, provider]) {
    assert.match(source, /preloadPartIdentificationStudio/);
  }
  assert.match(voice, /onAnalysisResult=\{async\(result,image\)=>/);
  assert.match(voice, /void handleUserFinishedSpeaking\(query\)/);
  assert.doesNotMatch(home, /import\("\.\.\/components\/search\/AiVisualPartSearchModal"\)/);
  assert.doesNotMatch(header, /import\('\.\.\/search\/AiVisualPartSearchModal'\)/);
  assert.doesNotMatch(voice, /import\('\.\.\/search\/AiVisualPartSearchModal'\)/);
  assert.doesNotMatch(routePreload, /import\('\.\.\/search\/AiVisualPartSearchModal'\)/);
});
