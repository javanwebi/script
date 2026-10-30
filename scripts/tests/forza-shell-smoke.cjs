/* Isolated real-Chromium route smoke. No production writes or API calls. */
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage']});
 let failed=false;
 for(const mode of ['database-online','database-offline','production-remote']){
  const context=await browser.newContext({viewport:{width:1280,height:800},permissions:[]});
  const page=await context.newPage();
  const errors=[], network=[];
  page.on('pageerror',error=>errors.push(String(error.stack||error).slice(0,1000)));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,500));});
  page.on('requestfailed',r=>network.push(r.url().slice(0,180)+' '+r.failure()?.errorText));
  if(mode!=='production-remote') await page.route('**/api/runtime',route=>mode==='database-online'
    ?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,database:true,products:[],values:{},versions:{},userId:null})})
    :route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'database not available'})}));
  if(mode!=='production-remote') await page.route('**/api/portal',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,user:null})}));
  try{
   const result=await page.goto(mode==='production-remote'?'https://sanatpish-production.up.railway.app/ai-forza':'http://127.0.0.1:4173/ai-forza',{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForTimeout(mode==='production-remote'?20000:12000);
   const body=await page.locator('body').innerText();
   const stage=await page.locator('.forza-stage').count();
   const hud=await page.locator('.forza-hud').count();
   const rootHTML=(await page.locator('#root').innerHTML()).slice(0,600);
   const screenshot='/tmp/forza-'+mode+'.png';await page.screenshot({path:screenshot,timeout:12000}).catch(()=>{});
   console.log(JSON.stringify({mode,http:result?.status(),stage,hud,rootHTML:rootHTML.slice(0,150),body:body.slice(0,220),errors,network:network.slice(0,12),screenshot}));
   if(stage<1||hud<1||!rootHTML||errors.some(s=>/uncaught|Uncaught|rendered more|Cannot read|TypeError:|ReferenceError:|Error creating WebGL/i.test(s)))failed=true;
  }catch(e){failed=true;console.log(JSON.stringify({mode,testError:String(e),errors,network}));}
  await context.close();
 }
 await browser.close();
 if(failed)process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1});
