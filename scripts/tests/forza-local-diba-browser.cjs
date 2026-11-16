// Browser regression: local Diba/Vosk emits live Persian partials and
// continues through two consecutive voice turns without depending on Chrome ASR.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

function wav(){
 const samples=4800,b=Buffer.alloc(44+samples*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);
 b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);
 b.writeUInt32LE(samples*2,40);return b;
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--autoplay-policy=no-user-gesture-required',
  '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
  '--use-gl=angle','--use-angle=swiftshader'
 ]});
 try{
  const page=await browser.newPage({permissions:['microphone'],viewport:{width:1180,height:750}});
  const errors=[],queries=[],speech=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:8});
   Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
   window.__forzaMicSample=0.0005;
   Object.defineProperty(AudioContext.prototype,'audioWorklet',{get:()=>undefined});
   const analyser=window.AnalyserNode?.prototype;
   if(analyser?.getFloatTimeDomainData)
    analyser.getFloatTimeDomainData=function(samples){samples.fill(window.__forzaMicSample);};
   class FakeBrowserRecognition{
    start(){window.__forzaBrowserStarts=(window.__forzaBrowserStarts||0)+1;this.onstart?.();}
    stop(){this.onend?.();}
    abort(){this.onend?.();}
   }
   window.SpeechRecognition=window.webkitSpeechRecognition=FakeBrowserRecognition;
  });
  await page.route('**/forza-runtime/stt/vosk.js',route=>route.fulfill({
   status:200,contentType:'application/javascript',
   body:`window.Vosk={createModel:async url=>{
    window.__forzaDibaModelUrl=url;
    return {KaldiRecognizer:class{
     constructor(rate){this.rate=rate;this.handlers={};window.__forzaVoskRecognizer=this;
      window.__forzaVoskCreated=(window.__forzaVoskCreated||0)+1;}
     on(name,handler){this.handlers[name]=handler;}
     acceptWaveform(){window.__forzaVoskFrames=(window.__forzaVoskFrames||0)+1;}
     emitPartial(text){this.handlers.partialresult?.({result:{partial:text}});}
     emitFinal(text){this.handlers.result?.({result:{text}});}
     remove(){this.removed=true;}
    }};
   }};`,
  }));
  await page.route('**/api/runtime',route=>route.fulfill({json:{
   success:true,database:true,products:[],values:{},versions:{},userId:null
  }}));
  await page.route('**/api/portal',route=>route.fulfill({json:{success:true,user:null}}));
  await page.route('**/api/ai/forza-stt-info',route=>route.fulfill({json:{
   serverSttConfigured:true,serverSttProvider:'diba',serverSttReady:true
  }}));
  await page.route('**/api/ai/forza-voice-info',route=>route.fulfill({json:{
   voice:'piper-nima-gyro-medium',incrementalSpeech:true
  }}));
  await page.route('**/forza-greeting-bootstrap.wav',route=>route.fulfill({
   status:200,contentType:'audio/wav',body:wav()
  }));
  await page.route('**/api/ai/forza-speech',async route=>{
   speech.push(route.request().postDataJSON()?.text||'');
   await route.fulfill({status:200,contentType:'audio/wav',
    headers:{'X-Forza-Voice':'piper-nima-gyro-medium'},body:wav()});
  });
  await page.route('**/api/ai/consult-stream',async route=>{
   const query=route.request().postDataJSON().query;queries.push(query);
   await page.evaluate(count=>{window.__forzaConsultRequestCount=count;},queries.length).catch(()=>{});
   const answer='برای انتخاب تسمه مناسب، کد فنی و ابعاد قطعه را بررسی می‌کنیم.';
   const frame=value=>'data: '+JSON.stringify(value)+'\\n\\n';
   await route.fulfill({status:200,contentType:'text/event-stream',
    headers:{'cache-control':'no-cache'},
    body:frame({type:'start',responseId:'local-diba-'+queries.length})+
         frame({type:'text_chunk',chunk:answer,textSoFar:answer})+
         frame({type:'done',fullText:answer})});
  });

  await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:25000});
  await page.waitForFunction(()=>!!window.__forzaVoskRecognizer,null,{timeout:15000});
  await page.waitForFunction(()=>window.__forzaVoskFrames>0,null,{timeout:5000});
  assert.equal(await page.evaluate(()=>window.__forzaDibaModelUrl),
   '/forza-runtime/stt/diba-stt-fa-small.tar.gz','model must load from the same origin');
  await page.waitForTimeout(450);
  await page.evaluate(()=>{window.__forzaMicSample=0.003;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitPartial('می خواهم مشخصات تسمه تایمینگ را بدانم'));
  await page.getByText('می خواهم مشخصات تسمه تایمینگ را بدانم',{exact:true}).waitFor({timeout:1500});
  assert.ok(await page.evaluate(()=>window.__forzaVoskFrames||0)>0,'local recognizer must receive live PCM frames');
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitFinal('تسمه تایمینگ چیست؟'));
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  await page.waitForFunction(()=>window.__forzaVoskCreated>=2,null,{timeout:10000});
  await page.waitForFunction(()=>window.document.body.innerText.includes('برای انتخاب تسمه مناسب'),null,{timeout:12000});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:12000});
  assert.equal(queries.length,1,'first local Diba turn must be submitted exactly once');

  await page.waitForFunction(()=>window.__forzaVoskCreated>=3,null,{timeout:8000});
  await page.evaluate(()=>{window.__forzaMicSample=0.003;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitPartial('برای دستگاه بسته بندی تسمه PU می خواهم'));
  await page.getByText('برای دستگاه بسته بندی تسمه PU می خواهم',{exact:true}).waitFor({timeout:1500});
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitFinal('برای دستگاه بسته بندی تسمه PU می خواهم'));
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  await page.waitForFunction(()=>window.__forzaConsultRequestCount===2,null,{timeout:12000});
  assert.equal(queries.length,2,'second local Diba turn must also reach the AI');
  assert.ok(queries[0].includes('تسمه تایمینگ'));
  assert.ok(queries[1].includes('تسمه PU'));
  assert.equal(errors.length,0,errors.join('; '));
  console.log('PASS: same-origin local Diba streams Persian partials and recovers across two voice turns');
 }finally{await browser.close();}
})().catch(error=>{console.error('FORZA LOCAL DIBA BROWSER FAIL',error);process.exitCode=1;});
