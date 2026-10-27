// Verifies a real Pocket-only failure mode: /api/ai/tts returns HTTP 503.
// The page must NOT fall back to browser speech and must NOT pretend the
// greeting finished or start transcription without audible introduction.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--no-sandbox','--autoplay-policy=no-user-gesture-required',
   '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
 ]});
 try {
   const page=await browser.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.addInitScript(()=>{
     window.__spoken=[];
     window.__micRequests=0;
     const original=navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
     if(original) navigator.mediaDevices.getUserMedia=async(...args)=>{
       window.__micRequests++;
       return original(...args);
     };
     // Any call to native browser speech is a contract violation.
     window.__nativeSpeechUsed=false;
     Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
       getVoices:()=>[{name:'Mock Farsi',lang:'fa-IR'}],
       cancel:()=>{},
       speak:()=>{window.__nativeSpeechUsed=true;},
     }});
     Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{}});
   });
   let ttsCalls=0;
   await page.route('**/api/ai/tts',async route=>{
     ttsCalls++;
     await route.fulfill({status:503,json:{success:false,
       error:{type:'pocket_tts_unavailable',message:'Pocket not configured'}}});
   });
   await page.goto('http://127.0.0.1:4173/ai-forza');
   await page.waitForFunction(()=>window.__micRequests>0,{},{timeout:15000});
   await page.getByText('موتور صوتی FORZA در دسترس نیست. خوشامدگویی پخش نشد و مکالمه آغاز نشده است.').waitFor({timeout:20000});
   assert.equal(await page.evaluate(()=>window.__nativeSpeechUsed),false);
   assert.equal(await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').count(),0);
   assert.equal(await page.getByText('تلاش مجدد برای فعال‌کردن میکروفون').count(),0);
   assert.equal(await page.getByText('برای شنیدن صدای هوش مصنوعی فورزا اینجا کلیک کنید').count(),0);
   assert.ok(ttsCalls>=1);
   assert.equal(errors.length,0,errors.join('; '));
   console.log('PASS 503 TTS outage: no browser/Gemini fallback; explicit unavailable state; no false live listening.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
