// Browser-level contract: Persian interim words appear in the customer bubble
// BEFORE end of speech and WITHOUT waiting for the server transcription route.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
function wav(){
 const samples=4800,b=Buffer.alloc(44+samples*2);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(samples*2,40);return b;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
  '--use-gl=angle','--use-angle=swiftshader'
 ]});
 try{
  const page=await browser.newPage({permissions:['microphone'],viewport:{width:1180,height:750}});
  const errors=[];
  let serverTranscriptions=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    class FakePersianRecognition{
      start(){window.__forzaMockRecognition=this;this.onstart?.();}
      stop(){this.onend?.();}
      abort(){this.onend?.();}
    }
    window.SpeechRecognition=FakePersianRecognition;
    window.webkitSpeechRecognition=FakePersianRecognition;
  });
  await page.route('**/api/runtime',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,database:true,products:[],values:{},versions:{},userId:null})}));
  await page.route('**/api/portal',r=>r.fulfill({status:200,contentType:'application/json',body:'{"success":true,"user":null}'}));
  await page.route('**/forza-greeting-bootstrap.wav',r=>r.fulfill({status:200,contentType:'audio/wav',body:wav()}));
  await page.route('**/api/ai/forza-live',r=>{serverTranscriptions++;return r.fulfill({status:503,body:'{}'});});
  await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:25000});
  await page.waitForFunction(()=>!!window.__forzaMockRecognition,null,{timeout:6000});
  const started=Date.now();
  await page.evaluate(()=>{
    const rec=window.__forzaMockRecognition;
    rec.onresult({resultIndex:0,results:[
      Object.assign([{transcript:'می خواهم مشخصات تسمه صنعتی را'}],{isFinal:false}),
    ]});
  });
  await page.getByText('می خواهم مشخصات تسمه صنعتی را',{exact:false}).waitFor({timeout:950});
  assert.ok(Date.now()-started<1000,'interim words must be visible immediately');
  assert.equal(serverTranscriptions,0,'the live transcript must not wait for an uploaded WAV');
  assert.equal((await page.locator('body').innerText()).includes('در حال تبدیل صدای شما به متن و ارسال به سرور'),false);
  assert.deepEqual(errors,[]);
  console.log('FORZA_LIVE_STT_BROWSER_PASS partial_appeared_ms='+(Date.now()-started));
 }finally{await browser.close();}
})().catch(e=>{console.error('FORZA_LIVE_STT_BROWSER_FAIL',e);process.exitCode=1;});
