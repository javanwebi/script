// Integration of synthetic microphone energy + mocked recognition with actual
// UI/player cancellation. This is not an acoustic accuracy/diarization test.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
function wav(seconds){
 const count=Math.round(24000*seconds),b=Buffer.alloc(44+count*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(count*2,40);return b;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 let diagnostics=[];
 try{
  const page=await browser.newPage({permissions:['microphone']});const errors=[],queries=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.text().includes('[FORZA_'))diagnostics.push(m.text());});
  await page.addInitScript(()=>{
   window.__results=[];
   AudioContext.prototype.createMediaStreamSource=function(){
    const osc=this.createOscillator(),gain=this.createGain();
    osc.frequency.value=220;gain.gain.value=0.001;
    osc.connect(gain);osc.start();window.__inputGain=gain;
    return gain;
   };
   class Rec{start(){window.__recognition=this;this.onstart?.();}abort(){this.onend?.();}stop(){this.onend?.();}}
   window.SpeechRecognition=window.webkitSpeechRecognition=Rec;
   window.__emit=text=>{
    window.__results.push(Object.assign([{transcript:text}],{isFinal:true}));
    window.__recognition.onresult({resultIndex:window.__results.length-1,results:window.__results});
   };
  });
  await page.route('**/api/runtime',r=>r.fulfill({json:{success:true,database:true,products:[],values:{},versions:{}}}));
  await page.route('**/api/portal',r=>r.fulfill({json:{success:true,user:null}}));
  await page.route('**/huggingface.co/Dibachain/**',r=>r.abort());
  await page.route('**/forza-greeting-bootstrap.wav',r=>r.fulfill({contentType:'audio/wav',body:wav(0.2)}));
  await page.route('**/api/ai/forza-stt-info',r=>r.fulfill({json:{serverSttConfigured:false,serverSttReady:false}}));
  await page.route('**/api/ai/forza-voice-info',r=>r.fulfill({json:{voice:'piper-nima-gyro-medium',incrementalSpeech:true}}));
  await page.route('**/api/ai/forza-speech',r=>r.fulfill({contentType:'audio/wav',headers:{'X-Forza-Voice':'piper-nima-gyro-medium'},body:wav(r.request().postDataJSON().text==='بله، بفرما.'?0.2:queries.length>1?0.3:12)}));
  await page.route('**/api/ai/consult-stream',r=>{
   queries.push(r.request().postDataJSON().query);
   const text='برای انتخاب قطعه مناسب لطفاً مشخصات دستگاه را توضیح دهید.';
   const frame=v=>'data: '+JSON.stringify(v)+'\n\n';
   return r.fulfill({contentType:'text/event-stream',body:frame({type:'start'})+frame({type:'text_chunk',chunk:text,textSoFar:text})+frame({type:'done',fullText:text})});
  });
  await page.goto('http://127.0.0.1:4173/ai-forza?forzaVoiceDiagnostics=1',{waitUntil:'domcontentloaded'});
  const listening=page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید');
  await listening.waitFor({timeout:25000});await page.waitForFunction(()=>!!window.__recognition);
  await page.waitForTimeout(500);
  await page.evaluate(()=>window.__emit('گفتگوی افراد دور غرفه'));
  assert.equal(await page.getByText('گفتگوی افراد دور غرفه',{exact:true}).count(),0);
  assert.equal(queries.length,0);
  await page.getByTitle('تایپ پیام متنی').click();
  await page.locator('input[placeholder="سؤال فنی خود را تایپ کنید..."]').fill('بلبرینگ مناسب دستگاه چیست؟');
  await page.getByTitle('ارسال به هوش مصنوعی').click();
  const speaking=page.getByText('AI FORZA در حال صحبت...',{exact:true});
  await speaking.waitFor({timeout:15000});await page.waitForTimeout(1100);
  await page.evaluate(()=>{window.__inputGain.gain.value=0.005;window.__emit('وایسا');});
  await page.waitForTimeout(400);assert.equal(await speaking.isVisible(),true,'distant stop must not cancel playback');
  await page.evaluate(()=>window.__emit('گفتگوی نامرتبط اطراف'));
  await page.waitForTimeout(250);assert.equal(await speaking.isVisible(),true,'background sentence must not cancel playback');
  assert.equal(await page.getByText('گفتگوی نامرتبط اطراف',{exact:true}).count(),0);
  await page.evaluate(()=>{window.__inputGain.gain.value=0.009;});await page.waitForTimeout(400);
  await page.evaluate(()=>{window.__emit('وایسا');window.__inputGain.gain.value=0.001;});
  try{await listening.waitFor({timeout:1500});}catch(error){
   console.error('EXHIBITION_DIAGNOSTICS',JSON.stringify({body:(await page.locator('body').innerText()).slice(-1800),diagnostics}));throw error;
  }
  assert.ok(diagnostics.some(v=>v.includes('phase=customer-interrupt')),'close stop must cancel the active turn');
  assert.equal(queries.length,1,'a stop must not make an LLM request');
  await page.evaluate(()=>{window.__inputGain.gain.value=0.001;});
  for(const query of ['بلبرینگ شش هزار و دویست و سه دارید','تسمه برای دستگاه بسته بندی می خواهم']){
   await page.waitForTimeout(1800);
   await page.evaluate(()=>{window.__inputGain.gain.value=0.02;});
   await page.waitForTimeout(400);
   await page.evaluate(text=>{window.__emit(text);window.__inputGain.gain.value=0.001;},query);
   await page.waitForFunction(text=>document.body.innerText.includes(text),query);
   const expected=queries.length+1;
   await page.waitForFunction(()=>document.body.innerText.includes('AI FORZA در حال صحبت...'),null,{timeout:20000});
   await listening.waitFor({timeout:20000});
   assert.equal(queries.at(-1),query,'next turn must not contain prior words or AI echo');
   assert.equal(await page.getByText('تشخیص گفتار سرور موقتاً در دسترس نیست',{exact:false}).count(),0);
  }
  assert.equal(queries.length,3,'three independent requests across interruption and resumed turns');
  assert.deepEqual(errors,[]);
  console.log('FORZA_EXHIBITION_PASS distant_text_hidden=1 distant_stop_ignored=1 close_stop_cancels=1 cumulative_background_retired=1');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
