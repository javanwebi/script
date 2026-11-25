import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  appendForzaSpeechSegment, checkpointForzaRecognition, extractPersianSpeechRecognition, extractPersianSpeechSince, forzaEndOfTurnPauseMs, forzaTurnRemainingWaitMs,
  normalizePersianTranscript, verbalizeForzaTechnicalTerms, extractForzaAudioBase64, chooseForzaFinalTranscript,
  canUseForzaServerFinalTranscript, shouldRunForzaServerFinalTranscript, forzaLiveSttVerificationBudgetMs,
} from '../src/utils/forzaSpeechPipeline.ts';

function result(value:string, isFinal:boolean) {
  return {0:{transcript:value},isFinal};
}
test('Chrome cumulative WebSpeech results preserve earlier finalized words',()=>{
  let r = extractPersianSpeechRecognition([result('سلام، من تسمه',true),result('  8M می‌خواهم',false)]);
  assert.equal(r.text,'سلام، من تسمه 8M می‌خواهم');
  assert.equal(r.finalText,'سلام، من تسمه');
  assert.equal(r.hasInterim,true);
  r = extractPersianSpeechRecognition([result('سلام، من تسمه',true),result(' 8M می‌خواهم',true)]);
  assert.equal(r.text,'سلام، من تسمه 8M می‌خواهم');
  assert.equal(r.hasInterim,false);
});

test('Persian normalization preserves real product codes and numbers',()=>{
  assert.equal(normalizePersianTranscript('بلبرينگ 6205-2RS و كد SPB  '),'بلبرینگ 6205-2RS و کد SPB');
  assert.equal(normalizePersianTranscript('   '),'');
});

test('Adaptive endpointing dispatches complete Persian speech quickly and protects unfinished industrial phrases',()=>{
  assert.equal(forzaEndOfTurnPauseMs('این تسمه را می‌خواهم چون',false),2250);
  assert.equal(forzaEndOfTurnPauseMs('مدل 6205',true),2200);
  assert.equal(forzaEndOfTurnPauseMs('سلام',false),650);
  assert.equal(forzaEndOfTurnPauseMs('ممنون',false),650);
  assert.equal(forzaEndOfTurnPauseMs('مدل چند است؟',false),750);
  assert.equal(forzaTurnRemainingWaitMs('مدل چند است؟',false,1000,1000),0);
  assert.equal(forzaTurnRemainingWaitMs('مدل چند است؟',false,500,500),250);
  assert.equal(forzaEndOfTurnPauseMs('چه خبر خوبی',true),850);
  assert.equal(forzaEndOfTurnPauseMs('',false),3200);
});

test('Only the spoken copy expands industrial codes, never the underlying SKU',()=>{
  const technical='بلبرینگ 6205-2RS با لقی C3 و تسمه PK، استاندارد ISO';
  const spoken=verbalizeForzaTechnicalTerms(technical);
  assert.match(spoken,/6205-دو آر اِس/);
  assert.match(spoken,/سی سه/);
  assert.match(spoken,/پی کا/);
  assert.match(spoken,/آی اِس اُ/);
  assert.equal(technical,'بلبرینگ 6205-2RS با لقی C3 و تسمه PK، استاندارد ISO');
  assert.equal(verbalizeForzaTechnicalTerms(''),'');
});

test('Chrome MediaRecorder codec-specific data URLs are valid for Worker STT',()=>{
  const bytes=Buffer.from([0x1a,0x45,0xdf,0xa3,0x00,0x01]);
  const base64=bytes.toString('base64');
  assert.equal(extractForzaAudioBase64('data:audio/webm;codecs=opus;base64,'+base64),base64);
  assert.equal(extractForzaAudioBase64('data:audio/mp4;codecs=mp4a.40.2;base64,'+base64),base64);
  assert.equal(extractForzaAudioBase64('data:audio/wav;base64,'+base64),base64);
  assert.equal(extractForzaAudioBase64(base64),base64);
  assert.throws(()=>extractForzaAudioBase64('data:audio/webm;codecs=opus,'+base64),/Invalid encoded audio/);
});


test('continuous browser recognition does not replay final results from the previous customer turn',()=>{
  const previous=[result('تسمه SPA 1250 لازم دارم',true)];
  assert.equal(extractPersianSpeechSince(previous,1).text,'');
  const corrected=[...previous,result('نه، بلبرینگ 6202ZZ با لقی C3',false)];
  assert.equal(extractPersianSpeechSince(corrected,1).text,'نه، بلبرینگ 6202ZZ با لقی C3');
  corrected[1]=result('نه، بلبرینگ 6203ZZ با لقی C3',true);
  assert.equal(extractPersianSpeechSince(corrected,1).finalText,'نه، بلبرینگ 6203ZZ با لقی C3');
  assert.equal(extractPersianSpeechSince([result('سؤال جدید',true)],2).text,'');
});

test('dispatching interim speech does not swallow a second sentence in the same Chrome slot',()=>{
 const checkpoint=checkpointForzaRecognition([result('سلام خوبی',false)]);
 assert.equal(checkpoint.count,0);
 const read=(text:string,final=false)=>extractPersianSpeechSince(
   [result(text,final)],checkpoint.count,checkpoint.interim);
 assert.equal(read('سلام خوبی').text,'');
 assert.equal(read('سلام خوبی بلبرینگ می خواهم').text,'بلبرینگ می خواهم');
 assert.equal(read('سلام خوبی بلبرینگ می خواهم',true).finalText,'بلبرینگ می خواهم');
 assert.equal(read('نه منظورم تسمه بود').text,'نه منظورم تسمه بود');
});
test('final results are consumed while interim prefixes remain revisable',()=>{
 const checkpoint=checkpointForzaRecognition([result('سلام',true),result('کد 6202',false)]);
 assert.equal(checkpoint.count,1);
 assert.equal(extractPersianSpeechSince(
   [result('سلام',true),result('کد 6202 نه 6203',false)],
   checkpoint.count,checkpoint.interim).text,'نه 6203');
 assert.equal(extractPersianSpeechSince(
   [result('سلام',true),result('کد 6202',true),result('ده عدد',true)],
   checkpoint.count,checkpoint.interim).text,'ده عدد');
});

