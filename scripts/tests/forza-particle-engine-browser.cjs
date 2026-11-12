// Visual regression smoke for the official FORZA particle identity.
// Exercises the normal WebGL path, context-loss recovery, and the no-WebGL
// Canvas2D poster path. No real microphone or external AI service is needed.
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

async function stubApis(page){
  await page.route('**/api/runtime*',r=>r.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({success:true,database:true,products:[],values:{},versions:{},userId:null,brands:[]})
  }));
  await page.route('**/api/portal*',r=>r.fulfill({
    status:200,contentType:'application/json',body:'{"success":true,"user":null}'
  }));
  await page.route('**/api/ai/forza-voice-info',r=>r.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({success:true,voice:'piper-nima-gyro-medium',label:'Nima',ready:true})
  }));
  await page.route('**/api/ai/forza-stt-info',r=>r.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({serverSttConfigured:false,serverSttProvider:'none',serverSttReady:false})
  }));
  await page.route('**/forza-greeting-bootstrap.wav',r=>r.fulfill({
    status:200,contentType:'audio/wav',body:wav()
  }));
}

(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
    '--use-gl=angle','--use-angle=swiftshader'
  ]});
  try{
    // WebGL path: the original GPU particle scene must form, then recover to
    // the same source silhouette when the browser reports context loss.
    const gpu=await browser.newPage({permissions:['microphone'],viewport:{width:1440,height:900}});
    const gpuErrors=[];
    gpu.on('pageerror',e=>gpuErrors.push(e.message));
    await stubApis(gpu);
    await gpu.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
    await gpu.locator('canvas[data-engine="webgl"]').waitFor({timeout:20000});
    const formed=await gpu.locator('canvas[data-engine="webgl"]').evaluate(c=>({w:c.width,h:c.height}));
    assert.ok(formed.w>0&&formed.h>0,'WebGL framebuffer must be non-empty');
    await gpu.evaluate(()=>{
      const canvas=document.querySelector('canvas[data-engine="webgl"]');
      canvas?.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
    });
    await gpu.locator('canvas.forza-canvas-fallback').waitFor({timeout:20000});
    await gpu.waitForTimeout(450);
    const recoveredPixels=await gpu.locator('canvas.forza-canvas-fallback').evaluate(canvas=>{
      const ctx=canvas.getContext('2d');
      if(!ctx)return 0;
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let visible=0;
      for(let i=3;i<data.length;i+=64)if(data[i]>0)visible++;
      return visible;
    });
    assert.ok(recoveredPixels>100,'context-loss recovery must draw the FORZA poster');
    assert.doesNotMatch((await gpu.locator('body').innerText()),/موتور گرافیکی فورزا دیر آماده شد|شتاب‌دهنده گرافیکی WebGL در دسترس نیست/);
    assert.deepEqual(gpuErrors,[]);
    await gpu.close();

    // Unsupported WebGL path: same particle silhouette must be drawn with
    // Canvas2D instead of displaying a graphics-engine error or black screen.
    const fallback=await browser.newPage({permissions:['microphone'],viewport:{width:390,height:844}});
    const fallbackErrors=[];
    fallback.on('pageerror',e=>fallbackErrors.push(e.message));
    await fallback.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if(typeof type==='string'&&['webgl2','webgl','experimental-webgl'].includes(type))return null;
        return original.call(this,type,...args);
      };
    });
    await stubApis(fallback);
    await fallback.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
    await fallback.locator('canvas.forza-canvas-fallback').waitFor({timeout:30000});
    await fallback.waitForTimeout(350);
    const fallbackResult=await fallback.locator('canvas.forza-canvas-fallback').evaluate(canvas=>{
      const ctx=canvas.getContext('2d');
      if(!ctx)return {width:canvas.width,height:canvas.height,visible:0};
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let visible=0;
      for(let i=3;i<data.length;i+=64)if(data[i]>8)visible++;
      return {width:canvas.width,height:canvas.height,visible};
    });
    assert.ok(fallbackResult.width>0&&fallbackResult.height>0);
    assert.ok(fallbackResult.visible>100,'Canvas2D must render visible FORZA pixels on unsupported WebGL devices');
    assert.doesNotMatch((await fallback.locator('body').innerText()),/موتور گرافیکی فورزا دیر آماده شد|شتاب‌دهنده گرافیکی WebGL در دسترس نیست/);
    assert.deepEqual(fallbackErrors,[]);
    await fallback.close();

    // A context that exists but renders at single-digit FPS (SwiftShader /
    // software GPU) must be released and switched to the same Canvas poster.
    const slowGpu=await browser.newPage({permissions:['microphone'],viewport:{width:1100,height:780}});
    const slowGpuErrors=[],slowGpuFallbackLogs=[];
    slowGpu.on('pageerror',e=>slowGpuErrors.push(e.message));
    slowGpu.on('console',msg=>{if(msg.text().includes('[FORZA_PARTICLES] canvas_fallback=1'))slowGpuFallbackLogs.push(msg.text());});
    await stubApis(slowGpu);
    await slowGpu.goto('http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
    await slowGpu.locator('canvas[data-engine="webgl"]').waitFor({timeout:20000});
    await slowGpu.locator('canvas.forza-canvas-fallback').waitFor({timeout:30000});
    await slowGpu.waitForFunction(()=>document.body.innerText.includes('ADAPTIVE'),null,{timeout:15000});
    const slowGpuResult=await slowGpu.locator('canvas.forza-canvas-fallback').evaluate(canvas=>{
      const ctx=canvas.getContext('2d');
      if(!ctx)return {width:canvas.width,height:canvas.height,visible:0};
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let visible=0;
      for(let i=3;i<data.length;i+=64)if(data[i]>0)visible++;
      return {width:canvas.width,height:canvas.height,visible};
    });
    assert.ok(slowGpuResult.width>0&&slowGpuResult.height>0);
    assert.ok(slowGpuResult.visible>100,'single-digit software GPU must recover to visible Canvas poster');
    assert.equal(await slowGpu.locator('canvas[data-engine="webgl"]').count(),0,'slow WebGL context must be released');
    assert.ok(slowGpuFallbackLogs.some(line=>line.includes('reason=slow_gpu')),'slow software GPU must trigger the FPS-based fallback');
    assert.deepEqual(slowGpuErrors,[]);
    console.log('FORZA_PARTICLE_ENGINE_BROWSER_PASS webgl=1 context_recovery=1 no_webgl=1 software_gpu_recovery=1 visible_pixels='+slowGpuResult.visible);
    await slowGpu.close();
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error('FORZA_PARTICLE_ENGINE_BROWSER_FAIL',error);
  process.exitCode=1;
});
