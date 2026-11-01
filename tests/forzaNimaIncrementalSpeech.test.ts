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
  const first=planner.push(short+'آیا مدل دستگاه را ');
  assert.equal(first.length,1,'first word group crosses punctuation only after word limit');
  const full=short+'آیا مدل دستگاه را بفرمایید؟ سپس موجودی را بررسی می‌کنم.';
  const phrases=[...first,...planner.push(full),...planner.complete(full)];
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

test('FORZA final two words are combined with a reserved phrase, not a separate WAV',()=>{
  const answer='سلام، وقت بخیر؛ برای ارائه اطلاعات دقیق و تأییدشده از کاتالوگ صنعت پیش، '+
    'لطفاً نام یا کد قطعه صنعتی مورد نظر خود را بفرمایید.';
  const planner=new ForzaIncrementalSpeechText();
  const early:string[]=[];
  for(let n=1;n<=answer.length;n++)early.push(...planner.push(answer.slice(0,n)));
  assert.ok(early.length>0,'first coherent phrase must synthesize before final done');
  const final=planner.complete(answer);
  assert.equal(final.length,1,'a final reserved group and two-word suffix must share one TTS request');
  const tailWords=final[0].trim().split(/\s+/);
  assert.ok(tailWords.length>4,'do not generate a separate WAV for the last two words');
  assert.ok(final[0].endsWith('را بفرمایید.'));
  assert.equal([...early,...final].join(' ').replace(/\s+/g,' ').trim(),answer.trim());
});

test('when final done carries only two new words, they join the held last phrase',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const previous='برای انتخاب بهترین قطعات صنعتی در کاتالوگ صنعت پیش '+
    'لطفا مدل و مشخصات دستگاه مورد نظر خود را ';
  const early=planner.push(previous);
  assert.equal(early.length,1,'first phrase still goes out early');
  const final=planner.complete(previous+'بفرمایید لطفاً.');
  assert.equal(final.length,1,'last phrase and two late words must be a single WAV');
  assert.ok(final[0].includes('مشخصات دستگاه'));
  assert.ok(final[0].endsWith('بفرمایید لطفاً.'));
  assert.equal([...early,...final].join(' ').replace(/\s+/g,' ').trim(),
    (previous+'بفرمایید لطفاً.').trim());
});

test('holdback releases older buffered groups during long SSE, not only at done',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const text='برای ارائه مشاوره درباره انواع تسمه صنعتی لازم است ابتدا مشخصات دستگاه را '+
    'بفرمایید تا بتوانیم کد فنی محصول را با اطلاعات معتبر کاتالوگ صنعت پیش '+
    'مقایسه کرده و گزینه های مناسب را بررسی و پیشنهاد کنیم.';
  const output:string[]=[];
  for(let i=1;i<=text.length;i++)output.push(...planner.push(text.slice(0,i)));
  assert.ok(output.length>=2,'middle audio must keep streaming before final done');
  const last=planner.complete(text);
  assert.ok(last.every(phrase=>phrase.split(/\s+/).length>2));
  assert.equal([...output,...last].join(' ').replace(/\s+/g,' ').trim(),text);
});

test('a delayed SSE done cannot hold the final complete Persian words for seconds',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const finalText='سلام، برای بررسی مشخصات قطعات صنعتی از کاتالوگ صنعت پیش '+
    'لطفاً نام و کد فنی مورد نظر خود را بفرمایید.';
  const emitted=planner.push(finalText);
  assert.ok(emitted.length>0);
  const early=planner.flushTerminalIdle();
  assert.equal(early.length,1,'one reserved end phrase should start when terminal SSE stalls');
  assert.ok(early[0].endsWith('خود را بفرمایید.'));
  assert.deepEqual(planner.flushTerminalIdle(),[],'timer must never duplicate audio');
  assert.deepEqual(planner.complete(finalText),[],'authoritative done must not replay early audio');
  assert.equal([...emitted,...early].join(' ').replace(/\s+/g,' ').trim(),finalText);
});

test('terminal idle never pronounces an unfinished word or decimal as a complete reply',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const input='قطر محصول 3.25 و شماره فنی قطعه مورد نیاز ';
  const emitted=planner.push(input);
  assert.deepEqual(planner.flushTerminalIdle(),[]);
  const full=input+'برای استعلام و بررسی کاتالوگ دقیق است.';
  const more=planner.push(full);
  const final=[...emitted,...more,...planner.complete(full)].join(' ').replace(/\s+/g,' ').trim();
  assert.equal(final,full.trim());
});

test('new text after terminal idle flush is still streamed and voiced once in order',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const first='برای بررسی محصول مورد نظر لطفاً کد قطعه را بفرمایید.';
  const early=[...planner.push(first),...planner.flushTerminalIdle()];
  const full=first+' همچنین می‌توانید نام سازنده و اندازه قطعه را اعلام کنید.';
  const remaining=[...planner.push(full),...planner.complete(full)];
  assert.equal([...early,...remaining].join(' ').replace(/\s+/g,' ').trim(),full);
});

test('SSE idle releases the full ready middle phrase before the AudioContext buffer runs dry',()=>{
  const sentence='برای انتخاب قطعه مناسب ابتدا کد دستگاه را بررسی کنید و '+
    'سپس مشخصات صنعتی سفارش را به ما اعلام بفرمایید تا بتوانیم '+
    'مدل و سایز مناسب تسمه صنعتی را از کاتالوگ بررسی کنیم.';
  const planner=new ForzaIncrementalSpeechText();
  const early=planner.push(sentence);
  const idle=planner.flushBufferedOnIdle();
  const final=planner.complete(sentence);
  assert.ok(early.length>=1,'the first short phrase is synthesized during SSE');
  assert.ok(idle.length>=1,'completed middle words must not wait for SSE done');
  assert.equal(planner.flushBufferedOnIdle().length,0,'no duplicate release');
  assert.equal([...early,...idle,...final].join(' ').replace(/\s+/g,' ').trim(),sentence);
});

test('idle does not send a partial word or duplicate a future updated transcript',()=>{
  const planner=new ForzaIncrementalSpeechText();
  const first='برای استعلام موجودی یاتاقان صنعتی باید شماره مدل دقیق دستگاه ';
  const outputs=planner.push(first);
  assert.ok(outputs.length>0);
  const idle=planner.flushBufferedOnIdle();
  const rest=first+'را برای کارشناسان فنی صنعت پیش ارسال کنید.';
  const more=planner.push(rest);
  const completed=planner.complete(rest);
  assert.equal([...outputs,...idle,...more,...completed].join(' ').replace(/\s+/g,' ').trim(),rest.trim());
});
