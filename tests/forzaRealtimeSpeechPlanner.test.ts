import test from 'node:test';
import assert from 'node:assert/strict';
import { ForzaRealtimeSpeechPlanner } from '../src/utils/forzaRealtimeSpeechPlanner';
import { ForzaNimaBufferedSpeech } from '../src/utils/forzaNimaBufferedSpeech';

function normalized(value:string):string{return value.replace(/\s+/g,' ').trim();}
function pcm(seconds:number):Uint8Array{
  const rate=22050,bytes=Math.round(seconds*rate)*2,wav=new Uint8Array(44+bytes);
  const view=new DataView(wav.buffer);
  for(const [at,label] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']] as const)
    for(let i=0;i<label.length;i++)wav[at+i]=label.charCodeAt(i);
  view.setUint32(4,36+bytes,true);view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  view.setUint32(40,bytes,true);
  return wav;
}

test('first coherent Persian phrase is queued while LLM text is still coming',()=>{
  const text='برای انتخاب تسمه صنعتی مناسب باید قطر پولی و مشخصات دستگاه را در نظر گرفت. '+
    'سپس باید طول و گام تسمه با کاتالوگ فنی مقایسه شود.';
  const planner=new ForzaRealtimeSpeechPlanner();
  const spoken:string[]=[];
  for(let i=1;i<text.length;i++)spoken.push(...planner.push(text.slice(0,i)));
  assert.ok(spoken.length>=1,'speech must begin BEFORE the terminal SSE done');
  spoken.push(...planner.complete(text));
  assert.equal(normalized(spoken.join(' ')),normalized(text));
});

test('no punctuation type creates a forced 15-second split or drops final words',()=>{
  const text='سلام! آیا تسمه SPA-1250 موجود است؟ بله، اما ابتدا کد فنی را بفرمایید. '+
    'اگر نیاز به استعلام دارید؛ اندازه پولی را نیز اعلام کنید.';
  const planner=new ForzaRealtimeSpeechPlanner();
  const emitted:string[]=[];
  for(let i=1;i<=text.length;i++)emitted.push(...planner.push(text.slice(0,i)));
  emitted.push(...planner.complete(text));
  assert.equal(normalized(emitted.join(' ')),normalized(text));
  assert.ok(emitted[0].includes('!')&&emitted[0].includes('SPA-1250'));
  assert.ok(emitted.some(p=>p.includes('؟')&&p.includes('بله')));
  assert.ok(emitted.at(-1)?.endsWith('اعلام کنید.'));
});

test('short replies get ONE complete WAV and the pipeline rejects revisions after speech',()=>{
  const planner=new ForzaRealtimeSpeechPlanner();
  const short='سلام، چطور می‌توانم کمک کنم؟';
  assert.deepEqual(planner.push(short),[]);
  assert.deepEqual(planner.complete(short),[short]);
  assert.throws(()=>planner.push(short+' دوباره'),/after_done/);
  const other=new ForzaRealtimeSpeechPlanner();
  other.push('برای تسمه صنعتی ابتدا کد دستگاه را کامل بفرمایید. ');
  assert.throws(()=>other.push('برای بلبرینگ صنعتی ابتدا کد دستگاه را کامل بفرمایید. '),/revised_text/);
});

test('fake SSE and CPU Nima TTS run concurrently, queue audio in speaking order',async()=>{
  const words='در بخش تسمه های صنعتی انتقال قدرت توسط پولی انجام می شود و '+
    'مشخصات قطر و طول و سرعت دستگاه برای انتخاب صحیح اهمیت بالایی دارد. '+
    'کارشناس می تواند پس از دریافت کد فنی اندازه مناسب را بررسی کند.';
  const planner=new ForzaRealtimeSpeechPlanner();
  const callOrder:string[]=[];
  const played:number[]=[];
  const pipeline=new ForzaNimaBufferedSpeech({
    synthesize:async text=>{
      callOrder.push(text);
      return pcm(3);
    },
    player:{enqueueWav:async wav=>{played.push(wav.length);}},
    maximumInitialWaitMs:0,
    initialBufferSeconds:1,
    maxConcurrent:2,
  });
  let firstBeforeDone=false;
  for(let i=1;i<words.length;i++){
    for(const phrase of planner.push(words.slice(0,i)))pipeline.add(phrase);
    if(i===110){await new Promise<void>(r=>setTimeout(r,0));firstBeforeDone=callOrder.length>0;}
  }
  assert.ok(firstBeforeDone,'first TTS request must start before LLM completion');
  for(const phrase of planner.complete(words))pipeline.add(phrase);
  await pipeline.finish();
  assert.equal(normalized(callOrder.join(' ')),normalized(words));
  assert.equal(played.length,callOrder.length);
  assert.ok(played.length>=2);
});
