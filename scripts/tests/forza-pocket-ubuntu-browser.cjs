// Headless browser regression for the private Ubuntu Pocket speech architecture.
// Intercept only the HTTP boundary: real browser speechSynthesis must NOT be used.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
function wav(durationMs=180){
 const samples=Math.floor(24000*durationMs/1000);
 const bytes=samples*2,b=Buffer.alloc(44+bytes);
 b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
 b.write('data',36);b.writeUInt32LE(bytes,40);return b;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
  '--use-gl=angle','--use-angle=swiftshader',
 ]});
 try{
  const page=await browser.newPage({permissions:['microphone'],viewport:{width:1100,height:780}});
  const errors=[],voiceCalls=[],streamCalls=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__speechSynthesisCalls=0;
    window.speechSynthesis?.cancel?.();
    // The app must not rely on installed client TTS voices for reply output.
  });
  await page.route('**/api/runtime',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({success:true,database:true,products:[],values:{},versions:{},userId:null})}));
  await page.route('**/api/portal',route=>route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"user":null}'}));
  await page.route('**/forza-greeting-bootstrap.wav',route=>route.fulfill({status:200,contentType:'audio/wav',body:wav()}));
  await page.route('**/api/ai/consult-stream',route=>{
    streamCalls.push(route.request().postDataJSON().query);
    const answer='سلام، مشخصات تسمه را بررسی می‌کنم. لطفاً کد نوشته‌شده روی قطعه را اعلام کنید تا اطلاعات فنی آن را در کاتالوگ پیدا کنم.';
    const frames=[
      {type:'start',responseId:'browser-test'},
      {type:'text_chunk',chunk:answer,textSoFar:answer},
      {type:'done',fullText:answer},
    ];
    return route.fulfill({status:200,contentType:'text/event-stream',
      headers:{'Cache-Control':'no-cache'},body:frames.map(f=>'data: '+JSON.stringify(f)+'\n\n').join('')});
  });
  await page.route('**/api/ai/forza-speech',route=>{
    const {text}=route.request().postDataJSON();
    voiceCalls.push(text);
    return route.fulfill({status:200,contentType:'audio/wav',headers:{'X-Forza-Voice':'pocket-farsi-v2'},body:wav()});
  });
  await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:30000});
  await page.getByTitle('تایپ پیام متنی').click();
  await page.getByPlaceholder('سؤال فنی خود را تایپ کنید...').fill('تسمه SPA چیست؟');
  await page.getByTitle('ارسال به هوش مصنوعی').click();
  await page.waitForFunction(()=>document.body.innerText.includes('کد نوشته‌شده روی قطعه'),null,{timeout:12000});
  await page.waitForFunction(()=>document.body.innerText.includes('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید'),null,{timeout:30000});
  assert.deepEqual(streamCalls,['تسمه SPA چیست؟']);
  assert.equal(voiceCalls.length,1,'Pocket must receive exactly one full assistant answer');
  assert.equal(voiceCalls[0],
    'سلام، مشخصات تسمه را بررسی می‌کنم. لطفاً کد نوشته‌شده روی قطعه را اعلام کنید تا اطلاعات فنی آن را در کاتالوگ پیدا کنم.');
  assert.ok(voiceCalls[0].length<=1000);
  assert.equal(errors.length,0,errors.join('; '));
  console.log('FORZA_PRIVATE_POCKET_BROWSER_PASS complete_wav_requests='+voiceCalls.length+' bytes_model_downloaded=0');
 } finally{await browser.close();}
})().catch(e=>{console.error('FORZA_PRIVATE_POCKET_BROWSER_FAIL',e);process.exitCode=1;});
