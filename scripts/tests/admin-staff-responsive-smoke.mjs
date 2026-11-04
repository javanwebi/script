import {chromium} from 'playwright';

const issues=[];
const initial={
 id:'00000000-0000-4000-8000-000000000001',
 username:'catalog_editor',name:'کارمند آزمایشی تست',email:'test@staff.example',
 permissions:{products:['view','edit'],dashboard:['view']},active:true,
 createdAt:'2026-11-04T09:00:00Z',updatedAt:'2026-11-04T10:00:00Z',lastLogin:null
};
for(const width of [390,1440]){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width,height:900}});
  const records=[structuredClone(initial)];
  const requests=[];
  page.on('pageerror',e=>issues.push(width+': browser error '+e.message));
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),pathname=url.pathname;
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(pathname==='/api/portal')return json({success:true,revision:1,admin:true,user:{authUserId:'owner',fullName:'مدیر اصلی',username:'admin'},values:{}});
   if(pathname==='/api/runtime')return json({success:true,database:true,userId:'owner',values:{},versions:{},products:[]});
   if(pathname==='/api/admin/staff/events')return route.fulfill({status:200,contentType:'text/event-stream',body:'retry: 5000\n\n'});
   if(pathname==='/api/admin/staff' && route.request().method()==='GET')return json({success:true,users:records});
   if(pathname==='/api/admin/staff' && route.request().method()==='POST'){
    const body=route.request().postDataJSON();requests.push(body);
    records.unshift({id:'00000000-0000-4000-8000-000000000002',...body,password:undefined,createdAt:new Date().toISOString(),active:true});
    return json({success:true,id:records[0].id},201);
   }
   if(pathname.startsWith('/api/admin/staff/'))return json({success:true});
   return json({success:false},404);
  });
  await page.goto('http://127.0.0.1:4173/admin/staff-users',{waitUntil:'domcontentloaded',timeout:25000});
  await page.getByText('کاربران و دسترسی‌های سازمانی').waitFor({timeout:25000});
  await page.getByText('کارمند آزمایشی تست').waitFor({timeout:12000});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+12);
  if(overflow)issues.push(width+': horizontal overflow');
  await page.getByRole('button',{name:/ایجاد کاربر جدید/}).click();
  await page.getByPlaceholder('نام کامل کارمند').fill('کاربر نمونه تازه');
  await page.getByPlaceholder('catalog_editor').fill('test_staff_user');
  await page.getByPlaceholder('staff@example.com').fill('new@staff.example');
  await page.getByPlaceholder('حداقل ۱۲ کاراکتر').first().fill('secure-test-password-2026');
  await page.getByRole('checkbox',{name:'مشاهده کاتالوگ و کالاها'}).check();
  await page.getByRole('button',{name:'ایجاد حساب واقعی'}).click();
  await page.getByText('کاربر جدید در سیستم احراز هویت ایجاد شد.').waitFor({timeout:15000});
  if(requests.length!==1 || requests[0].username!=='test_staff_user' ||
      requests[0].permissions?.products?.includes('view')!==true)issues.push(width+': bad creation payload');
  await page.getByText('کاربر نمونه تازه').waitFor({timeout:7000});
  await page.screenshot({path:'/tmp/admin-staff-'+width+'.png',fullPage:true});
 }catch(error){issues.push(width+': '+String(error.message||error).slice(0,500));}
 finally{await browser.close();}
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
else console.log('Admin staff live API UI responsive smoke passed on mobile and desktop.');
