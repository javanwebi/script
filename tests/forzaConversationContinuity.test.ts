import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  appendForzaSessionTurn,
  replaceForzaLastSessionTurn,
  composeForzaSessionTranscript,
  mapForzaSegmentsInOrder,
} from '../src/utils/forzaSpeechPipeline';

test('customer transcript continues after arbitrarily long pauses without deleting earlier words',()=>{
  let session='';
  session=appendForzaSessionTurn(session,'برای خط تولید تسمه می خواهم');
  const afterPause=composeForzaSessionTranscript(session,'عرض بیست میلی متر');
  assert.equal(afterPause,'برای خط تولید تسمه می خواهم\nعرض بیست میلی متر');
  session=appendForzaSessionTurn(session,'عرض بیست میلی متر');
  session=appendForzaSessionTurn(session,'طول هزار و دویست و پنجاه');
  assert.equal(session,'برای خط تولید تسمه می خواهم\nعرض بیست میلی متر\nطول هزار و دویست و پنجاه');
});

test('repeated words in separate user turns are retained instead of overlap-deduplicated',()=>{
  assert.equal(appendForzaSessionTurn('سلام','سلام'),'سلام\nسلام');
});

test('a final Diba correction replaces only the last transcript turn',()=>{
  const session='برای خط بسته بندی تسمه می خواهم\nعرض بیست میلی متر';
  assert.equal(
    replaceForzaLastSessionTurn(session,'عرض بیست میلی متر','عرض ۲۰ میلی‌متر'),
    'برای خط بسته بندی تسمه می خواهم\nعرض ۲۰ میلی‌متر',
  );
});

test('long recording segments are processed with bounded concurrency and original ordering',async()=>{
  let active=0,maxActive=0;
  const results=await mapForzaSegmentsInOrder(['first','second','third','fourth','fifth'],2,async value=>{
    active++;maxActive=Math.max(maxActive,active);
    await new Promise(resolve=>setTimeout(resolve,value==='first'?12:2));
    active--;
    if(value==='third')throw new Error('one segment unavailable');
    return value.toUpperCase();
  });
  assert.ok(maxActive<=2,'the browser must not flood the two-worker Diba pool');
  assert.deepEqual(results.map(result=>result.status),[
    'fulfilled','fulfilled','rejected','fulfilled','fulfilled',
  ]);
  assert.deepEqual(results.filter(result=>result.status==='fulfilled').map(result=>
    result.status==='fulfilled'?result.value:''),['FIRST','SECOND','FOURTH','FIFTH']);
});

test('FORZA keeps a call-wide transcript and continuation-aware model context',()=>{
  const ui=readFileSync('src/components/forza/AiForzaCallExperience.tsx','utf8');
  const server=readFileSync('server.ts','utf8');
  const liveConsult=readFileSync('server/ai/baiConsult.ts','utf8');
  assert.match(ui,/sessionTranscriptRef\s*=\s*useRef<string>\(''\)/);
  assert.match(ui,/pendingCommittedTranscriptRef/);
  assert.match(ui,/historyRef\.current=\[\.\.\.prior,\{role:'user',text:q\}\]/,
    'the recognized user turn must enter conversation history before async STT can be interrupted');
  assert.match(ui,/sessionTranscriptRef\.current=appendForzaSessionTurn\(sessionTranscriptRef\.current,candidate\)/);
  assert.match(ui,/setUserText\(composeForzaSessionTranscript\(sessionTranscriptRef\.current,transcript\)\)/,
    'the live customer transcript must retain prior call turns while showing the current Diba hypothesis');
  assert.match(ui,/mapForzaSegmentsInOrder\(audioBlobs,2/);
  assert.match(ui,/Math\.ceil\(audioBlobs\.length\/2\)\*22_000/);
  assert.doesNotMatch(ui,/audioSegmentsRef\.current\.length>4/,
    'no earlier audio segment may be shifted out of a long recording');
  assert.match(server,/گفتار تازه ادامه، تکمیل، اصلاح یا جزئیاتِ صحبت قبلی است/);
  assert.match(server,/تاریخچه پیام‌ها را قبل از تفسیر هر گفتار تازه بررسی کنید/);
  assert.match(server,/history\.slice\(-40\)/);
  assert.match(liveConsult,/مکث طولانی، مکث بین جمله‌ها/);
  assert.match(liveConsult,/پیش‌فرض شما این باشد که گفتار تازه ادامه/);
  assert.match(liveConsult,/به تعداد ثابت جمله محدود نکنید/);
  assert.doesNotMatch(server,/normalizePersianTranscript\(String\(query \|\| ''\)\)\.slice\(0,\s*2500\)/);
  assert.doesNotMatch(server,/response\?\.text \|\| ''\)\.trim\(\)\.slice\(0,\s*2500\)/);
});
