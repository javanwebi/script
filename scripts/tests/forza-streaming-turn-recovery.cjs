// Regression: Gemini SSE delivers text quickly but browser Piper is still
// loading 63 MB. Server same-voice Amir must play and release the turn.
// Two consecutive turns prove the status cannot remain "processing".
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

function silentWav(){
 const wave=Buffer.alloc(44+9600);
 wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);
 wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);
 wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);
 wave.writeUInt32LE(24000,24);wave.writeUInt32LE(48000,28);
 wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);
 wave.write('data',36);wave.writeUInt32LE(9600,40);
 return wave;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--no-sandbox','--autoplay-policy=no-user-gesture-required',
   '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
 ]});
 try{
  const page=await browser.newPage();
  const errors=[],synthRequests=[],sseRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/assets/piper-tts-web-*.js',route=>route.fulfill({
   status:200,contentType:'text/javascript',
   body:'export class TtsSession { constructor(){ this.waitReady=new Promise(()=>{}); } async predict(){ return new Promise(()=>{}); } }',
  }));
  await page.route('**/forza-runtime/stt/vosk.js',route=>route.fulfill({
   status:200,contentType:'application/javascript',
   body:'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};',
  }));
  await page.route('**/api/ai/amir-speech',async route=>{
   const req=route.request().postDataJSON();
   synthRequests.push(req.text);
   await route.fulfill({status:200,contentType:'audio/wav',
     headers:{'X-Forza-Voice':'piper-amir'},body:silentWav()});
  });
  await page.route('**/api/ai/consult-stream',async route=>{
   sseRequests.push(route.request().postDataJSON().query);
   const text='اطلاعات تسمه در کاتالوگ صنعت پیش قابل بررسی است.';
   const frame=msg=>'data: '+JSON.stringify(msg)+'\n\n';
   await route.fulfill({status:200,contentType:'text/event-stream',
     headers:{'cache-control':'no-cache'},
     body:frame({type:'start',responseId:'test-forza'})+
          frame({type:'text_chunk',chunk:text,textSoFar:text})+
          frame({type:'done',fullText:text})});
  });
  await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded'});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:23000});
  assert.equal(await page.getByText('در حال آماده‌سازی صدای خوشامدگویی...').count(),0);
  for (const prompt of ['تسمه SPA چیست؟','کد 6202ZZ چیست؟']){
    const opened=await page.locator('input[placeholder="سؤال فنی خود را تایپ کنید..."]').isVisible();
    if(!opened)await page.getByTitle('تایپ پیام متنی').click();
    await page.locator('input[placeholder="سؤال فنی خود را تایپ کنید..."]').fill(prompt);
    await page.getByTitle('ارسال به هوش مصنوعی').click();
    await page.waitForFunction(n=>window.document.body.innerText.includes('اطلاعات تسمه در کاتالوگ')&&
      window.document.body.innerText.includes('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید'),
      null,{timeout:16000});
    // Ensure the next turn has actually been submitted.
    assert.equal(sseRequests.at(-1),prompt);
  }
  assert.equal(sseRequests.length,2);
  assert.ok(synthRequests.length>=2,'same-origin Amir speech should be requested while browser Piper is pending');
  assert.equal(errors.length,0,errors.join('; '));
  console.log('PASS: consecutive streaming turns recover in <=16s with same-voice Piper Amir and no processing lock');
 }finally{await browser.close();}
})().catch(error=>{console.error('FORZA STREAMING TURN FAIL',error);process.exitCode=1});
