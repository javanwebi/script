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
  let consultRequests=0;
  let externalModelDownloads=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    // Keep this suite on the browser-native fallback path. The separate local
    // Diba suite exercises the on-device Vosk engine on capable hardware.
    Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,value:2});
    Object.defineProperty(navigator,'deviceMemory',{configurable:true,value:2});
    // Calibrate room silence, then model a nearby speaker explicitly.
    window.__forzaMicSample=0.0005;
    // Exercise the older-browser analyser fallback independently of the worklet test.
    Object.defineProperty(AudioContext.prototype,'audioWorklet',{get:()=>undefined});
    const analyser=window.AnalyserNode?.prototype;
    if(analyser?.getFloatTimeDomainData){
      // Quiet float PCM is below the old 0.009 gate and byte quantization.
      analyser.getFloatTimeDomainData=function(samples){samples.fill(window.__forzaMicSample);};
    }
    class FakePersianRecognition{
      start(){window.__forzaRecognitionStarts=(window.__forzaRecognitionStarts||0)+1;window.__forzaMockRecognition=this;this.onstart?.();}
      stop(){this.onend?.();}
      abort(){this.onend?.();}
    }
    window.SpeechRecognition=FakePersianRecognition;
    window.webkitSpeechRecognition=FakePersianRecognition;
  });
  await page.route('**/huggingface.co/Dibachain/**',route=>{
    externalModelDownloads++;
    return route.abort();
  });
  // Explicit server-side rollback fixture: these assertions cover the preserved legacy path.
  await page.route('**/api/ai/forza-call-provider',r=>r.fulfill({status:200,contentType:'application/json',body:'{"provider":"legacy"}'}));
  await page.route('**/api/runtime',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,database:true,products:[],values:{},versions:{},userId:null})}));
  await page.route('**/api/portal',r=>r.fulfill({status:200,contentType:'application/json',body:'{"success":true,"user":null}'}));
  await page.route('**/forza-greeting-bootstrap.wav',r=>r.fulfill({status:200,contentType:'audio/wav',body:wav()}));
  await page.route('**/api/ai/forza-live',r=>{serverTranscriptions++;return r.fulfill({status:503,body:'{}'});});
  await page.route('**/api/ai/consult-stream',r=>{consultRequests++;return r.abort();});
  await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:25000});
  await page.waitForFunction(()=>!!window.__forzaMockRecognition,null,{timeout:6000});
  await page.waitForTimeout(450); // establish ambient baseline
  await page.evaluate(()=>{window.__forzaMicSample=0.003;});
  await page.waitForTimeout(450); // near-field onset before recognized words
  for(const text of ['می خواهم','می خواهم مشخصات','می خواهم مشخصات تسمه صنعتی را']){
    await page.evaluate(text=>window.__forzaMockRecognition.onresult({resultIndex:0,results:[
      Object.assign([{transcript:text}],{isFinal:false})]}),text);
    await page.getByText(text,{exact:true}).waitFor({timeout:950});
  }
  const started=Date.now();
  await page.evaluate(()=>{
    const rec=window.__forzaMockRecognition;
    rec.onresult({resultIndex:0,results:[
      Object.assign([{transcript:'می خواهم مشخصات تسمه صنعتی را'}],{isFinal:false}),
    ]});
  });
  await page.getByText('می خواهم مشخصات تسمه صنعتی را',{exact:false}).waitFor({timeout:950});
  const partialMs=Date.now()-started;
  assert.ok(partialMs<1000,'interim words must be visible immediately');
  assert.equal(serverTranscriptions,0,'the live transcript must not wait for an uploaded WAV');
  assert.equal(externalModelDownloads,0,'low-power browser fallback must not download the local Diba model');
  assert.equal((await page.locator('body').innerText()).includes('در حال تبدیل صدای شما به متن و ارسال به سرور'),false);

  // Chrome may pause interim callbacks during a long sentence. Acoustic
  // microphone evidence must keep the turn open even when text is unchanged.
  await page.evaluate(()=>{window.__forzaMicSample=0.003;});
  await page.waitForTimeout(4200);
  assert.equal(consultRequests,0,'continuous speech energy must block a text-only early dispatch');

  // A 2-second pause is not a turn boundary. The next browser recognition
  // session must append to the same visible customer sentence.
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  await page.waitForTimeout(2100);
  assert.equal(consultRequests,0,'a two-second natural pause must not submit the turn');
  const beforeRestart=await page.evaluate(()=>window.__forzaRecognitionStarts);
  await page.evaluate(()=>window.__forzaMockRecognition.onend());
  await page.waitForFunction(n=>window.__forzaRecognitionStarts===n+1,beforeRestart,{timeout:2500});
  await page.evaluate(()=>{window.__forzaMicSample=0.003;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaMockRecognition.onresult({resultIndex:0,results:[
    Object.assign([{transcript:'تایمینگ با پروفیل SPA'}],{isFinal:false}),
  ]}));
  await page.getByText('می خواهم مشخصات تسمه صنعتی را تایمینگ با پروفیل SPA',{exact:false}).waitFor({timeout:1000});
  assert.equal(consultRequests,0,'resumed words must reset the same turn endpoint timer');

  const starts=await page.evaluate(()=>window.__forzaRecognitionStarts);
  await page.evaluate(()=>window.__forzaMockRecognition.onerror({error:'network'}));
  await page.waitForFunction(n=>window.__forzaRecognitionStarts===n+1,starts,{timeout:2500});
  await page.evaluate(()=>window.__forzaMockRecognition.onresult({resultIndex:0,results:[Object.assign([{transcript:'برای بررسی کد قطعه اطلاعات می‌خواهم'}],{isFinal:false})]}));
  await page.getByText('برای بررسی کد قطعه اطلاعات می‌خواهم',{exact:false}).waitFor({timeout:1000});
  const recoveredStarts=await page.evaluate(()=>window.__forzaRecognitionStarts);
  await page.evaluate(()=>{window.__forzaMockRecognition.onerror({error:'not-allowed'});window.__forzaMockRecognition.onend();});
  await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__forzaRecognitionStarts),recoveredStarts,'permission rejection must not restart the recognizer');

  // Reproduce the customer's screenshot: a short, usable interim transcript
  // ("چه خبر خوبی") followed by real mic silence must dispatch to the LLM
  // promptly, without waiting for the full-audio AvalAI/Diba verifier.
  serverTranscriptions=0;consultRequests=0;
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByText('فورزا گوش می‌دهد؛ صحبتتان را کامل کنید').waitFor({timeout:25000});
  await page.waitForFunction(()=>!!window.__forzaMockRecognition,null,{timeout:6000});
  await page.waitForTimeout(450);
  await page.evaluate(()=>{window.__forzaMicSample=0.003;});
  await page.waitForTimeout(450);
  await page.evaluate(()=>window.__forzaMockRecognition.onresult({resultIndex:0,results:[
    Object.assign([{transcript:'چه خبر خوبی'}],{isFinal:false}),
  ]}));
  await page.getByText('چه خبر خوبی',{exact:true}).waitFor({timeout:1000});
  const dispatchStarted=Date.now();
  const requestPromise=page.waitForRequest(request=>request.url().includes('/api/ai/consult-stream'),{timeout:2500});
  await page.evaluate(()=>{window.__forzaMicSample=0.0005;});
  const dispatchedRequest=await requestPromise;
  const dispatchMs=Date.now()-dispatchStarted;
  assert.equal(dispatchedRequest.postDataJSON().query,'چه خبر خوبی','the exact live transcript must be sent as the new user turn');
  await page.waitForTimeout(80);
  assert.ok(dispatchMs<1800,'a complete interim phrase must reach consult-stream quickly: '+dispatchMs+'ms');
  assert.equal(consultRequests,1,'the completed speech turn must make one LLM request');
  assert.equal(serverTranscriptions,0,'a usable interim transcript must bypass full-audio STT');
  assert.deepEqual(errors,[]);
  console.log('FORZA_LIVE_STT_BROWSER_PASS partial_appeared_ms='+partialMs+' two_second_pause_preserved=1 recognizer_restart_appended=1 transient_network_recovered=1 permissions_do_not_loop=1 fast_interim_turn_dispatch_ms='+dispatchMs+' server_stt_bypassed=1');

  // Test the active Qwen route independently against a deterministic mock WebSocket.
  const qwenPage=await browser.newPage({permissions:['microphone'],viewport:{width:1180,height:750}});
  const qwenErrors=[], legacyRequests=[], turns=[];
  let connectionCount=0, micFrames=0, currentSocket=null, responseNumber=0;
  qwenPage.on('pageerror',e=>qwenErrors.push(e.message));
  await qwenPage.route('**/api/runtime',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,database:true,products:[],values:{},versions:{},userId:null})}));
  await qwenPage.route('**/api/portal',r=>r.fulfill({status:200,contentType:'application/json',body:'{"success":true,"user":null}'}));
  await qwenPage.route('**/api/ai/forza-call-provider',r=>r.fulfill({status:200,contentType:'application/json',body:'{"provider":"qwen"}'}));
  await qwenPage.route(/\/api\/ai\/(?:stt|forza-speech|consult-stream|forza-live)/,r=>{legacyRequests.push(r.request().url());return r.abort();});
  function reply(socket,text){
    const responseId='mock-'+(++responseNumber);
    for(const frame of [
      {type:'response_started',responseId},
      {type:'ai_text_chunk',responseId,text},
      {type:'audio_chunk',responseId,data:Buffer.alloc(9600).toString('base64')},
      {type:'turn_complete',responseId},
    ])socket.send(JSON.stringify(frame));
  }
  await qwenPage.routeWebSocket('**/api/live?provider=qwen',socket=>{
    connectionCount++; currentSocket=socket;
    socket.onMessage(raw=>{
      const m=JSON.parse(String(raw));
      if(m.type==='realtime_audio'){micFrames++;assert.ok(Buffer.from(m.audio,'base64').length>0);}
      if(m.type==='text'){
        turns.push(m.text);
        reply(socket,'پاسخ فنی آزمایشی');
      }
    });
    socket.send(JSON.stringify({type:'connected',provider:'qwen',voice:'Andre',voiceConfirmed:true}));
  });
  await qwenPage.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
  await qwenPage.getByText('فورزا گوش می‌دهد',{exact:true}).waitFor({timeout:25000});
  await qwenPage.waitForTimeout(500);
  assert.equal(turns.length,0,'connecting must not inject a synthetic greeting or user text turn');
  assert.ok(micFrames>0,'native microphone frames reach the websocket immediately after session readiness');
  currentSocket.send(JSON.stringify({type:'speech_started'}));
  currentSocket.send(JSON.stringify({type:'user_transcript',text:'تسمه صنعتی',final:true}));
  currentSocket.send(JSON.stringify({type:'speech_stopped'}));
  reply(currentSocket,'پاسخ صوتی آزمایشی');
  await qwenPage.getByText('پاسخ صوتی آزمایشی',{exact:true}).waitFor({timeout:4000});
  await qwenPage.getByText('فورزا گوش می‌دهد',{exact:true}).waitFor({timeout:4000});
  await qwenPage.getByRole('button',{name:'پیام متنی',exact:true}).click();
  await qwenPage.getByPlaceholder('سؤال فنی خود را تایپ کنید…').fill('تسمه SPA');
  await qwenPage.getByRole('button',{name:'ارسال',exact:true}).click();
  await qwenPage.getByText('پاسخ فنی آزمایشی',{exact:true}).waitFor({timeout:4000});
  assert.ok(turns.includes('تسمه SPA'));
  const turnsBeforeReconnect=turns.length;
  await qwenPage.getByRole('button',{name:'قطع اتصال',exact:true}).click();
  await qwenPage.getByText('اتصال قطع است',{exact:true}).waitFor({timeout:4000});
  await qwenPage.getByRole('button',{name:'اتصال مجدد',exact:true}).click();
  await qwenPage.getByText('فورزا گوش می‌دهد',{exact:true}).waitFor({timeout:25000});
  assert.equal(connectionCount,2);
  assert.equal(turns.length,turnsBeforeReconnect,'reconnecting must not inject any synthetic text turn');
  assert.deepEqual(legacyRequests,[]);
  assert.deepEqual(qwenErrors,[]);
  await qwenPage.close();
  console.log('FORZA_NATIVE_QWEN_BROWSER_PASS mock_websocket=1 microphone_pcm=1 no_synthetic_turn=1 multi_turn=1 reconnect=1 legacy_http_requests=0');
 }finally{await browser.close();}
})().catch(e=>{console.error('FORZA_LIVE_STT_BROWSER_FAIL',e);process.exitCode=1;});
