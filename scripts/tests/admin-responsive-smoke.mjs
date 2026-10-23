import { chromium } from 'playwright';
const ports = [390,1440];
let problems = [];
for (const width of ports) {
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width,height:850},deviceScaleFactor:1});
 await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/portal')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,revision:1,admin:true,user:null,values:{}})});
   if(path==='/api/runtime')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,database:true,userId:null,values:{},versions:{},products:[]})});
   if(path==='/api/admin/reports')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,period:'30',currency:'IRT',overview:{order_count:0,revenue:'0',avg_order:'0'},topProducts:[],topCustomers:[],topAgencies:[],trend:[],categories:[]})});
   return route.fulfill({status:404,contentType:'application/json',body:'{"success":false}'});
 });
 page.on('pageerror', e=>problems.push(width+': '+e.message));
 await page.goto('http://127.0.0.1:4173/admin',{waitUntil:'domcontentloaded',timeout:20000});
 await page.getByRole('navigation',{name:'بخش‌های پنل مدیریت'}).waitFor({timeout:15000});
 if(width<768)await page.getByRole('button',{name:/menu/i}).count().then(()=>{});
 const nav=page.getByRole('navigation',{name:'بخش‌های پنل مدیریت'});
 for(const title of ['داشبورد و گزارش‌ها','سفارش‌ها و لجستیک','استعلام و پیش‌فاکتور','مشتریان و CRM','اعتبار و قیمت‌ها','نمایندگی‌ها','کاتالوگ و کالاها','ورود گروهی کالا','مدیریت محتوا','اطلاعیه‌ها','مشتریان ما','تنظیمات و امنیت']){
   try{
     if(width<768)await page.locator('header button').first().click();
     await nav.getByRole('button',{name:new RegExp(title)}).click({timeout:7000});
     await page.waitForTimeout(120);
     if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+12))problems.push(width+': horizontal overflow in '+title);
   }catch(err){problems.push(width+': '+title+': '+err.message.slice(0,160))}
 }
 await page.screenshot({path:'/tmp/admin-'+width+'.png',fullPage:true});
 await browser.close();
}
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}else console.log('Admin modules responsive smoke passed on desktop and mobile.');
