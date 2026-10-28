// Regression: Gemini SSE finishes immediately but Piper Amir spends seconds
// synthesizing the first sentence. Text and progress must appear without
// awaiting TTS and the assistant must eventually unlock the next turn.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
function wav(){
 const b=Buffer.alloc(44+4800);b.write('RIFF');b.writeUInt32LE(b.length-8,4);
 b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);
 b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(4800,40);return b;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
 ]});
 try{
  const page=await browser.newPage();
  const errors=[];
  let speechCalls=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/assets/piper-tts-web-*.js',r=>r.fulfill({
   status:200,contentType:'text/javascript',
   body:'export class TtsSession { constructor(){ this.waitReady=new Promise(()=>{}); } async predict(){ return new Promise(()=>{}); } }',
  }));
  await page.route('**/forza-runtime/stt/vosk.js',r=>r.fulfill({
   status:200,contentType:'application/javascript',
   body:'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};',
  }));
  await page.route('**/api/ai/consult-stream',r=>{
   const answer='سلام، درخواست شما دریافت شد. کد تسمه را بفرمایید تا مشخصات فنی آن بررسی شود.';
   const frames=[{type:'start'},{type:'text_chunk',chunk:answer,textSoFar:answer},{type:'done',fullText:answer}];
   return r.fulfill({status:200,contentType:'text/event-stream',
    body:frames.map(v=>'data: '+JSON.stringify(v)+'\n\n').join('')});
  });
  await page.route('**/api/ai/amir-speech',async r=>{
   speechCalls++;
   await new Promise(resolve=>setTimeout(resolve,4000));
   await r.fulfill({status:200,contentType:'audio/wav',
    headers:{'X-Forza-Voice':'piper-amir'},body:wav()}).catch(()=>{});
  });
  await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded'});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:25000});
  await page.getByTitle('تایپ پیام متنی').click();
  await page.getByPlaceholder('سؤال فنی خود را تایپ کنید...').fill('تسمه SPA چیست؟');
  const requested=page.waitForRequest(req=>req.url().includes('/api/ai/consult-stream'),{timeout:10000});
  await page.getByTitle('ارسال به هوش مصنوعی').click();
  await requested;
  const start=Date.now();
  await page.waitForFunction(()=>document.body.innerText.includes('کد تسمه را بفرمایید'),{}, {timeout:2000});
  assert.ok(Date.now()-start<2000,'Gemini answer text must appear independently of slow TTS');
  assert.equal(await page.getByText('AI FORZA در حال دریافت پاسخ...').count(),0,
   'Receiving-response status must clear when SSE text has arrived');
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:23000});
  assert.ok(speechCalls>=1);
  assert.deepEqual(errors,[]);
  console.log('PASS: immediate visible AI text while local Amir speech is delayed for 4 seconds');
 } finally {await browser.close();}
})().catch(e=>{console.error('FORZA RESPONSE FIRST TEST FAIL',e);process.exitCode=1;});
