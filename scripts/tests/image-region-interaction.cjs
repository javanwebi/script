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
  const entry=(imageSource)=>`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ImageRegionSelector} from '/src/components/search/ImageRegionSelector.tsx';import '/src/index.css';import '/src/components/search/industrial-scan.css';function App(){const [region,setRegion]=useState();const [disabled,setDisabled]=useState(false);window.setSelectorDisabled=setDisabled;window.__searchCount=window.__searchCount||0;return <ImageRegionSelector disabled={disabled} src={${JSON.stringify(imageSource)}} value={region} candidateRegions={[{x:0.53,y:0.36,width:0.14,height:0.28},{x:0.15,y:0.3,width:0.14,height:0.28}]} onChange={r=>{window.lastRegion=r || null;setRegion(r)}} onSearch={()=>{window.__searchCount++}}/>}createRoot(document.getElementById('root')).render(<App/>);`;
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
   const frame=page.locator('.sanat-region-picker__frame');const box=await frame.locator('img').boundingBox();assert.ok(box,'region frame must be visible');const x=box.x+box.width*0.6,y=box.y+box.height*0.5;
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
    const dragBox=await frame.locator('img').boundingBox();await page.mouse.move(dragBox.x+dragBox.width*0.12,dragBox.y+dragBox.height*0.2);await page.mouse.down();await page.mouse.move(dragBox.x+dragBox.width*0.32,dragBox.y+dragBox.height*0.7,{steps:8});await page.mouse.up();
    r=await page.evaluate(()=>window.lastRegion);assert.ok(Math.abs(r.width-0.2)<0.01,JSON.stringify(r));assert.ok(Math.abs(r.height-0.5)<0.01,JSON.stringify(r));
    await page.getByRole('group',{name:'انتخاب قطعه با لمس، کشیدن یا کلیدهای جهت'}).press('ArrowRight');assert.ok((await page.evaluate(()=>window.lastRegion)).x>r.x);
    const selectorFrame=page.getByRole('group',{name:'انتخاب قطعه با لمس، کشیدن یا کلیدهای جهت'});
    await selectorFrame.focus();
    const beforeDisabled=await page.evaluate(()=>window.lastRegion);
    await page.evaluate(()=>window.setSelectorDisabled(true));
    // Wait for React to commit the busy state before asserting keyboard blocking.
    await page.waitForFunction(()=>{
     const frame=document.querySelector('.sanat-region-picker__frame');
     return frame?.getAttribute('tabindex')==='-1' && frame.getAttribute('aria-disabled')==='true';
    });
    await page.keyboard.press('ArrowRight');
    assert.deepEqual(await page.evaluate(()=>window.lastRegion),beforeDisabled,'keyboard must not change the selected region while busy');
    assert.equal(await selectorFrame.getAttribute('tabindex'),'-1');
    assert.equal(await page.getByRole('button',{name:'جست‌وجوی این قطعه'}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'جست‌وجوی کل تصویر'}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'قطعه ۲'}).isDisabled(),true);
    await page.evaluate(()=>window.setSelectorDisabled(false));
    // React commits updates scheduled from page.evaluate asynchronously; wait
    // until the selector is actually re-enabled before restoring keyboard focus.
    await page.waitForFunction(()=>{
     const frame=document.querySelector('.sanat-region-picker__frame');
     return frame?.getAttribute('tabindex')==='0' && frame.getAttribute('aria-disabled')!=='true';
    });
    await selectorFrame.focus();
    await page.waitForFunction(()=>document.activeElement?.classList.contains('sanat-region-picker__frame'));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(previous=>window.lastRegion?.x>previous.x,beforeDisabled);
    assert.ok((await page.evaluate(()=>window.lastRegion)).x>beforeDisabled.x,'keyboard selection must resume when ready');
    await page.getByRole('button',{name:'جست‌وجوی این قطعه'}).click();
    assert.equal(await page.evaluate(()=>window.__searchCount),1);
   }
   // Original KIKI quick selector must choose a real second region, not run a search.
   const rail=page.getByTestId('vision-region-candidates');
   await rail.getByRole('button',{name:'قطعه ۲'}).click();
   const second=await page.evaluate(()=>window.lastRegion);
   assert.ok(Math.abs(second.x-0.15)<0.01 && Math.abs(second.y-0.3)<0.01,JSON.stringify(second));
   assert.equal(await page.evaluate(()=>window.__searchCount),1,'candidate change must not auto-search');
   await page.getByRole('button',{name:'جست‌وجوی کل تصویر'}).click();assert.equal(await page.evaluate(()=>window.lastRegion),null);
   assert.deepEqual(errors,[]);await context.close();console.log(mobile?'TOUCH_SELECTION_OK':'POINTER_DRAG_KEYBOARD_OK');
  }
  // Mount the actual modal and verify the new automatic detect -> search -> inline results flow.
  await fs.writeFile(path.join(fixture,'modal.html'),'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./modal.tsx"></script>');
  await fs.writeFile(path.join(fixture,'modal.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {AiVisualPartSearchModal} from '/src/components/search/AiVisualPartSearchModal.tsx';import '/src/index.css';function RouteProbe(){const location=useLocation();window.__kikiPath=location.pathname;return null;}createRoot(document.getElementById('root')).render(<MemoryRouter><RouteProbe/><AiVisualPartSearchModal isOpen={true} onClose={()=>{}}/></MemoryRouter>);`);
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  let uploads=0;
  const detections=[],queries=[],errors=[];
  const catalogSvg='<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300"><rect width="500" height="300" fill="#f6f7f8"/><path d="M70 155 C80 35 420 35 430 155 C420 260 80 260 70 155Z" fill="#24272b"/><text x="250" y="170" font-size="54" text-anchor="middle" fill="white">A-49</text></svg>';
  const catalogImage='data:image/svg+xml;base64,'+Buffer.from(catalogSvg).toString('base64');
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   let body={success:true,values:{},products:[]};
   if(pathname==='/api/ai/local-vision-status')body={enabled:true,pipeline:'local-lens-v2',ready:true,total:869,indexed:869};
   if(pathname==='/api/ai/customer-images'){uploads++;body={imageUrl:'/api/ai/customer-images/isolated-test.png'};}
   if(pathname==='/api/ai/detect-regions'){
    detections.push(route.request().postDataJSON());
    body={success:true,detectionId:'test-detection-id',autoDetected:true,queryRegion:{x:0.4,y:0.3,width:0.2,height:0.3},queryRegions:[{x:0.4,y:0.3,width:0.2,height:0.3},{x:0.65,y:0.3,width:0.2,height:0.3}],model:'dinov2-test',pipeline:'local-lens-v2',elapsedMs:120};
   }
   if(pathname==='/api/ai/analyze-part'){
    const request=route.request().postDataJSON();queries.push(request);
    await new Promise(resolve=>setTimeout(resolve,180));
    body={success:true,isAiGenerated:true,stage:'quick',summary:{detectedPartType:'تسمه وی شکل',detectedProfile:'A',visualAnalysis:'تسمه مشکی با نوشته A-49',confidence:94},matchedProducts:[{code:'TEST-A49',name:'تسمه وی شکل A-49',brand:'FORZA',image:catalogImage,imageScope:'variant',similarityScore:94,visualVerdictFarsi:'تطبیق تصویری قوی',specs:[{key:'سری',value:'A'},{key:'طول',value:'49 اینچ'}],catalogProduct:{image:catalogImage,imageScope:'sku-verified',categoryName:'تسمه صنعتی'}}],similarCandidates:[],modelSuggestions:[],technicalAdvice:'',queryRegion:request.fullImage?undefined:request.region||{x:0.4,y:0.3,width:0.2,height:0.3},queryRegions:[{x:0.4,y:0.3,width:0.2,height:0.3},{x:0.65,y:0.3,width:0.2,height:0.3}],scanCoverage:{total:869,compared:869,failed:0,complete:true,providerAvailable:true,failedImageIds:[]},retrieval:{mode:'local-embedding',total:869,indexed:869,ready:true,verifiedPool:1}};
   }
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/modal.html`);
  await page.locator('input[type=file]').first().setInputFiles({name:'isolated.png',mimeType:'image/png',buffer:await fs.readFile(path.join(os.tmpdir(),'sanat-region-touch.png'))});
  await page.getByTestId('image-region-review').waitFor();
  await page.getByTestId('kiki-inline-catalog-results').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  await page.getByRole('button',{name:/تسمه وی شکل A-49/}).waitFor();
  assert.equal(queries.length,1,'catalog analysis must start automatically after image detection');
  assert.match(queries[0].imageBase64,/^data:image\/(?:png|jpeg|webp);base64,/);
  assert.ok(queries[0].region||queries[0].fullImage,'automatic analysis must use a detected region or the safe full-image fallback');
  assert.equal(queries[0].includeNearest,true);
  assert.equal(uploads,0,'customer image must remain in the browser-local vault');
  assert.equal(await page.locator('.sanat-region-picker__search').count(),0,'manual crop-confirm action must be removed');
  assert.equal(await page.locator('.sanat-region-picker__full-image').count(),0,'manual full-image action must be removed');
  const selectedProduct=page.getByRole('button',{name:/تسمه وی شکل A-49/});
  await selectedProduct.click();
  assert.equal(await selectedProduct.getAttribute('aria-pressed'),'true','catalog result must remain accessible as selected');
  await page.waitForFunction(()=>window.__kikiPath==='/product/TEST-A49');
  assert.equal(await page.evaluate(()=>window.__kikiPath),'/product/TEST-A49','catalog result must open its own product detail page');
  await page.screenshot({path:path.join(os.tmpdir(),'sanat-forza-vision-auto-inline-desktop.png'),fullPage:true});

  const candidateButtons=page.getByTestId('vision-region-candidates').getByRole('button');
  const candidateCount=await candidateButtons.count();
  let nextCandidateIndex=-1;
  for(let index=0;index<candidateCount;index++){
   if(await candidateButtons.nth(index).getAttribute('aria-pressed')!=='true'){nextCandidateIndex=index;break;}
  }
  if(nextCandidateIndex>=0){
   const previousRegion=queries[0].region;
   await candidateButtons.nth(nextCandidateIndex).click();
   await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='true',null,{timeout:10000});
   await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
   assert.equal(queries.length,2,'selecting another detected object must automatically run a new search');
   assert.ok(queries[1].region,'second object search must use its own detected region');
   assert.notDeepEqual(queries[1].region,previousRegion,'selecting another detected object must change the analyzed region');
  }

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile workspace must not overflow horizontally');
  const mobileImage=page.locator('.sanat-region-picker--viewer .sanat-region-picker__frame > img');
  await mobileImage.waitFor({state:'visible'});
  const mobileFit=await page.locator('.sanat-region-picker--viewer .sanat-region-picker__frame').evaluate(frame=>{
   const image=frame.querySelector('img');
   const imageRect=image.getBoundingClientRect(),frameRect=frame.getBoundingClientRect();
   const imageStyle=getComputedStyle(image),frameStyle=getComputedStyle(frame);
   return {
    naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,
    width:imageRect.width,height:imageRect.height,frameWidth:frameRect.width,frameHeight:frameRect.height,
    objectFit:imageStyle.objectFit,imageBorder:imageStyle.borderTopWidth,frameBorder:frameStyle.borderTopWidth,
    frameShadow:frameStyle.boxShadow,displayRatio:imageRect.width/imageRect.height,
    naturalRatio:image.naturalWidth/image.naturalHeight
   };
  });
  assert.equal(mobileFit.objectFit,'contain','mobile viewer must preserve the complete uploaded image');
  assert.equal(mobileFit.imageBorder,'0px','uploaded image must not have an added white border');
  assert.equal(mobileFit.frameBorder,'0px','image holder must not draw an extra border');
  assert.equal(mobileFit.frameShadow,'none','image holder must not add a white frame shadow');
  assert.ok(mobileFit.width>0&&mobileFit.height>0&&mobileFit.width<=mobileFit.frameWidth+1&&mobileFit.height<=mobileFit.frameHeight+1,JSON.stringify(mobileFit));
  assert.ok(Math.abs(mobileFit.displayRatio-mobileFit.naturalRatio)<0.03,'mobile viewer must show the entire image without cropping or stretching');

  // The inline catalogue is a real bottom sheet: pull to the half-screen stop,
  // keep its result list independently scrollable, then return to the image.
  const sheet=page.locator('.kiki-image-workspace__catalog');
  const sheetHandle=page.locator('.kiki-image-workspace__sheet-handle');
  await sheetHandle.waitFor({state:'visible'});
  assert.equal(await sheet.getAttribute('data-sheet-level'),'peek');
  const handleBox=await sheetHandle.boundingBox();assert.ok(handleBox);
  await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y+handleBox.height/2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y-115,{steps:8});
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.kiki-image-workspace__catalog')?.getAttribute('data-sheet-level')==='half');
  const catalogueBody=page.locator('#kiki-image-workspace-catalog-body');
  assert.equal(await catalogueBody.evaluate(el=>getComputedStyle(el).overflowY),'auto','mobile result list must scroll independently');
  await catalogueBody.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const halfHandleBox=await sheetHandle.boundingBox();assert.ok(halfHandleBox);
  await page.mouse.move(halfHandleBox.x+halfHandleBox.width/2,halfHandleBox.y+halfHandleBox.height/2);
  await page.mouse.down();
  await page.mouse.move(halfHandleBox.x+halfHandleBox.width/2,halfHandleBox.y+halfHandleBox.height/2+115,{steps:8});
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.kiki-image-workspace__catalog')?.getAttribute('data-sheet-level')==='peek');

  // Automatic proposals can be corrected with a manual drag on mobile even
  // when autoSelect is enabled; the exact new crop must trigger a new search.
  const mobileFrame=page.locator('.sanat-region-picker--viewer .sanat-region-picker__frame');
  const frameBox=await mobileFrame.locator('img').boundingBox();assert.ok(frameBox);
  const manualStart={x:frameBox.x+frameBox.width*.1,y:frameBox.y+frameBox.height*.45};
  const manualEnd={x:frameBox.x+frameBox.width*.32,y:frameBox.y+frameBox.height*.75};
  await page.mouse.move(manualStart.x,manualStart.y);
  await page.mouse.down();
  await page.mouse.move(manualEnd.x,manualEnd.y,{steps:10});
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='true',null,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  assert.equal(queries.length,3,'manual mobile crop must rerun the catalogue search');
  assert.ok(queries[2].region,'manual crop must be sent as a region, not silently widened to the full image');
  assert.ok(Math.abs(queries[2].region.x-.1)<.04,JSON.stringify(queries[2].region));
  assert.ok(Math.abs(queries[2].region.y-.45)<.05,JSON.stringify(queries[2].region));
  await page.getByText('برش انتخاب‌شده و فعال است').waitFor();
  await page.screenshot({path:path.join(os.tmpdir(),'sanat-forza-vision-auto-inline-mobile.png'),fullPage:true});
  assert.equal(await page.getByTestId('kiki-inline-catalog-results').count(),1,'results stay beside the selected image without a separate results page');
  assert.equal(uploads,0);
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('AUTO_REGION_DETECTION_INLINE_CATALOG_RESULTS_MOBILE_OK');
 }finally{await browser?.close();await server?.close();await fs.rm(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
