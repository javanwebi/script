import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaIncrementalSpeechText } from '../src/utils/forzaIncrementalSpeechText';

function speakInDeltas(text:string):string[] {
  const stream=new ForzaIncrementalSpeechText();
  const phrases:string[]=[];
  for(let i=1;i<=text.length;i++)phrases.push(...stream.push(text.slice(0,i)));
  phrases.push(...stream.complete(text));
  return phrases;
}

test('period, comma and question mark never independently trigger a new Piper WAV',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const short='سلام، فورزا آماده است. ';
  assert.deepEqual(planner.push(short),[]);
  assert.deepEqual(planner.push(short+'آیا مدل دستگاه را '),[]);
  const full=short+'آیا مدل دستگاه را بفرمایید؟ سپس موجودی را بررسی می‌کنم.';
  const phrases=[...planner.push(full),...planner.complete(full)];
  assert.ok(phrases[0].includes('است.'),'period stays inside the first continuous chunk');
  assert.ok(phrases[0].includes('آیا'),'the first phrase crosses the period');
  assert.equal(phrases.join(' ').replace(/\s+/g,' ').trim(),full.trim());
});

test('one-character-at-a-time SSE never duplicates or loses words',()=>{
  const input='برای انتخاب تسمه مناسب لطفاً مدل دستگاه را بفرمایید. '+
    'ما مشخصات فنی را بررسی می‌کنیم.';
  const phrases=speakInDeltas(input);
  assert.ok(phrases.length>=2,'the answer is spoken before all text is delivered');
  assert.equal(phrases.join(' ').replace(/\s+/g,' ').trim(),input.trim());
});

test('Nima retains industrial decimals and rejects a revised LLM transcript',()=>{
  const planner=new ForzaIncrementalSpeechText();
  assert.deepEqual(planner.push('قطر قطعه 3.25 میلی متر است. و '),[]);
  const next='قطر قطعه 3.25 میلی متر است. و کد فنی استاندارد را بررسی می‌کنیم. ';
  const phrases=[...planner.push(next),...planner.complete(next)];
  assert.equal(phrases.join(' ').replace(/\s+/g,' ').trim(),next.trim());
  assert.throws(()=>planner.push('قطر قطعه 4.25 میلی متر است. و '),/stream_revised/);
});

test('unfinished last word is buffered until its boundary or final done',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const prefix='برای بررسی قطعات مورد نیاز به مدل دستگا';
  assert.ok(!planner.push(prefix).some(part=>part.endsWith('دستگا')));
  const whole=prefix+'ه و مشخصات دقیق آن نیاز داریم.';
  const phrases=planner.complete(whole);
  assert.ok(phrases.join(' ').includes('دستگاه'));
});

test('Nima begins at first complete word group without waiting for full response',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const prefix='برای انتخاب قطعه صنعتی مناسب ابتدا مدل ';
  assert.ok(prefix.length<80);
  const first=planner.push(prefix);
  assert.equal(first.length,1);
  assert.ok(first[0].length>=22);
  assert.equal(planner.push(prefix).length,0);
  const whole=prefix+'دستگاه را بفرمایید تا مشخصات مورد نیاز را بررسی کنیم.';
  assert.equal([...first,...planner.complete(whole)].join(' ').replace(/\s+/g,' ').trim(),whole.trim());
});

test('short final answers flush only on explicit done',()=>{
  const planner=new ForzaIncrementalSpeechText();
  assert.deepEqual(planner.push('سلام فورزا'),[]);
  assert.deepEqual(planner.complete('سلام فورزا'),['سلام فورزا']);
  assert.deepEqual(planner.complete('سلام فورزا'),[]);
});

test('several sentences in one SSE event do not turn into per-sentence audio requests',()=>{
  const answer='سلام. من فورزا هستم. مشخصات فنی محصول را بررسی می‌کنم. '+
    'لطفاً کد دقیق را بفرمایید. متشکرم.';
  const phrases=speakInDeltas(answer);
  const sentences=answer.match(/[.!؟]+/g)?.length||0;
  assert.ok(phrases.length < sentences,'there must be fewer audio requests than punctuation marks');
  assert.ok(phrases.some(p=>p.includes('.')&&p.includes('مشخصات')),'punctuation remains inside continuous word group');
  assert.equal(phrases.join(' ').replace(/\s+/g,' ').trim(),answer.trim());
});
