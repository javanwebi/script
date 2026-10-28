// Verifies a real production failure mode: /api/ai/tts returns HTTP 503.
// Headless browser uses fake mic, fake native Persian voice and no real Gemini.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mockLocalVoice}=require('./forza-browser-voice-mock.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--no-sandbox','--autoplay-policy=no-user-gesture-required',
   '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
 ]});
 try {
   const page=await browser.newPage();
   const wave=Buffer.alloc(44+9600);
   wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);
   wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);
   wave.writeUInt32LE(24000,24);wave.writeUInt32LE(48000,28);
   wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);
   wave.write('data',36);wave.writeUInt32LE(9600,40);
   await mockLocalVoice(page,wave);
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
     const fakeSynth={
       getVoices:()=>[{name:'Mock Farsi',lang:'fa-IR',voiceURI:'fake-persian',localService:true}],
       cancel:()=>{},
       speak(utterance) {
         window.__spoken.push(utterance.text);
         queueMicrotask(()=>utterance.onstart?.());
         setTimeout(()=>utterance.onend?.(),70);
       },
     };
     Object.defineProperty(window,'speechSynthesis',{configurable:true,value:fakeSynth});
     Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{
       constructor(text){this.text=text;this.lang='';this.voice=null;}
     }});
   });
   let ttsCalls=0;
   await page.route('**/api/ai/tts',async route=>{
     ttsCalls++;
     await route.fulfill({status:503,json:{success:false,
       error:{type:'gemini_tts_unavailable',message:'Provider quota or timeout'}}});
   });
   await page.goto('http://127.0.0.1:4173/ai-forza');
   await page.waitForFunction(()=>window.__micRequests>0,{},{timeout:15000});
   await page.waitForFunction(()=>window.__forzaAmirSpoken.length>0,{},{timeout:20000});
   assert.ok((await page.evaluate(()=>window.__forzaAmirSpoken[0])).includes('به صنعت پیش خوش آمدید'));
   await page.waitForFunction(()=>document.body.innerText.includes('فورزا گوش می‌دهد'),{},{timeout:15000});
   assert.equal(await page.getByText('تلاش مجدد برای فعال‌کردن میکروفون').count(),0);
   assert.equal(await page.getByText('برای شنیدن صدای هوش مصنوعی فورزا اینجا کلیک کنید').count(),0);
   assert.equal(ttsCalls,0,'local Amir must not consume Gemini TTS API');
   assert.equal(errors.length,0,errors.join('; '));
   console.log('PASS: local Amir speaks without paid Gemini TTS, mic listening, no stuck processing.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
