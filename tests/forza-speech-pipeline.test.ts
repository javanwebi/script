import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPersianSpeechRecognition, extractPersianSpeechSince, forzaEndOfTurnPauseMs,
  normalizePersianTranscript, verbalizeForzaTechnicalTerms, extractForzaAudioBase64,
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

test('Do not cut a half-finished sentence after a short hesitation',()=>{
  assert.ok(forzaEndOfTurnPauseMs('این تسمه را می‌خواهم چون',false)>=800);
  assert.ok(forzaEndOfTurnPauseMs('مدل 6205',true)>=900);
  assert.ok(forzaEndOfTurnPauseMs('سلام',false)<=500);
  assert.ok(forzaEndOfTurnPauseMs('مدل چند است؟',false)<=500);
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
