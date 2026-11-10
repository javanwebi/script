/* Real pointer/touch smoke against the source component, isolated from customer data. */
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=process.cwd();
 // Match npm predev/prebuild: generate ignored WebP imports from tracked source PNGs.
 execFileSync(process.execPath,['scripts/optimize-images.mjs'],{cwd:root,stdio:'inherit'});
 const fixture=await fs.mkdtemp(path.join(root,'region-smoke-'));
 let server,browser;
 try{
  const {createServer}=await import('vite');
  await fs.writeFile(path.join(fixture,'index.html'),'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script>');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#bcc4c9"/><circle cx="600" cy="250" r="70" fill="#e56b1e"/><rect x="150" y="150" width="140" height="140" fill="#55565a"/></svg>';
  const portraitSvg='<svg xmlns="http://www.w3.org/2000/svg" width="500" height="1000"><rect width="500" height="1000" fill="#bcc4c9"/><circle cx="300" cy="500" r="70" fill="#e56b1e"/><rect x="75" y="300" width="70" height="140" fill="#55565a"/></svg>';
  const source='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  const portraitSource='data:image/svg+xml;base64,'+Buffer.from(portraitSvg).toString('base64');
  const entryPath=path.join(fixture,'entry.tsx');
  const entry=(imageSource)=>`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ImageRegionSelector} from '/src/components/search/ImageRegionSelector.tsx';import '/src/index.css';import '/src/components/search/industrial-scan.css';function App(){const [region,setRegion]=useState();window.__searchCount=0;return <ImageRegionSelector src={${JSON.stringify(imageSource)}} value={region} candidateRegions={[{x:0.53,y:0.36,width:0.14,height:0.28},{x:0.15,y:0.3,width:0.14,height:0.28}]} onChange={r=>{window.lastRegion=r || null;setRegion(r)}} onSearch={()=>{window.__searchCount++}}/>}createRoot(document.getElementById('root')).render(<App/>);`;
  await fs.writeFile(entryPath,entry(source));
  await fs.writeFile(path.join(fixture,'auth.ts'),"export const useAuth=()=>({currentUser:null,openAuthModal:()=>{},activeRole:'guest',priceLayer:'retail'});");
  await fs.writeFile(path.join(fixture,'cart.ts'),"export const useCart=()=>({addItem:()=>{}});");
  server=await createServer({root,logLevel:'error',resolve:{alias:[{find:/.*\/context\/AuthContext$/,replacement:path.join(fixture,'auth.ts')},{find:/.*\/context\/CartContext$/,replacement:path.join(fixture,'cart.ts')}]},server:{host:'127.0.0.1',port:0}});await server.listen();
  browser=await chromium.launch({headless:true});
  for(const mobile of [false,true]){
   if(mobile)await fs.writeFile(entryPath,entry(portraitSource));
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1000,height:900},hasTouch:mobile,isMobile:mobile});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/index.html`);
   await page.getByTestId('image-region-selector').waitFor();const image=page.getByAltText('عکس ارسالی؛ ناحیه قطعه را انتخاب کنید');await image.waitFor({state:'visible'});
   await page.waitForFunction(expected=>document.querySelector('img')?.naturalWidth===expected,mobile?500:1000);
   const frame=page.locator('.sanat-region-picker__frame');const box=await frame.boundingBox();assert.ok(box,'region frame must be visible');const x=box.x+box.width*0.6,y=box.y+box.height*0.5;
   if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
   await page.waitForFunction(()=>{const r=window.lastRegion;return !!r&&typeof r.x==='number'&&typeof r.width==='number';});await page.getByText('پیش‌نمایش برش').waitFor();
   await page.screenshot({path:path.join(os.tmpdir(),`sanat-region-${mobile?'touch':'desktop'}.png`)});
   let r=await page.evaluate(()=>window.lastRegion);assert.ok(Math.abs(r.x+r.width/2-0.6)<0.01);assert.ok(Math.abs(r.y+r.height/2-0.5)<0.01);
   if(mobile){
    const previous={...r};
    await page.touchscreen.tap(box.x+box.width*0.45,box.y+box.height*0.9);
    await page.waitForFunction(()=>{const r=window.lastRegion;return !!r&&typeof r.width==='number';});
    r=await page.evaluate(()=>window.lastRegion);
    assert.notDeepEqual(r,previous);
    assert.ok(0.45>=r.x&&0.45<=r.x+r.width&&0.9>=r.y&&0.9<=r.y+r.height);
    await page.getByRole('button',{name:'جست‌وجوی این قطعه'}).click();
    assert.equal(await page.evaluate(()=>window.__searchCount),1);
   }
   if(!mobile){
    const dragBox=await frame.boundingBox();await page.mouse.move(dragBox.x+dragBox.width*0.12,dragBox.y+dragBox.height*0.2);await page.mouse.down();await page.mouse.move(dragBox.x+dragBox.width*0.32,dragBox.y+dragBox.height*0.7,{steps:8});await page.mouse.up();
    r=await page.evaluate(()=>window.lastRegion);assert.ok(Math.abs(r.width-0.2)<0.01,JSON.stringify(r));assert.ok(Math.abs(r.height-0.5)<0.01,JSON.stringify(r));
    await page.getByRole('group').press('ArrowRight');assert.ok((await page.evaluate(()=>window.lastRegion)).x>r.x);
    await page.getByRole('button',{name:'جست‌وجوی این قطعه'}).click();
    assert.equal(await page.evaluate(()=>window.__searchCount),1);
   }
   await page.getByRole('button',{name:'جست‌وجوی کل تصویر'}).click();assert.equal(await page.evaluate(()=>window.lastRegion),null);
   assert.deepEqual(errors,[]);await context.close();console.log(mobile?'TOUCH_SELECTION_OK':'POINTER_DRAG_KEYBOARD_OK');
  }
  // Mount the actual modal with isolated identity/cart hooks and mock only HTTP.
  await fs.writeFile(path.join(fixture,'modal.html'),'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./modal.tsx"></script>');
  await fs.writeFile(path.join(fixture,'modal.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {AiVisualPartSearchModal} from '/src/components/search/AiVisualPartSearchModal.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(<MemoryRouter><AiVisualPartSearchModal isOpen={true} onClose={()=>{}}/></MemoryRouter>);`);
  const page=await browser.newPage({viewport:{width:1000,height:1000}});let uploads=0;const detections=[],queries=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;let body={success:true,values:{},products:[]};
   if(pathname==='/api/ai/local-vision-status')body={enabled:true,pipeline:'local-lens-v2',ready:true,total:869,indexed:869};
   if(pathname==='/api/ai/customer-images'){uploads++;body={imageUrl:'/api/ai/customer-images/isolated-test.png'};}
   if(pathname==='/api/ai/detect-regions'){
    detections.push(route.request().postDataJSON());
    body={success:true,detectionId:'test-detection-id',autoDetected:true,queryRegion:{x:0.4,y:0.3,width:0.2,height:0.3},queryRegions:[{x:0.4,y:0.3,width:0.2,height:0.3},{x:0.65,y:0.3,width:0.2,height:0.3}],model:'dinov2-test',pipeline:'local-lens-v2',elapsedMs:120};
   }
   if(pathname==='/api/ai/analyze-part'){
    const request=route.request().postDataJSON();queries.push(request);
    await new Promise(resolve=>setTimeout(resolve,260));
    body={success:true,isAiGenerated:true,stage:'quick',summary:{detectedPartType:'قطعه',detectedProfile:'',visualAnalysis:'',confidence:0},matchedProducts:[],modelSuggestions:[],nearestCatalogSuggestions:[{code:'unrelated-test',name:'محصول نامرتبط نباید نمایش داده شود',familyCode:'unrelated',familyName:'نامرتبط',imageScope:'variant',matchBasis:'explore',specs:[],reason:'test'}],technicalAdvice:'',customerImageUrl:undefined,queryRegion:request.fullImage?undefined:request.region || {x:0.4,y:0.3,width:0.2,height:0.3},queryRegions:[{x:0.4,y:0.3,width:0.2,height:0.3},{x:0.65,y:0.3,width:0.2,height:0.3}],scanCoverage:{total:869,compared:869,failed:0,complete:true,providerAvailable:true,failedImageIds:[]},retrieval:{mode:'local-embedding',total:869,indexed:869,ready:true,verifiedPool:0}};
   }
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/modal.html`);
  await page.locator('input[type=file]').first().setInputFiles({name:'isolated.png',mimeType:'image/png',buffer:await fs.readFile(path.join(os.tmpdir(),'sanat-region-touch.png'))});
  await page.getByTestId('image-region-review').waitFor();
  await page.getByRole('button',{name:'تأیید برش و شروع تحلیل'}).waitFor();
  assert.equal(uploads,0);assert.equal(detections.length,1);assert.ok(typeof detections[0].imageBase64==='string'&&detections[0].imageBase64.startsWith('data:image/'));assert.equal(queries.length,0);
  const modalFrame=page.locator('.sanat-region-picker__frame');const bounds=await modalFrame.boundingBox();
  await page.mouse.click(bounds.x+bounds.width*0.75,bounds.y+bounds.height*0.45);
  await page.waitForTimeout(350);assert.equal(queries.length,0);
  await page.getByRole('button',{name:'تأیید برش و شروع تحلیل'}).click();
  await page.getByTestId('analysis-approved-crop').waitFor();
  await page.getByText('نتیجه تطبیق قطعه توسط هوش مصنوعی').waitFor();
  assert.equal(queries.length,1);assert.ok(queries[0].imageBase64?.startsWith('data:image/'));assert.equal(queries[0].imageBase64,detections[0].imageBase64);assert.ok(queries[0].region);assert.ok(Math.abs(queries[0].region.x-0.65)<0.01);assert.equal(queries[0].detectionId,'test-detection-id');assert.equal(queries[0].fullImage,false);assert.equal(queries[0].includeNearest,false);
  assert.equal(await page.getByText('محصول نامرتبط نباید نمایش داده شود').count(),0);assert.equal(uploads,0);
  const resultFrame=page.locator('.sanat-region-picker__frame').last();const resultBounds=await resultFrame.boundingBox();
  await page.mouse.click(resultBounds.x+resultBounds.width*0.25,resultBounds.y+resultBounds.height*0.75);
  await page.waitForTimeout(80);assert.equal(queries.length,1);
  await page.getByRole('button',{name:'جست‌وجوی این قطعه'}).click();
  await page.getByTestId('vision-analyzing-screen').waitFor();
  await page.getByTestId('vision-analyzing-screen').waitFor({state:'detached'});
  assert.equal(queries.length,2);assert.equal(queries[1].imageBase64,detections[0].imageBase64);assert.ok(queries[1].region);assert.ok(0.25>=queries[1].region.x&&0.25<=queries[1].region.x+queries[1].region.width);assert.ok(0.75>=queries[1].region.y&&0.75<=queries[1].region.y+queries[1].region.height);assert.equal(queries[1].fullImage,false);
  await page.getByRole('button',{name:'جست‌وجوی کل تصویر',exact:true}).click();
  await page.getByTestId('vision-analyzing-screen').waitFor();
  await page.getByTestId('vision-analyzing-screen').waitFor({state:'detached'});
  assert.equal(queries.length,3);assert.equal(queries[2].imageBase64,detections[0].imageBase64);assert.equal(queries[2].region,undefined);assert.equal(queries[2].fullImage,true);assert.equal(uploads,0);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);assert.equal(await page.locator('.sanat-visual-search-shell').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
  await page.close();console.log('UPLOAD_DETECT_CONFIRM_CROP_ANALYSIS_FULL_IMAGE_FALLBACK_AND_MOBILE_LAYOUT_OK');

 }finally{await browser?.close();await server?.close();await fs.rm(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
