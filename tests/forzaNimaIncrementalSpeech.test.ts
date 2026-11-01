import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaIncrementalSpeechText } from '../src/utils/forzaIncrementalSpeechText';

test('Nima speaks only completed Persian clauses while words arrive progressively',()=>{
 const stream=new ForzaIncrementalSpeechText();
 assert.deepEqual(stream.push('سلام، من فور'),[]);
 assert.deepEqual(stream.push('سلام، من فورزا هستم. و '),['سلام، من فورزا هستم.']);
 assert.deepEqual(stream.push('سلام، من فورزا هستم. و در صنعت پیش کمک می‌کنم. '),
  ['و در صنعت پیش کمک می‌کنم.']);
 assert.deepEqual(stream.complete('سلام، من فورزا هستم. و در صنعت پیش کمک می‌کنم. اکنون آماده هستم.'),
  ['اکنون آماده هستم.']);
});

test('Nima never duplicates or loses words on repeated stream snapshots',()=>{
 const chunker=new ForzaIncrementalSpeechText();
 const input='برای انتخاب تسمه مناسب لطفاً مدل دستگاه را بفرمایید. '+
  'ما مشخصات فنی را بررسی می‌کنیم.';
 let spoken:string[]=[];
 for(let index=1;index<=input.length;index++){
   spoken.push(...chunker.push(input.slice(0,index)));
 }
 spoken.push(...chunker.complete(input));
 assert.equal(spoken.join(' ').replace(/\s+/g,' ').trim(),input.trim());
});

test('Nima preserves decimals and rejects revised TTS text',()=>{
 const chunker=new ForzaIncrementalSpeechText();
 assert.deepEqual(chunker.push('قطر قطعه 3.25 میلی متر است. و '),['قطر قطعه 3.25 میلی متر است.']);
 assert.throws(()=>chunker.push('قطر قطعه 4.25 میلی متر است. و '),/stream_revised/);
});

test('Nima buffers unfinished words and flushes short final answers',()=>{
 const chunker=new ForzaIncrementalSpeechText();
 assert.deepEqual(chunker.push('سلام فورزا'),[]);
 assert.deepEqual(chunker.complete('سلام فورزا'),['سلام فورزا']);
 assert.deepEqual(chunker.complete('سلام فورزا'),[]);
});

test('first Nima phrase starts while LLM is still delivering unpunctuated Persian words',()=>{
 const stream=new ForzaIncrementalSpeechText();
 const prefix='برای انتخاب قطعه صنعتی مناسب ابتدا مدل ';
 assert.ok(prefix.length<80);
 const first=stream.push(prefix);
 assert.equal(first.length,1,'first coherent word group should be ready before 80 characters');
 assert.ok(first[0].length>=22);
 assert.equal(stream.push(prefix).length,0,'identical SSE snapshots must never repeat speech');
 const finished=prefix+'دستگاه را بفرمایید تا مشخصات مورد نیاز را بررسی کنیم.';
 const chunks=[...first,...stream.complete(finished)];
 assert.equal(chunks.join(' ').replace(/\s+/g,' ').trim(),finished.trim());
});

test('streaming Nima keeps unfinished final Persian words buffered',()=>{
 const stream=new ForzaIncrementalSpeechText();
 const incomplete='برای بررسی قطعات مورد نیاز به مدل دستگا';
 assert.ok(!stream.push(incomplete).some(part=>part.endsWith('دستگا')));
 const complete=incomplete+'ه و مشخصات دقیق آن نیاز داریم.';
 const spoken=stream.complete(complete);
 assert.ok(spoken.join(' ').includes('دستگاه'));
});

test('first short completed sentence can be spoken before the next LLM sentence arrives',()=>{
 const stream=new ForzaIncrementalSpeechText();
 const first='سلام، فورزا آماده است. ';
 assert.deepEqual(stream.push(first),['سلام، فورزا آماده است.']);
 assert.deepEqual(stream.push(first+'اکنون '),[]);
 assert.deepEqual(stream.complete(first+'اکنون مشخصات دستگاه را بفرمایید.'),
   ['اکنون مشخصات دستگاه را بفرمایید.']);
});