test('speech session stitching keeps words across recognition restarts and partial-word boundaries',()=>{
  assert.equal(appendForzaSpeechSegment('من برای خط تولید','خط تولید یک تسمه'), 'من برای خط تولید یک تسمه');
  assert.equal(appendForzaSpeechSegment('تایم','تایمینگ'), 'تایمینگ');
  assert.equal(appendForzaSpeechSegment('بلبرینگ 6202','6202ZZ'), 'بلبرینگ 6202ZZ');
  assert.equal(appendForzaSpeechSegment('جمله اول','جمله اول'), 'جمله اول');
});

test('turn endpoint waits for both transcript stability and acoustic silence',()=>{
  assert.ok(forzaTurnRemainingWaitMs('این تسمه را می خواهم',false,5000,1200)>0);
  assert.ok(forzaTurnRemainingWaitMs('این تسمه را می خواهم چون',true,5500,1000)>0);
  assert.equal(forzaTurnRemainingWaitMs('سلام',false,6000,6000),0);
});


test('FORZA response stream has no fixed total-duration cutoff',()=>{
  const source=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/totalTimer|120000|بیش از دو دقیقه/);
  assert.match(source,/ارتباط متن هوش مصنوعی بیش از ۴۵ ثانیه بدون داده ماند/);
});

test('live STT verification budget is fast for short speech and scales without a fixed recording cap',()=>{
  assert.equal(forzaLiveSttVerificationBudgetMs(0),1_000);
  assert.equal(forzaLiveSttVerificationBudgetMs(12_000),1_350);
  assert.equal(forzaLiveSttVerificationBudgetMs(160_000),6_900);
  assert.ok(forzaLiveSttVerificationBudgetMs(1_000_000)>forzaLiveSttVerificationBudgetMs(160_000));
  assert.equal(forzaLiveSttVerificationBudgetMs(Number.NaN),1_000);
});

test('every captured audio turn gets server final verification when a server recognizer is configured, even with browser text',()=>{
  assert.equal(shouldRunForzaServerFinalTranscript(true,true),true);
  assert.equal(shouldRunForzaServerFinalTranscript(true,false),false);
  assert.equal(shouldRunForzaServerFinalTranscript(false,true),false);
});

test('a partial server transcript never replaces the complete browser utterance after any segment fails',()=>{
  assert.equal(canUseForzaServerFinalTranscript('تمام متن گفتار',0),true);
  assert.equal(canUseForzaServerFinalTranscript('فقط بخش دوم گفتار',1),false);
  assert.equal(canUseForzaServerFinalTranscript('فقط بخش سوم گفتار',2),false);
  assert.equal(canUseForzaServerFinalTranscript('',0),false);
  assert.equal(canUseForzaServerFinalTranscript('متن ناقص',Number.NaN),false);
  const ui=readFileSync(new URL('../src/components/forza/AiForzaCallExperience.tsx',import.meta.url),'utf8');
  assert.match(ui,/canUseForzaServerFinalTranscript\(serverTranscript,failedSegments\)/);
  assert.match(ui,/shouldRunForzaServerFinalTranscript\(\s*Boolean\(audioBlob\),serverSttConfiguredRef\.current===true,/);
  assert.match(ui,/server_verifier=scheduled/);
  assert.doesNotMatch(ui,/server_verifier=skipped/);
  assert.doesNotMatch(ui,/const needsServerFinal = Boolean\(audioBlob\)[\s\S]{0,140}!q;/);
});

test('AvalAI final transcript corrects a plausible but wrong browser product code',()=>{
  const browser='برای خط تولید بلبرینگ 6303 ZZ می‌خواهم';
  const avalai='برای خط تولید بلبرینگ 6203 ZZ می‌خواهم';
  assert.equal(chooseForzaFinalTranscript(browser,avalai,true),avalai);
});

test('AvalAI final transcript removes long hallucinated Persian suffixes from browser STT',()=>{
  const browser='سلام خوبی چه خبر چه خبر خوبی زن عشق کون عزیزم عزیزم جون من ارزش قائلم';
  const avalai='سلام خوبی چه خبر خوبی';
  assert.equal(chooseForzaFinalTranscript(browser,avalai,true),avalai);
});

test('AvalAI trusts a complete short multiword correction over a long noisy browser transcript',()=>{
  const browser='سلام خوبی چه خبر چه خبر خوبی زن عشق کون عزیزم عزیزم جون من ارزش قائلم';
  assert.equal(chooseForzaFinalTranscript(browser,'تسمه تایمینگ',true),'تسمه تایمینگ');
});

test('AvalAI final transcript does not replace a complete browser turn with a tiny fragment',()=>{
  const browser='برای خط بسته‌بندی تسمه تایمینگ با عرض بیست میلی‌متر می‌خواهم';
  assert.equal(chooseForzaFinalTranscript(browser,'تسمه',true),browser);
});

test('Diba fallback keeps the existing technical-code preservation heuristic',()=>{
  const browser='بلبرینگ 6203 ZZ برای خط تولید';
  const diba='بلبرینگ برای خط تولید';
  assert.equal(chooseForzaFinalTranscript(browser,diba,false),browser);
});
