// Regression: Gemini SSE must deliver text while selected private Nima synthesizes
// complete ordered phrases; two consecutive turns must always release the lock.
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
const documentText=value=>String(value||'').replace(/\\s+/g,' ').slice(-1800);
  const fullAnswer='برای بررسی تسمه مورد نظر، ابتدا کد فنی آن را اعلام کنید. سپس می‌توانیم ابعاد، جنس و استاندارد تسمه را با اطلاعات کاتالوگ صنعت پیش مقایسه کنیم. در صورت نامشخص بودن کد، تصویر واضحی از قطعه بفرستید.';
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/forza-greeting-bootstrap.wav',route=>route.fulfill({status:200,contentType:'audio/wav',body:silentWav()}));
  await page.route('**/assets/piper-tts-web-*.js',route=>route.fulfill({
   status:200,contentType:'text/javascript',
   body:'export class TtsSession { constructor(){ this.waitReady=new Promise(()=>{}); } async predict(){ return new Promise(()=>{}); } }',
  }));
  await page.route('**/forza-runtime/stt/vosk.js',route=>route.fulfill({
   status:200,contentType:'application/javascript',
   body:'window.Vosk={createModel:async()=>({KaldiRecognizer:class{on(){} acceptWaveform(){} remove(){}}})};',
  }));
  await page.route('**/api/ai/forza-voice-info',route=>route.fulfill({
    json:{voice:'piper-nima-gyro-medium',incrementalSpeech:true}
  }));
  await page.route('**/api/ai/forza-speech',async route=>{
   const req=route.request().postDataJSON();
   synthRequests.push(req.text);
   await route.fulfill({status:200,contentType:'audio/wav',
     headers:{'X-Forza-Voice':'piper-nima-gyro-medium'},body:silentWav()});
  });
  await page.route('**/api/ai/consult-stream',async route=>{
   sseRequests.push(route.request().postDataJSON().query);
   const text=fullAnswer;
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
  let totalNimaPhrases=0;
  for (const prompt of ['تسمه SPA چیست؟','کد 6202ZZ چیست؟']){
    const start=synthRequests.length;
    const opened=await page.locator('input[placeholder="سؤال فنی خود را تایپ کنید..."]').isVisible();
    if(!opened)await page.getByTitle('تایپ پیام متنی').click();
    await page.locator('input[placeholder="سؤال فنی خود را تایپ کنید..."]').fill(prompt);
    const requested=page.waitForRequest(request=>{
      if(!request.url().includes('/api/ai/consult-stream'))return false;
      try{return request.postDataJSON().query===prompt;}catch{return false;}
    },{timeout:12000});
    await page.getByTitle('ارسال به هوش مصنوعی').click();
    await requested;
    try{
      await page.waitForFunction(()=>window.document.body.innerText.includes('در صورت نامشخص بودن کد'),
        null,{timeout:10000});
    }catch(error){
      console.error('[FORZA_SMOKE_DIAG] answer_not_visible',JSON.stringify({
        body:documentText(await page.locator('body').innerText()),
        sseRequests,synthRequests,errors
      }));
      throw error;
    }
    try{
      await page.waitForFunction(()=>window.document.body.innerText.includes('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید'),
        null,{timeout:10000});
    }catch(error){
      console.error('[FORZA_SMOKE_DIAG] listening_not_restored',JSON.stringify({
        body:documentText(await page.locator('body').innerText()),
        sseRequests,synthRequests,errors
      }));
      throw error;
    }
    // Ensure the next turn has actually been submitted.
    assert.equal(sseRequests.at(-1),prompt);
    const turnPhrases=synthRequests.slice(start);
    assert.ok(turnPhrases.length>0,'each turn must synthesize private Nima WAV');
    assert.equal(turnPhrases.join(' '),fullAnswer,'Nima must receive exactly the complete ordered reply');
    totalNimaPhrases+=turnPhrases.length;
  }
  assert.equal(sseRequests.length,2);
  assert.ok(totalNimaPhrases>=2,'both turns must synthesize audio');
  assert.equal(errors.length,0,errors.join('; '));
  console.log('PASS: consecutive private Nima SSE turns recover and preserve complete ordered speech');
 }finally{await browser.close();}
})().catch(error=>{console.error('FORZA STREAMING TURN FAIL',error);process.exitCode=1});
