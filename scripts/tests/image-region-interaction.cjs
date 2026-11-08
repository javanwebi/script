/* Real pointer/touch smoke against the source component, isolated from customer data. */
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=process.cwd();const fixture=await fs.mkdtemp(path.join(root,'.region-smoke-'));
 let server,browser;
 try{
  const {createServer}=await import('vite');
  await fs.writeFile(path.join(fixture,'index.html'),'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./entry.tsx"></script>');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#bcc4c9"/><circle cx="600" cy="250" r="70" fill="#e56b1e"/><rect x="150" y="150" width="140" height="140" fill="#55565a"/></svg>';
  const source='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
  await fs.writeFile(path.join(fixture,'entry.tsx'),`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ImageRegionSelector} from '/src/components/search/ImageRegionSelector.tsx';import '/src/index.css';function App(){const [region,setRegion]=useState();return <ImageRegionSelector src={${JSON.stringify(source)}} value={region} candidateRegions={[{x:0.53,y:0.36,width:0.14,height:0.28},{x:0.15,y:0.3,width:0.14,height:0.28}]} onChange={r=>{window.lastRegion=r || null;setRegion(r)}}/>}createRoot(document.getElementById('root')).render(<App/>);`);
  await fs.writeFile(path.join(fixture,'auth.ts'),"export const useAuth=()=>({currentUser:null,openAuthModal:()=>{},activeRole:'guest',priceLayer:'retail'});");
  await fs.writeFile(path.join(fixture,'cart.ts'),"export const useCart=()=>({addItem:()=>{}});");
  server=await createServer({root,logLevel:'error',resolve:{alias:[{find:/.*\/context\/AuthContext$/,replacement:path.join(fixture,'auth.ts')},{find:/.*\/context\/CartContext$/,replacement:path.join(fixture,'cart.ts')}]},server:{host:'127.0.0.1',port:0}});await server.listen();
  browser=await chromium.launch({headless:true});
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1000,height:900},hasTouch:mobile,isMobile:mobile});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/index.html`);
   const image=page.getByAltText('عکس ارسالی؛ ناحیه قطعه را انتخاب کنید');await image.waitFor();
   await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth===1000);
   const box=await image.boundingBox();const x=box.x+box.width*0.6,y=box.y+box.height*0.5;
   if(mobile)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
   await page.getByText('پیش‌نمایش برش').waitFor();
   await page.screenshot({path:path.join(os.tmpdir(),`sanat-region-${mobile?'touch':'desktop'}.png`)});
   let r=await page.evaluate(()=>window.lastRegion);assert.ok(Math.abs(r.x+r.width/2-0.6)<0.01);assert.ok(Math.abs(r.y+r.height/2-0.5)<0.01);
   if(mobile){await page.mouse.click(box.x+box.width*0.45,box.y+box.height*0.9);assert.deepEqual(await page.evaluate(()=>window.lastRegion),r);}
   if(!mobile){
    await page.mouse.move(box.x+box.width*0.12,box.y+box.height*0.2);await page.mouse.down();await page.mouse.move(box.x+box.width*0.32,box.y+box.height*0.7,{steps:8});await page.mouse.up();
    r=await page.evaluate(()=>window.lastRegion);assert.ok(Math.abs(r.width-0.2)<0.01);assert.ok(Math.abs(r.height-0.5)<0.01);
    await page.getByRole('group').press('ArrowRight');assert.ok((await page.evaluate(()=>window.lastRegion)).x>r.x);
   }
   await page.getByRole('button',{name:'جست‌وجوی کل تصویر'}).click();assert.equal(await page.evaluate(()=>window.lastRegion),null);
   assert.deepEqual(errors,[]);await context.close();console.log(mobile?'TOUCH_SELECTION_OK':'POINTER_DRAG_KEYBOARD_OK');
  }
  // Mount the actual modal with isolated identity/cart hooks and mock only HTTP.
  await fs.writeFile(path.join(fixture,'modal.html'),'<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./modal.tsx"></script>');
  await fs.writeFile(path.join(fixture,'modal.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {AiVisualPartSearchModal} from '/src/components/search/AiVisualPartSearchModal.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(<MemoryRouter><AiVisualPartSearchModal isOpen={true} onClose={()=>{}}/></MemoryRouter>);`);
  const page=await browser.newPage({viewport:{width:1000,height:1000}});let uploads=0;const queries=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;let body={success:true,values:{},products:[]};
   if(pathname==='/api/ai/local-vision-status')body={enabled:true,pipeline:'local-lens-v3',ready:true,total:869,indexed:869};
   if(pathname==='/api/ai/customer-images'){uploads++;body={imageUrl:'/api/ai/customer-images/isolated-test.png'};}
   if(pathname==='/api/ai/analyze-part'){
    const request=route.request().postDataJSON();queries.push(request);
    body={success:true,isAiGenerated:true,stage:'quick',summary:{detectedPartType:'قطعه',detectedProfile:'',visualAnalysis:'',confidence:0},matchedProducts:[],modelSuggestions:[],nearestCatalogSuggestions:[{code:'unrelated-test',name:'محصول نامرتبط نباید نمایش داده شود',familyCode:'unrelated',familyName:'نامرتبط',imageScope:'variant',matchBasis:'explore',specs:[],reason:'test'}],technicalAdvice:'',customerImageUrl:'/api/ai/customer-images/isolated-test.png',queryRegion:request.region || {x:0.4,y:0.3,width:0.2,height:0.3},queryRegions:[{x:0.4,y:0.3,width:0.2,height:0.3},{x:0.65,y:0.3,width:0.2,height:0.3}],scanCoverage:{total:869,compared:869,failed:0,complete:true,providerAvailable:true,failedImageIds:[]},retrieval:{mode:'local-embedding',total:869,indexed:869,ready:true,verifiedPool:0}};
   }
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(fixture)}/modal.html`);
  await page.locator('input[type=file]').first().setInputFiles({name:'isolated.png',mimeType:'image/png',buffer:await fs.readFile(path.join(os.tmpdir(),'sanat-region-touch.png'))});
  await page.getByText(/۸۶۹ از ۸۶۹ تصویر/).waitFor();assert.equal(await page.getByText('محصول نامرتبط نباید نمایش داده شود').count(),0);assert.equal(uploads,1);assert.equal(queries.length,1);assert.equal(queries[0].includeNearest,false);
  const modalImage=page.getByAltText('عکس ارسالی؛ ناحیه قطعه را انتخاب کنید');await modalImage.scrollIntoViewIfNeeded();const bounds=await modalImage.boundingBox();
  await page.mouse.click(bounds.x+bounds.width*0.72,bounds.y+bounds.height*0.4);
  await page.waitForTimeout(500);await page.getByText(/۸۶۹ از ۸۶۹ تصویر/).waitFor();assert.equal(queries.length,2);assert.ok(queries[1].region);assert.ok(Math.abs(queries[1].region.x-0.65)<0.01);assert.equal(uploads,1);
  await page.getByRole('button',{name:'جست‌وجوی کل عکس',exact:true}).click();await page.waitForTimeout(500);await page.getByText(/۸۶۹ از ۸۶۹ تصویر/).waitFor();assert.equal(queries.length,3);assert.equal(queries[2].region,undefined);assert.equal(uploads,1);assert.deepEqual(errors,[]);
  await page.close();console.log('AUTOMATIC_UPLOAD_TAP_REQUERY_AND_IMAGE_REUSE_OK');

 }finally{await browser?.close();await server?.close();await fs.rm(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
