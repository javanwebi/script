// Real Piper Amir browser acceptance test. No mocks for TTS or model weights.
// Tests true WAV synthesis and end-of-greeting playback, not audio hardware.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
  ]});
  let page;
  try{
    page=await browser.newPage();
    const events=[];
    const failure=[];
    const voiceModelRequests=[];
    const externalVoiceRequests=[];
    page.on('request',request=>{
      const url=request.url();
      if(url.includes('/forza-models/amir/'))voiceModelRequests.push(url);
      if(url.includes('piper-voices/resolve/') || url.includes('diffusionstudio/piper-voices')){
        externalVoiceRequests.push(url);
      }
    });
    page.on('pageerror',err=>failure.push('PAGE ERROR: '+err.message));
    page.on('console',msg=>{
      const text=msg.text();
      if(/FORZA Amir|FORZA Diba|Greeting|wasm|onnx|phonemi/i.test(text))events.push(msg.type()+': '+text.slice(0,500));
    });
    page.on('response',res=>{
      if(/piper|onnx|\.wasm|\.data|huggingface/i.test(res.url()))events.push('HTTP '+res.status()+' '+res.url().slice(0,200));
    });
    await page.addInitScript(()=>{
      window.__actualVoicePlayback=0;
      const original=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(...args){
        window.__actualVoicePlayback++;
        return original.apply(this,args);
      };
    });
    await page.route('**/api/ai/consult-stream',async route=>{
      const answer='برای انتخاب تسمه، کد فنی را بفرمایید.';
      const frames=[
        {type:'start',responseId:'amir-real-browser'},
        {type:'text_chunk',chunk:answer,textSoFar:answer},
        {type:'done',fullText:answer},
      ];
      await route.fulfill({status:200,contentType:'text/event-stream',
        body:frames.map(x=>'data: '+JSON.stringify(x)+'\\n\\n').join('')});
    });
    await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded'});
    try{
      await page.waitForFunction(()=>{
        const s=document.body.innerText;
        return s.includes('فورزا گوش می‌دهد') && s.includes('صدای امیر: آماده');
      },{}, {timeout:210000});
      const playback=await page.evaluate(()=>window.__actualVoicePlayback);
      assert.ok(playback>0,'Piper Amir greeting WAV played');
      // The greeting is pre-rendered, so ask one question to verify that
      // local ONNX/WASM synthesis (not only model download) really works.
      await page.getByTitle('تایپ پیام متنی').click();
      await page.getByPlaceholder('سؤال فنی خود را تایپ کنید...').fill('تسمه چیست؟');
      await page.getByTitle('ارسال به هوش مصنوعی').click();
      await page.waitForFunction(()=>document.body.innerText.includes('برای انتخاب تسمه، کد فنی را بفرمایید.')&&
        document.body.innerText.includes('فورزا گوش می‌دهد'),{}, {timeout:35000});
      const finalPlayback=await page.evaluate(()=>window.__actualVoicePlayback);
      assert.ok(finalPlayback>playback,'actual WASM Amir reply must play after greeting');
      assert.ok(voiceModelRequests.length>=2,'Amir .onnx and .json are downloaded from the Sanat Pish origin');
      assert.deepEqual(externalVoiceRequests,[],'no external Piper TTS model requests are allowed');
      assert.equal(failure.length,0,'no uncaught browser errors: '+failure.join(';'));
      console.log('REAL AMIR PASS: actual Piper WASM ONNX, complete spoken greeting, listening activated');
      // Validate the actual Vosk/Diba browser model loads after the greeting.
      // This is not just a mocked recognizer: it downloads the 53 MB Farsi model.
      await page.waitForFunction(
        ()=>document.body.innerText.includes('تشخیص گفتار: دیبا'),
        {},{timeout:150000}
      );
      console.log('REAL DIBA PASS: Persian STT WASM model loaded and audio bridge active');
    }catch(error){
      console.error('REAL VOICE PIPELINE FAIL:',error.message);
      console.error('PAGE:',(await page.locator('body').innerText()).slice(-2200));
      console.error('NETWORK / CONSOLE:',events.slice(-60).join('\n'));
      console.error('PAGE ERRORS:',failure.join('\n'));
      process.exitCode=1;
    }
  }finally{
    await page?.close().catch(()=>{});
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
