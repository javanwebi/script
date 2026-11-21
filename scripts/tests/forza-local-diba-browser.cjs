// Browser regression: local Diba/Vosk emits live Persian partials and
// continues through two consecutive voice turns without depending on Chrome ASR.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

function wav(seconds=0.2){
 const samples=Math.round(24000*seconds),b=Buffer.alloc(44+samples*2);
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
  const errors=[],queries=[],requests=[],speech=[],speechTurnIds=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:8});
   Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:8});
   let micLevel=0.0005,micGain=null;
   Object.defineProperty(window,'__forzaMicSample',{
    configurable:true,get:()=>micLevel,set:value=>{micLevel=Number(value)||0;if(micGain)micGain.gain.value=micLevel;}
   });
   // Synthetic near-field voice: voiced harmonics plus articulation energy above 2kHz.
   AudioContext.prototype.createMediaStreamSource=function(){
    const low=this.createOscillator(),high=this.createOscillator(),gain=this.createGain();
    const lowGain=this.createGain(),highGain=this.createGain();
    low.frequency.value=140;high.frequency.value=2500;
    lowGain.gain.value=0.75;highGain.gain.value=0.25;
    low.connect(lowGain);high.connect(highGain);lowGain.connect(gain);highGain.connect(gain);
    low.start();high.start();gain.gain.value=micLevel;micGain=gain;window.__forzaMicGain=gain;
    return gain;
   };
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
      window.__forzaDibaRecognizerSampleRate=rate;
      window.__forzaVoskCreated=(window.__forzaVoskCreated||0)+1;}
     on(name,handler){this.handlers[name]=handler;}
     acceptWaveform(samples){
      window.__forzaVoskFrames=(window.__forzaVoskFrames||0)+1;
      window.__forzaDibaBufferSampleRate=samples.sampleRate;
      window.__forzaDibaBufferLength=samples.length;
      const data=samples.getChannelData(0);
      let energy=0;for(const value of data)energy+=value*value;
      const rms=Math.sqrt(energy/Math.max(1,data.length));
      if(rms>0.0005)window.__forzaVoskNonZeroFrames=(window.__forzaVoskNonZeroFrames||0)+1;
      window.__forzaVoskLastRms=rms;
     }
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
   const body=route.request().postDataJSON()||{};
   speech.push(body.text||'');
   speechTurnIds.push(String(body.turnId||''));
   await page.evaluate(turns=>{window.__forzaSpeechTurnIds=turns;},speechTurnIds).catch(()=>{});
   await page.evaluate(count=>{window.__forzaSpeechRequests=count;},speech.length).catch(()=>{});
   await route.fulfill({status:200,contentType:'audio/wav',
    headers:{'X-Forza-Voice':'piper-nima-gyro-medium'},body:wav(5)});
  });
  await page.route('**/api/ai/consult-stream',async route=>{
   const request=route.request().postDataJSON();
   const query=request.query;queries.push(query);requests.push(request);
   await page.evaluate(count=>{window.__forzaConsultRequestCount=count;},queries.length).catch(()=>{});
   const answer='برای انتخاب تسمه مناسب، کد فنی و ابعاد قطعه را بررسی می‌کنیم.';
   const frame=value=>'data: '+JSON.stringify(value)+'\n\n';
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
  assert.equal(await page.evaluate(()=>window.__forzaDibaRecognizerSampleRate),16000,
   'the Vosk decoder must be configured for the Persian model sample rate');
  assert.equal(await page.evaluate(()=>window.__forzaDibaBufferSampleRate),16000,
   'microphone PCM must be resampled before it reaches Vosk');
  assert.ok(await page.evaluate(()=>window.__forzaDibaBufferLength>0));
  assert.ok(await page.evaluate(()=>window.__forzaVoskNonZeroFrames||0)>farFrames,
   'only foreground-gated PCM reaches local Diba');
  assert.equal(await page.evaluate(()=>window.__forzaBrowserStarts||0),0,
   'native direct-microphone SpeechRecognition must never bypass the gate');
  assert.equal(await page.evaluate(()=>window.__forzaDibaModelUrl),
   '/forza-runtime/stt/diba-stt-fa-small-c244182d.tar.gz','model must load from the same origin');
  await page.waitForTimeout(450);
  // Distant/background speech exists at the mic, but must be zeroed before STT.
  await page.evaluate(()=>{window.__forzaMicSample=0.001;});
  await page.waitForTimeout(500);
  const farFrames=await page.evaluate(()=>window.__forzaVoskNonZeroFrames||0);
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitPartial('گفتگوی افراد دور غرفه'));
  await page.waitForTimeout(250);
  assert.equal(await page.getByText('گفتگوی افراد دور غرفه',{exact:true}).count(),0,
   'distant speech must not become STT text');
  assert.equal(await page.evaluate(()=>window.__forzaVoskNonZeroFrames||0),farFrames,
   'distant PCM must not reach the STT recognizer');
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitFinal(''));
  await page.evaluate(()=>{window.__forzaMicSample=0.008;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitPartial('می خواهم مشخصات تسمه تایمینگ را بدانم'));
  await page.getByText('می خواهم مشخصات تسمه تایمینگ را بدانم',{exact:true}).waitFor({timeout:1500});
  assert.ok(await page.evaluate(()=>window.__forzaVoskFrames||0)>0,'local recognizer must receive live PCM frames');
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitFinal('تسمه تایمینگ چیست؟'));
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  await page.waitForFunction(()=>window.__forzaVoskCreated===1,null,{timeout:10000});
  assert.equal(await page.evaluate(()=>window.__forzaVoskCreated),1,
   'the local recognizer must stay alive after the first assistant reply');
  await page.waitForFunction(()=>window.document.body.innerText.includes('برای انتخاب تسمه مناسب'),null,{timeout:12000});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:12000});
  await page.waitForFunction(()=>window.__forzaSpeechTurnIds?.some(id=>id.endsWith('-turn-1')),null,{timeout:8000});
  const speechAfterFirst=speech.length;
  assert.ok(speechAfterFirst>=1,'first assistant turn must synthesize Nima audio');
  assert.equal(queries.length,1,'first local Diba turn must be submitted exactly once');

  await page.waitForFunction(()=>window.__forzaVoskCreated===1,null,{timeout:8000});
  assert.equal(await page.evaluate(()=>window.__forzaVoskCreated),1,
   'the same local recognizer must survive the second voice turn too');
  await page.evaluate(()=>{window.__forzaMicSample=0.008;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitPartial('برای دستگاه بسته بندی تسمه PU می خواهم'));
  await page.waitForFunction(text=>document.body.innerText.includes(text),'برای دستگاه بسته بندی تسمه PU می خواهم',{timeout:1500});
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitFinal('برای دستگاه بسته بندی تسمه PU می خواهم'));
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  await page.waitForFunction(()=>window.__forzaConsultRequestCount===2,null,{timeout:12000});
  assert.equal(queries.length,2,'second local Diba turn must also reach the AI');
  await page.waitForFunction(([first,second])=>document.body.innerText.includes(first)&&document.body.innerText.includes(second),[queries[0],'برای دستگاه بسته بندی تسمه PU می خواهم'],{timeout:3000});
  assert.ok(true,'the first customer transcript remains visible after a later turn');
  await page.waitForFunction(()=>window.__forzaSpeechTurnIds?.some(id=>id.endsWith('-turn-2')),null,{timeout:8000});
  const speechAfterSecond=speech.length;
  assert.ok(speechAfterSecond>speechAfterFirst,'Nima must synthesize audio on the second assistant turn too');
  assert.ok(queries[0].includes('تسمه تایمینگ'));
  assert.ok(queries[1].includes('تسمه PU'));
  const firstTurnInSecondHistory=requests[1].history.filter(item=>
   item.role==='user'&&item.text===queries[0]);
  assert.equal(firstTurnInSecondHistory.length,1,
   'the previous customer turn must appear exactly once in the next model context');
  assert.equal(requests[1].history.some(item=>
   item.role==='user'&&item.text===queries[1]),false,
   'the current customer turn must be sent separately, never duplicated in history');
  assert.ok(requests[1].history.some(item=>
   item.role==='model'&&item.text.includes('برای انتخاب تسمه مناسب')),
   'the next turn must retain the assistant answer the customer actually heard');

  // Barge in while the second Nima WAV is still playing. The same Diba
  // recognizer must interrupt that playback and submit the customer's new turn.
  await page.waitForFunction(()=>window.__forzaSpeechRequests>=2,null,{timeout:8000});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{window.__forzaMicSample=0.008;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitPartial('یه سوال جدید درباره تسمه نقاله دارم'));
  await page.waitForFunction(text=>document.body.innerText.includes(text),'یه سوال جدید درباره تسمه نقاله دارم',{timeout:1500});
  await page.evaluate(()=>window.__forzaVoskRecognizer.emitFinal('یه سوال جدید درباره تسمه نقاله دارم'));
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  await page.waitForFunction(()=>window.__forzaConsultRequestCount===3,null,{timeout:12000});
  await page.waitForFunction(()=>window.__forzaSpeechTurnIds?.some(id=>id.endsWith('-turn-3')),null,{timeout:8000});
  assert.equal(queries.length,3,'customer speech during Nima playback must interrupt and start a new turn');
  await page.waitForFunction(([first,second,third])=>{
    const text=document.body.innerText;
    return text.includes(first)&&text.includes(second)&&text.includes(third);
  },[queries[0],queries[1],'یه سوال جدید درباره تسمه نقاله دارم'],{timeout:3000});
  assert.ok(speech.length>speechAfterSecond,'Nima must synthesize the barge-in response too');
  assert.equal(await page.evaluate(()=>window.__forzaVoskCreated),1,
   'barge-in must reuse the same Diba recognizer instead of discarding its state');
  assert.equal(errors.length,0,errors.join('; '));
  console.log('PASS: local Diba accumulates multiple turns, Nima speaks each reply, and barge-in interrupts playback');
 }finally{await browser.close();}
})().catch(error=>{console.error('FORZA LOCAL DIBA BROWSER FAIL',error);process.exitCode=1;});
