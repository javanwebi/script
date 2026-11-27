/* Real desktop/mobile automatic-crop smoke against the actual FORZA modal. */
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const root=process.cwd();
 const fixture=await fs.mkdtemp(path.join(root,'automatic-crop-smoke-'));
 let server,browser;
 try{
  const {createServer}=await import('vite');
  const sharp=(await import('sharp')).default;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600"><rect width="1000" height="600" fill="#d9dde0"/><rect x="370" y="170" width="220" height="260" rx="28" fill="#24272b"/><circle cx="480" cy="300" r="72" fill="#e56b1e"/><text x="480" y="315" font-size="44" text-anchor="middle" fill="white">A49</text><rect x="690" y="190" width="170" height="230" rx="28" fill="#55565a"/><circle cx="775" cy="305" r="52" fill="#e56b1e"/><text x="775" y="320" font-size="38" text-anchor="middle" fill="white">B62</text></svg>';
  const imageBuffer=await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(fixture,'index.html'),'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./modal.tsx"></script>');
  await fs.writeFile(path.join(fixture,'auth.ts'),"export const useAuth=()=>({currentUser:null,openAuthModal:()=>{},activeRole:'guest',priceLayer:'retail'});");
  await fs.writeFile(path.join(fixture,'cart.ts'),"export const useCart=()=>({addItem:()=>{}});");
  await fs.writeFile(path.join(fixture,'modal.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {AiVisualPartSearchModal} from '/src/components/search/AiVisualPartSearchModal.tsx';import '/src/index.css';function RouteProbe(){const location=useLocation();window.__kikiPath=location.pathname;return null;}createRoot(document.getElementById('root')).render(<MemoryRouter><RouteProbe/><AiVisualPartSearchModal isOpen={true} onClose={()=>{}}/></MemoryRouter>);`);
  server=await createServer({root,logLevel:'error',resolve:{alias:[{find:/.*\/context\/AuthContext$/,replacement:path.join(fixture,'auth.ts')},{find:/.*\/context\/CartContext$/,replacement:path.join(fixture,'cart.ts')}]},server:{host:'127.0.0.1',port:0}});
  await server.listen();
  browser=await chromium.launch({headless:true});

  let detectionMode='matched';
  let uploads=0;
  const detections=[],queries=[],errors=[];
  const installRoutes=async page=>{
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let body={success:true,values:{},products:[]};
    if(pathname==='/api/ai/local-vision-status'){
     body={enabled:true,pipeline:'local-lens-v2',ready:true,total:869,indexed:869};
    }
    if(pathname==='/api/ai/customer-images'){
     uploads++;body={imageUrl:'/api/ai/customer-images/isolated-test.png'};
    }
    if(pathname==='/api/ai/detect-regions'){
     const request=route.request().postDataJSON();detections.push(request);
     body=detectionMode==='matched'
      ? {success:true,detectionId:'test-detection-id',autoDetected:true,queryRegion:{x:0.37,y:0.27,width:0.26,height:0.46},queryRegions:[{x:0.37,y:0.27,width:0.26,height:0.46},{x:0.67,y:0.28,width:0.2,height:0.44}],model:'dinov2-test',pipeline:'local-lens-v2',elapsedMs:120}
      : {success:true,detectionId:'test-no-confident-crop',autoDetected:false,queryRegion:null,queryRegions:[{x:0.37,y:0.27,width:0.26,height:0.46},{x:0.67,y:0.28,width:0.2,height:0.44}],model:'dinov2-test',pipeline:'local-lens-v2',elapsedMs:120};
    }
    if(pathname==='/api/ai/analyze-part'){
     const request=route.request().postDataJSON();queries.push(request);
     await new Promise(resolve=>setTimeout(resolve,250));
     body={success:true,isAiGenerated:true,stage:'quick',summary:{detectedPartType:'قطعه صنعتی',detectedProfile:'A',visualAnalysis:'قطعه مشکی با نشانه A49',confidence:94},matchedProducts:Array.from({length:8},(_,index)=>({code:index===0?'TEST-A49':'TEST-A49-'+index,name:index===0?'قطعه صنعتی A-49':'قطعه صنعتی مشابه '+(index+1),brand:'FORZA',image:'data:image/svg+xml;base64,PHN2Zy8+',imageScope:'variant',similarityScore:94-index,visualVerdictFarsi:'تطبیق تصویری قوی',specs:[{key:'کد',value:index===0?'A-49':'A-'+(49+index)}],catalogProduct:{image:'data:image/svg+xml;base64,PHN2Zy8+',imageScope:'sku-verified',categoryName:'قطعات صنعتی'}})),similarCandidates:[],modelSuggestions:[],nearestCatalogSuggestions:[],catalogImageMatches:[],technicalAdvice:'',queryRegion:request.fullImage?undefined:request.region,queryRegions:request.fullImage?[]:[request.region],scanCoverage:{total:869,compared:869,failed:0,complete:true,providerAvailable:true,failedImageIds:[]},retrieval:{mode:'local-embedding',total:869,indexed:869,ready:true,verifiedPool:8},localVisionMetrics:{pipeline:'local-lens-v2',queryViews:2,geometryComplete:true,ocrAvailable:false,retrievalMs:120}};
    }
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   });
  };

  const page=await browser.newPage({viewport:{width:1280,height:960}});
  await installRoutes(page);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/index.html`);
  const firstAnalysisRequestPromise=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/ai/analyze-part');
  await page.locator('input[type=file]').first().setInputFiles({name:'industrial-part.png',mimeType:'image/png',buffer:imageBuffer});
  await page.getByTestId('image-region-review').waitFor();
  const candidate2=page.getByTestId('forza-region-candidate-2');
  await candidate2.waitFor({state:'visible'});
  const firstAnalysisRequest=await firstAnalysisRequestPromise;
  assert.deepEqual(firstAnalysisRequest.postDataJSON().region,{x:0.37,y:0.27,width:0.26,height:0.46});
  const secondAnalysisRequestPromise=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/ai/analyze-part');
  await candidate2.click();
  const secondAnalysisRequest=await secondAnalysisRequestPromise;
  assert.deepEqual(secondAnalysisRequest.postDataJSON().region,{x:0.67,y:0.28,width:0.2,height:0.44},'tapping the second detected object must send its exact crop');
  await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  await page.getByTestId('kiki-inline-catalog-results').waitFor({timeout:45000});
  assert.equal(detections.length,1,'all object proposals must come from one server detection request');
  assert.match(detections[0].imageBase64,/^data:image\/png;base64,/,'the server detector must receive the original uploaded image');
  assert.equal(queries.length,2,'switching objects must run a new catalog search without redetecting the image');
  assert.deepEqual(queries[0].region,{x:0.37,y:0.27,width:0.26,height:0.46},'the initial automatic crop must be searched');
  assert.deepEqual(queries[1].region,{x:0.67,y:0.28,width:0.2,height:0.44},'the second object crop must be searched');
  assert.equal(queries[1].detectionId,'test-detection-id','the second crop must reuse the original detection cache');
  assert.notEqual(queries[1].fullImage,true,'a verified object crop must not be widened to the full image');

  const review=page.getByTestId('image-region-review');
  assert.equal(await review.getAttribute('data-region-mode'),'automatic');
  const crop=page.getByTestId('forza-automatic-crop');
  assert.equal(await crop.getAttribute('data-crop-ready'),'true');
  assert.equal(await crop.getAttribute('data-region'),'0.67000,0.28000,0.20000,0.44000');
  const cropBox=crop.locator('.forza-auto-crop__candidate.is-selected');
  await cropBox.waitFor({state:'visible'});
  const overlay=await cropBox.evaluate(element=>({left:element.style.left,top:element.style.top,width:element.style.width,height:element.style.height,pointerEvents:getComputedStyle(element).pointerEvents}));
  assert.deepEqual(overlay,{left:'67%',top:'28%',width:'20%',height:'44%',pointerEvents:'auto'});
  await page.getByTestId('forza-automatic-crop-thumbnail').waitFor({state:'visible'});
  await page.getByText('قطعه پیدا شد؛ برش خودکار انجام شد').waitFor();
  assert.equal(await page.locator('.sanat-region-picker__frame,.sanat-region-picker__handle,.sanat-region-picker__draft,[data-testid="image-region-selector"]').count(),0,'the customer must not see any manual crop control');
  await page.screenshot({path:path.join('/tmp','forza-automatic-crop-desktop.png'),fullPage:true});

  const desktopImage=crop.locator('.forza-auto-crop__frame > img');
  const desktopImageBox=await desktopImage.boundingBox();assert.ok(desktopImageBox);
  const regionBeforeDrag=await review.getAttribute('data-selected-region');
  await page.mouse.move(desktopImageBox.x+desktopImageBox.width*.12,desktopImageBox.y+desktopImageBox.height*.18);
  await page.mouse.down();
  await page.mouse.move(desktopImageBox.x+desktopImageBox.width*.32,desktopImageBox.y+desktopImageBox.height*.72,{steps:8});
  await page.mouse.up();
  await page.waitForTimeout(180);
  assert.equal(await review.getAttribute('data-selected-region'),regionBeforeDrag,'desktop image dragging must never alter the AI-selected crop');
  assert.equal(queries.length,2,'desktop image dragging must not start a manual re-search');

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile workspace must not overflow horizontally');
  const mobileImage=crop.locator('.forza-auto-crop__frame > img');
  await mobileImage.waitFor({state:'visible'});
  const mobileFit=await crop.locator('.forza-auto-crop__frame').evaluate(frame=>{
   const image=frame.querySelector('img');
   const imageRect=image.getBoundingClientRect(),frameRect=frame.getBoundingClientRect();
   const imageStyle=getComputedStyle(image),frameStyle=getComputedStyle(frame);
   return {naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,width:imageRect.width,height:imageRect.height,frameWidth:frameRect.width,frameHeight:frameRect.height,objectFit:imageStyle.objectFit,imageBorder:imageStyle.borderTopWidth,frameBorder:frameStyle.borderTopWidth,frameShadow:frameStyle.boxShadow,displayRatio:imageRect.width/imageRect.height,naturalRatio:image.naturalWidth/image.naturalHeight};
  });
  assert.equal(mobileFit.objectFit,'contain','mobile viewer must preserve the complete uploaded image');
  assert.equal(mobileFit.imageBorder,'0px','uploaded image must not have an added white border');
  assert.equal(mobileFit.frameBorder,'0px','image holder must not draw an extra border');
  assert.equal(mobileFit.frameShadow,'none','image holder must not add a white frame shadow');
  assert.ok(mobileFit.width>0&&mobileFit.height>0&&mobileFit.width<=mobileFit.frameWidth+1&&mobileFit.height<=mobileFit.frameHeight+1,JSON.stringify(mobileFit));
  assert.ok(Math.abs(mobileFit.displayRatio-mobileFit.naturalRatio)<0.03,'mobile viewer must show the entire image without cropping or stretching');
  assert.equal(await crop.getByTestId('forza-region-candidate-2').evaluate(element=>getComputedStyle(element).pointerEvents),'auto','detected object proposals must remain tappable on mobile');
  assert.equal(await page.locator('.sanat-region-picker__frame,.sanat-region-picker__handle,.sanat-region-picker__draft,[data-testid="image-region-selector"]').count(),0,'mobile must not render manual crop controls');

  // The catalogue remains a draggable bottom sheet; only this handle is interactive.
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
  // Wait for the 280 ms CSS height transition to settle before measuring the sheet.
  await page.waitForFunction(()=> {
    const element=document.querySelector('.kiki-image-workspace__catalog');
    return element && element.getBoundingClientRect().height >= window.innerHeight * .48;
  },null,{timeout:5000});
  const halfSheetBox=await sheet.boundingBox();assert.ok(halfSheetBox);
  assert.ok(halfSheetBox.height>=844*.48&&halfSheetBox.height<=844*.60,'the mobile catalogue sheet must cover roughly half the viewport after its transition');
  const catalogueBody=page.locator('#kiki-image-workspace-catalog-body');
  assert.equal(await catalogueBody.evaluate(element=>getComputedStyle(element).overflowY),'auto','mobile result list must scroll independently');
  await catalogueBody.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await page.waitForTimeout(300);
  assert.ok(await catalogueBody.evaluate(element=>element.scrollTop>0),'the expanded mobile product list must scroll through all suggested products');
  const halfHandleBox=await sheetHandle.boundingBox();assert.ok(halfHandleBox);
  await page.mouse.move(halfHandleBox.x+halfHandleBox.width/2,halfHandleBox.y+halfHandleBox.height/2);
  await page.mouse.down();
  await page.mouse.move(halfHandleBox.x+halfHandleBox.width/2,halfHandleBox.y+halfHandleBox.height/2+115,{steps:8});
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.kiki-image-workspace__catalog')?.getAttribute('data-sheet-level')==='peek');

  const thirdAnalysisRequestPromise=page.waitForRequest(request=>new URL(request.url()).pathname==='/api/ai/analyze-part');
  await page.getByTestId('forza-region-candidate-1').click();
  const thirdAnalysisRequest=await thirdAnalysisRequestPromise;
  assert.deepEqual(thirdAnalysisRequest.postDataJSON().region,{x:0.37,y:0.27,width:0.26,height:0.46},'mobile tapping the first object must switch back to its automatic crop');
  await page.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  assert.equal(queries.length,3,'mobile object selection must trigger a fresh catalog query');
  assert.deepEqual(queries[2].region,{x:0.37,y:0.27,width:0.26,height:0.46});
  const mobileRegionBeforeDrag=await review.getAttribute('data-selected-region');
  const mobileImageBox=await mobileImage.boundingBox();assert.ok(mobileImageBox);
  await page.mouse.move(mobileImageBox.x+mobileImageBox.width*.1,mobileImageBox.y+mobileImageBox.height*.2);
  await page.mouse.down();
  await page.mouse.move(mobileImageBox.x+mobileImageBox.width*.34,mobileImageBox.y+mobileImageBox.height*.74,{steps:8});
  await page.mouse.up();
  await page.waitForTimeout(180);
  assert.equal(await review.getAttribute('data-selected-region'),mobileRegionBeforeDrag,'mobile image dragging must never create or alter a crop');
  assert.equal(queries.length,3,'dragging outside detected proposals must not start a manual re-search');
  assert.equal(await page.getByTestId('forza-automatic-crop-thumbnail').count(),1,'mobile must show the exact selected crop preview');
  await page.screenshot({path:path.join('/tmp','forza-automatic-crop-mobile.png'),fullPage:true});

  // Reopen the sheet with the same upward drag gesture a mobile customer uses.
  const reopenHandleBox=await sheetHandle.boundingBox();assert.ok(reopenHandleBox);
  await page.mouse.move(reopenHandleBox.x+reopenHandleBox.width/2,reopenHandleBox.y+reopenHandleBox.height/2);
  await page.mouse.down();
  await page.mouse.move(reopenHandleBox.x+reopenHandleBox.width/2,reopenHandleBox.y-115,{steps:8});
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.kiki-image-workspace__catalog')?.getAttribute('data-sheet-level')==='half');
  await page.waitForFunction(()=> {
    const element=document.querySelector('.kiki-image-workspace__catalog');
    return element && element.getBoundingClientRect().height >= window.innerHeight * .48;
  },null,{timeout:5000});
  await page.locator('[data-testid="kiki-inline-catalog-results"] button').first().click();
  await page.waitForFunction(()=>window.__kikiPath==='/product/TEST-A49');
  assert.equal(await page.evaluate(()=>window.__kikiPath),'/product/TEST-A49','catalog result must open its own product detail page');
  assert.equal(uploads,0,'customer image bytes must remain in the browser-local vault');
  assert.deepEqual(errors,[]);
  await page.close();

  // If the server cannot confirm a crop, never promote an arbitrary proposal.
  // Search the original full image and say clearly that no precise crop was used.
  detectionMode='no-match';
  const fallbackPage=await browser.newPage({viewport:{width:390,height:844}});
  await installRoutes(fallbackPage);
  await fallbackPage.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/index.html`);
  await fallbackPage.locator('input[type=file]').first().setInputFiles({name:'industrial-part-no-crop.png',mimeType:'image/png',buffer:imageBuffer});
  await fallbackPage.getByTestId('kiki-inline-catalog-results').waitFor({timeout:45000});
  await fallbackPage.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  assert.equal(detections.length,2);
  assert.equal(queries.length,4);
  assert.equal(queries[3].fullImage,true,'no confident crop must initially trigger full-image search');
  assert.equal(queries[3].region,undefined,'an unverified proposal must never be promoted to the initial crop');
  const fallbackCrop=fallbackPage.getByTestId('forza-automatic-crop');
  assert.equal(await fallbackCrop.getAttribute('data-crop-ready'),'false');
  assert.equal(await fallbackCrop.locator('.forza-auto-crop__bounds').count(),0,'no confirmed crop box may be displayed');
  assert.equal(await fallbackCrop.getByTestId('forza-automatic-crop-thumbnail').count(),0,'no unconfirmed crop preview may be displayed');
  assert.equal(await fallbackCrop.locator('.forza-auto-crop__candidate').count(),2,'the customer may still choose one of the detected proposals');
  await fallbackPage.getByText('ناحیه‌های پیشنهادی پیدا شدند').waitFor();
  const fallbackSecondRequestPromise=fallbackPage.waitForRequest(request=>new URL(request.url()).pathname==='/api/ai/analyze-part');
  const fallbackFrame=fallbackCrop.locator('.forza-auto-crop__frame');
  const fallbackFrameBox=await fallbackFrame.boundingBox();assert.ok(fallbackFrameBox);
  await fallbackFrame.click({position:{x:fallbackFrameBox.width*.88,y:fallbackFrameBox.height*.5}});
  const fallbackSecondRequest=await fallbackSecondRequestPromise;
  assert.deepEqual(fallbackSecondRequest.postDataJSON().region,{x:0.67,y:0.28,width:0.2,height:0.44});
  await fallbackPage.waitForFunction(()=>document.querySelector('[data-testid="image-region-review"]')?.getAttribute('aria-busy')==='false',null,{timeout:45000});
  assert.equal(queries.length,5);
  assert.deepEqual(queries[4].region,{x:0.67,y:0.28,width:0.2,height:0.44});
  assert.equal(queries[4].detectionId,'test-no-confident-crop');
  assert.equal(await fallbackCrop.getAttribute('data-crop-ready'),'true','a customer-selected detected proposal becomes the active crop');
  assert.equal(await fallbackCrop.getAttribute('data-region'),'0.67000,0.28000,0.20000,0.44000');
  assert.equal(await fallbackCrop.getByTestId('forza-automatic-crop-thumbnail').count(),1);
  assert.equal(await fallbackPage.locator('.sanat-region-picker__frame,.sanat-region-picker__handle,.sanat-region-picker__draft,[data-testid="image-region-selector"]').count(),0);
  assert.deepEqual(errors,[]);
  await fallbackPage.close();
  console.log('AUTOMATIC_MULTI_OBJECT_SELECTION_DESKTOP_MOBILE_OK');
  console.log('NO_CONFIDENT_CROP_FALLS_BACK_AND_ALLOWS_TAPPING_DETECTED_PROPOSALS_OK');
 }finally{
  await browser?.close();
  await server?.close();
  await fs.rm(fixture,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
