import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildVisionConsultationPrompt } from '../src/utils/visionConsultationPrompt';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('visual similarity is explicitly provisional, never a verified replacement or price', () => {
  const prompt = buildVisionConsultationPrompt({
    code: '6203ZZ', name: 'بلبرینگ 6203ZZ', brand: 'آزمایشی', size: '17x40x12 mm', isSimilar: true,
  });
  assert.ok(prompt);
  assert.match(prompt, /6203ZZ/);
  assert.match(prompt, /17x40x12 mm/);
  assert.match(prompt, /فقط نامزد مشابه ظاهری/);
  assert.match(prompt, /قیمت، موجودی/);
  assert.match(prompt, /بدون اطلاعات معتبر/);
  assert.ok(!prompt.includes('http'));
  assert.ok(!prompt.includes('data:image/'));
});

test('even an identified match remains a technical candidate', () => {
  const prompt = buildVisionConsultationPrompt({code:'SPA 1250',name:'تسمه صنعتی',isSimilar:false});
  assert.match(prompt || '', /انطباق فنی قطعی هنوز تأیید نشده/);
  assert.match(prompt || '', /SPA 1250/);
});

test('no catalog match does not generate an invented code', () => {
  const prompt = buildVisionConsultationPrompt(undefined, {detectedPartType:'چرخ‌دنده',detectedProfile:'نامشخص'});
  assert.match(prompt || '', /هیچ کد کالای مطابقی تأیید نشده/);
  assert.match(prompt || '', /ساخت سفارشی/);
  assert.ok(!prompt?.includes('6203ZZ'));
  assert.equal(buildVisionConsultationPrompt(undefined, undefined), null);
});

test('vision handoff clips unusual catalogue text rather than forwarding raw markup', () => {
  const prompt = buildVisionConsultationPrompt({code:'ABC-19',name:'قطعه\n<script>unsafe</script>',isSimilar:true});
  assert.ok(prompt);
  assert.ok(!prompt.includes('<script>'));
  assert.ok(!prompt.includes('\n<script>'));
});

test('switch, delete and clear invalidate streaming ownership and preserve user chat isolation', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  assert.match(page, /const cancelActiveConsultation = \(\) => \{/);
  assert.match(page, /streamAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(page, /const createNewSession = \(autoFocus = true, baseSessions: ChatSession\[\] = sessions\) => \{\s*cancelActiveConsultation\(\)/);
  assert.match(page, /const switchSession = \(sessionId: string\) => \{[\s\S]*?cancelActiveConsultation\(\)/);
  assert.match(page, /createNewSession\(false, updated\)/);
  assert.match(page, /createNewSession\(false, \[\]\)/);
  assert.match(page, /if \(abortCtrl\.signal\.aborted \|\| streamAbortControllerRef\.current !== abortCtrl\) return;/);
  assert.match(page, /streamAbortControllerRef\.current\?\.abort\(\);\s*streamAbortControllerRef\.current = null;\s*\}, \[\]\)/);
});

test('vision to FORZA passes selected real code to text and CRM but no photo', () => {
  const page = read('src/pages/AiConsultPage.tsx');
  assert.match(page, /buildVisionConsultationPrompt/);
  assert.match(page, /selectCustomerImageProduct\(imageEventId, targetItem\.code\)/);
  assert.match(page, /void handleSend\(prompt, product\)/);
  assert.match(page, /productCodes: turnSelectedProducts\.map/);
  assert.match(page, /products: productsForTurn\.map/);
  const analysis = page.slice(page.indexOf('const runAiPartAnalysis = async'), page.indexOf('const transferAnalysisToChat'));
  assert.ok(!analysis.includes("openAuthModal('/ai-consult'"), 'guest image recognition must not force account registration');
  assert.match(analysis, /if \(currentUser\) await adoptCustomerDeviceImage/);
  assert.match(analysis, /if \(currentUser && !activeImageEventId\)/);
});

test('image wizard closing cancels all stale updates and frees local preview URLs', () => {
  const wizard = read('src/components/search/AiVisualPartSearchModal.tsx');
  assert.match(wizard, /analysisSequenceRef\.current\+\+;\s*imagePreparationSequenceRef\.current\+\+;/);
  assert.match(wizard, /URL\.revokeObjectURL\(latestImageUrlRef\.current\)/);
  assert.match(wizard, /buildVisionConsultationPrompt/);
  assert.match(wizard, /productCode: match\.code/);
  assert.match(wizard, /navigate\('\/ai-consult\?' \+ params\.toString\(\)\)/);
});
