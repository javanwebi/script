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
    await page.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded'});
    try{
      await page.waitForFunction(()=>{
        const s=document.body.innerText;
        return s.includes('فورزا گوش می‌دهد') && s.includes('صدای امیر: آماده');
      },{}, {timeout:210000});
      const playback=await page.evaluate(()=>window.__actualVoicePlayback);
      assert.ok(playback>0,'at least one real browser audio playback');
      assert.equal(failure.length,0,'no uncaught browser errors: '+failure.join(';'));
      console.log('REAL AMIR PASS: actual Piper WASM ONNX, complete spoken greeting, listening activated');
    }catch(error){
      console.error('REAL AMIR FAIL:',error.message);
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
