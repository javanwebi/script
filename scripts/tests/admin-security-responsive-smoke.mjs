import {chromium} from 'playwright';

const issues=[];
const settings={
 id:'global',updatedAt:'2026-11-05T00:00:00.000Z',
 paymentGateway:{provider:'mellat',merchantId:'',terminalId:'',sandbox:true},
 smsProvider:{provider:'smsir',senderNumber:'',configured:true,ready:true},
 shippingMethods:{barbari:true,tipax:true,expressPost:true,dedicatedFleet:false},
 currency:'toman',
 seo:{metaTitle:'صنعت پیش',metaDescription:'',keywords:'',canonicalBase:'https://sanatpish.com'}
};
for(const width of [390,1440]){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width,height:880}});
  const saved=[];
  page.on('pageerror',e=>issues.push(width+': '+e.message));
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(path==='/api/portal')return reply({success:true,revision:1,admin:true,user:{authUserId:'owner',fullName:'مدیر اصلی',username:'admin'},values:{}});
   if(path==='/api/runtime')return reply({success:true,database:true,userId:'owner',values:{},versions:{},products:[]});
   if(path==='/api/admin/security/overview')return reply({
    success:true,db:{name:'postgres',bytes:'102400000',checked_at:'2026-11-05T00:00:00.000Z',started_at:'2026-11-04T00:00:00.000Z'},
    counts:{profiles:12,staff:3,active_staff:2,audits:7,sms:4,tables:49},sms:{provider:'SMS.ir',configured:true,ready:true}
   });
   if(path==='/api/admin/security/settings'){
    if(route.request().method()==='PUT'){
     const body=route.request().postDataJSON();saved.push(body);
     if(body.section==='payment')settings.paymentGateway={...settings.paymentGateway,...body.data};
     settings.updatedAt='2026-11-05T00:00:01.000Z';
    }
    return reply({success:true,settings});
   }
   if(path==='/api/admin/security/activity')return reply({success:true,rows:[],hasMore:false,page:1});
   if(path==='/api/admin/security/sms-logs')return reply({success:true,rows:[]});
   return reply({success:false,message:'No mock handler'},404);
  });
  await page.goto('http://127.0.0.1:4173/admin/settings',{waitUntil:'domcontentloaded',timeout:25000});
  await page.getByRole('heading',{name:'مرکز تنظیمات و امنیت'}).waitFor({timeout:20000});
  await page.getByText('اتصال دیتابیس تأیید شد').waitFor({timeout:12000});
  await page.getByRole('button',{name:/ورود و امنیت/}).click();
  await page.getByRole('link',{name:/بازکردن مدیریت کاربران و دسترسی‌ها/}).waitFor();
  if(await page.getByRole('button',{name:/ایجاد کاربر جدید/}).count())issues.push(width+': duplicated staff form');
  await page.getByRole('button',{name:/درگاه‌های پرداخت/}).click();
  await page.getByRole('combobox',{name:/درگاه پیش‌فرض/}).selectOption('saman');
  await page.getByRole('button',{name:/ذخیره تغییرات پرداخت/}).click();
  await page.getByText('تنظیمات در PostgreSQL ذخیره شد.').waitFor({timeout:10000});
  if(saved[0]?.section!=='payment'||saved[0]?.data?.provider!=='saman')issues.push(width+': wrong payment API payload');
  await page.getByRole('button',{name:/داده‌ها و پشتیبان/}).click();
  await page.getByText('دریافت داده‌های پایگاه داده').waitFor();
  if(await page.getByText('بازنشانی داده‌های اولیه').count())issues.push(width+': reset control still exists');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+12);
  if(overflow)issues.push(width+': unexpected horizontal page overflow');
  await page.screenshot({path:'/tmp/admin-security-'+width+'.png',fullPage:true});
 }catch(e){issues.push(width+': '+String(e.message||e).slice(0,420));}
 finally{await browser.close();}
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
else console.log('Live security center mobile/desktop UI smoke passed.');
