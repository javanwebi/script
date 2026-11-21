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
});
