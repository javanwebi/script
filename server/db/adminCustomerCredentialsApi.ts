/**
 * Owner-managed customer login provisioning. Supabase Auth is authoritative
 * for passwords; CRM never stores a retrievable password or impersonation token.
 */
import type {Express,Request,Response} from 'express';
import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {database,adoptedSchema,databaseEnabled,transaction,type SqlClient} from './connection';
import {getPortalIdentity} from '../../api/portal';
import {normalizeCrmPhone} from './adminCustomersApi';

const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
const usernameRule=/^[a-z][a-z0-9_]{3,31}$/;
const customerIdRule=/^[0-9a-f-]{36}$/i;
const loginUrl='https://www.sanatpish.com/login';
export const defaultCredentialSmsTemplate='صنعت پیش\n{smsName} عزیز، پنل شما فعال شد.\nنام کاربری: {username}\nرمز اولیه: {password}\nورود: {loginUrl}\nپس از ورود رمز خود را تغییر دهید.';
const clean=(value:unknown,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';

function adminAuth(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw fail(503,'اتصال مدیریتی Supabase Auth هنوز تنظیم نشده است.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function owner(req:Request,res:Response){
 if(!databaseEnabled()||!adoptedSchema())throw fail(503,'مدیریت حساب مشتری فقط روی دیتابیس اصلی فعال است.');
 const identity=await getPortalIdentity(req);
 if(!identity.admin||!identity.user?.authUserId)throw fail(403,'ساخت و بازنشانی رمز مشتری فقط برای مدیر اصلی مجاز است.');
 if(req.method!=='GET'){
  if(!req.is('application/json'))throw fail(415,'فرمت درخواست نامعتبر است.');
  if(req.headers.origin){
   let host='';try{host=new URL(req.headers.origin).host;}catch{throw fail(403,'مبدأ درخواست معتبر نیست.');}
   if(host!==req.headers.host)throw fail(403,'مبدأ درخواست معتبر نیست.');
  }
 }
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Cookie');
 return identity;
}
function errorResponse(res:Response,e:unknown){
 const ex=e as {status?:number;code?:string;message?:string};
 const status=ex.code==='23505'?409:ex.status||503;
 if(status>=500)console.error('[Customer credentials]',ex.code||'service_unavailable');
 return res.status(status).json({success:false,message:status>=500?'سرویس ساخت حساب در دسترس نیست؛ اطلاعات حساب را بررسی کنید.':ex.message||'درخواست انجام نشد.'});
}
function validateCredentials(body:any,phone:string){
 const username=clean(body?.username,64).toLowerCase();
 const password=body?.password;
 if(!usernameRule.test(username))throw fail(400,'نام کاربری باید ۴ تا ۳۲ نویسه انگلیسی باشد و با حرف شروع شود.');
 if(typeof password!=='string'||password.length<12||password.length>128||password.includes('\u0000')||
    password.toLowerCase()===username || password===phone || password===phone.slice(-10))
  throw fail(400,'رمز اولیه باید حداقل ۱۲ نویسه و متفاوت از نام کاربری و شماره موبایل باشد.');
 return {username,password};
}
function parseKey(raw:unknown){
 const key=clean(raw,180);
 if(key.startsWith('crm:') && key.length>4 && !/[\u0000-\u001f]/.test(key))return {source:'crm' as const,id:key.slice(4)};
 if(key.startsWith('profile:')&&customerIdRule.test(key.slice(8)))return {source:'profile' as const,id:key.slice(8)};
 throw fail(400,'شناسه مشتری نامعتبر است.');
}
async function audit(client:SqlClient,identity:Awaited<ReturnType<typeof getPortalIdentity>>,action:string,target:string){
 await client.query(
  "insert into public.audit_logs(id,user_id,user_name,user_role,action,entity,target,details,extra_payload) values($1,$2,$3,'super_admin',$4,'customer_accounts',$5,$6,'{}'::jsonb)",
  ['crm-credentials-'+crypto.randomUUID(),identity.user?.authUserId,identity.user?.fullName||'مدیریت',action,target,'عملیات مدیریتی حساب مشتری؛ بدون ذخیره رمز یا متن پیامک']
 );
}
function smsEnabled(){
 return process.env.SMS_PROVIDER!=='kavenegar' && process.env.SMSIR_CRM_ENABLED==='true'
  && Boolean(process.env.SMSIR_API_KEY) && /^[0-9]{6,18}$/.test(process.env.SMSIR_LINE_NUMBER||'');
}
export function renderCrmCredentialSms(template:string,values:{username:string;password:string;smsName:string}):string{
 const source=template.trim();
 if(source.length<15||source.length>800)throw fail(400,'متن پیامک باید بین ۱۵ تا ۸۰۰ نویسه باشد.');
 if(!source.includes('{username}')||!source.includes('{password}'))
  throw fail(400,'متن پیامک باید نام کاربری و رمز اولیه را با {username} و {password} شامل شود.');
 const unknown=[...source.matchAll(/\{([^{}]+)\}/g)].map(match=>match[1])
   .filter(token=>!['username','password','smsName','loginUrl'].includes(token));
 if(unknown.length)throw fail(400,'متغیر ناشناخته در متن پیامک وجود دارد.');
 const rendered=source.replace(/\{(username|password|smsName|loginUrl)\}/g,(_,name)=>
  name==='loginUrl'?loginUrl:values[name as keyof typeof values]);
 if(rendered.length>900)throw fail(400,'متن نهایی پیامک بیش از حد مجاز است.');
 return rendered;
}
async function sendCrmCredentialSms(phone:string,message:string){
 if(!smsEnabled())throw fail(503,'پنل ارسال پیامک حساب مشتری هنوز فعال نشده است.');
 // This is a single-recipient bulk send using the official SMS.ir v1 contract.
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetch('https://api.sms.ir/v1/send/bulk',{
   method:'POST',signal:controller.signal,
   headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':process.env.SMSIR_API_KEY!},
   body:JSON.stringify({lineNumber:Number(process.env.SMSIR_LINE_NUMBER),messageText:message,mobiles:[phone],sendDateTime:null})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.status!==1||!body.data?.messageIds?.some((id:unknown)=>Number(id)>0))
   throw fail(503,'ارسال پیامک تأیید نشد.');
 }finally{clearTimeout(timer);}
}
async function findCrm(client:SqlClient,id:string){
 const q=await client.query("select id,auth_user_id,name,company,phone,email,province,city,approved_b2b,approval_status,grade_code,assigned_price_list_id,credit_limit,used_credit,wallet_balance,points from public.crm_customers where id=$1 for update",[id]);
 if(!q.rowCount)throw fail(404,'مخاطب CRM پیدا نشد.');
 return q.rows[0];
}
async function profileForReset(client:SqlClient,key:ReturnType<typeof parseKey>){
 const id=key.source==='crm'?(await findCrm(client,key.id)).auth_user_id:key.id;
 if(!id)throw fail(409,'حساب ورود هنوز ساخته نشده است؛ از ساخت حساب استفاده کنید.');
 const record=await client.query("select id,username,phone,role::text as role,full_name from public.user_profiles where id=$1 and role in ('client','club') for update",[id]);
 if(!record.rowCount)throw fail(403,'این کاربر حساب مشتری معمولی یا عمده ندارد.');
 const profile=record.rows[0];
 if(!profile.phone)throw fail(409,'شماره موبایل برای این حساب ثبت نشده است.');
 return profile as {id:string;username:string|null;phone:string;full_name:string};
}
async function uniqueUsername(client:SqlClient,username:string,exceptId?:string){
 await client.query('select pg_advisory_xact_lock(hashtext($1))',['customer-username:'+username]);
 const old=await client.query('select id from public.user_profiles where lower(username)=$1 and ($2::uuid is null or id<>$2::uuid) limit 1',[username,exceptId||null]);
 if(old.rowCount)throw fail(409,'نام کاربری قبلاً استفاده شده است.');
}
export function registerAdminCustomerCredentialsApi(app:Express){
 app.get('/api/admin/crm/credentials/config',async(req,res)=>{
  try{await owner(req,res);res.json({success:true,smsConfigured:smsEnabled(),loginUrl,defaultTemplate:defaultCredentialSmsTemplate});}
  catch(e){errorResponse(res,e);}
 });
 app.post('/api/admin/crm/customers/:key/credentials',async(req,res)=>{
  try{
   const identity=await owner(req,res);
   const key=parseKey(req.params.key);
   const op=req.body?.operation==='reset'?'reset':req.body?.operation==='create'?'create':null;
   if(!op)throw fail(400,'عملیات ساخت یا بازنشانی مشخص نیست.');
   if(op==='create'&&key.source!=='crm')throw fail(409,'برای این مشتری حساب ورود ثبت شده است؛ از بازنشانی رمز استفاده کنید.');
   if(op==='reset'&&key.source==='profile'&&!customerIdRule.test(key.id))throw fail(400,'شناسه کاربر معتبر نیست.');
   const doSms=req.body?.sendSms===true;
   if(doSms&&!smsEnabled())throw fail(503,'اتصال ارسال پیامک CRM هنوز فعال نشده است.');
   const template=doSms?clean(req.body?.messageTemplate,800):'';
   const client=database();
   let createdId:string|undefined;
   let selectedPhone='';
   let displayName='';
   let username='';
   // Validate the chosen SMS before changing Auth credentials.
   if(doSms)renderCrmCredentialSms(template,{
    username:clean(req.body?.username,64),password:String(req.body?.password||''),
    smsName:'م'.repeat(160)
   });
   try{
    if(op==='create'){
      // Do not hold a CRM row lock while calling Supabase Auth: the verified
      // phone trigger itself may acquire a CRM row lock.
      const preview=(await client.query("select id,auth_user_id,name,phone from public.crm_customers where id=$1",[key.id])).rows[0];
      if(!preview)throw fail(404,'مخاطب CRM پیدا نشد.');
      if(preview.auth_user_id)throw fail(409,'این مشتری حساب ورود دارد؛ رمز را بازنشانی کنید.');
      selectedPhone=normalizeCrmPhone(preview.phone);
      displayName=preview.name||'مشتری';
      const chosen=validateCredentials(req.body,selectedPhone);username=chosen.username;
      const conflicts=await client.query(
       "select id from public.user_profiles where lower(username)=$1 or right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10)=$2 "+
       "union all select id from auth.users where right(regexp_replace(coalesce(phone,''),'[^0-9]','','g'),10)=$2 limit 1",
       [username,selectedPhone.slice(-10)]);
      if(conflicts.rowCount)throw fail(409,'نام کاربری یا شماره تلفن قبلاً برای حساب دیگری ثبت شده است.');
      const create=await adminAuth().auth.admin.createUser({
       phone:'+98'+selectedPhone.slice(1),password:chosen.password,phone_confirm:true,
       app_metadata:{account_kind:'customer',provisioned_by:'crm'}
      });
      if(create.error||!create.data.user)throw fail(503,'ساخت حساب در Supabase Auth انجام نشد.');
      createdId=create.data.user.id;
      await transaction(async tx=>{
       const record=await findCrm(tx,key.id);
       if(record.auth_user_id && record.auth_user_id!==createdId)throw fail(409,'این مشتری هم‌زمان به حساب دیگری متصل شده است.');
       await uniqueUsername(tx,username,createdId);
       const approved=record.approved_b2b===true&&record.approval_status==='approved';
       await tx.query(
        "insert into public.user_profiles(id,legacy_user_id,phone,email,username,full_name,company_name,role,status,approved_b2b,can_view_prices,can_view_stock,province,city,grade_code,assigned_price_list_id,credit_limit,credit_used,wallet_balance,club_points,preferences) "+
        "values($1,$2,$3,$4,$5,$6,$7,$8::public.app_role_type,'active',$9,true,true,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb) "+
        "on conflict(id) do update set username=excluded.username,full_name=excluded.full_name,company_name=excluded.company_name,phone=excluded.phone,email=excluded.email,role=excluded.role,approved_b2b=excluded.approved_b2b,preferences=user_profiles.preferences||excluded.preferences,updated_at=now()",
        [createdId,record.id,selectedPhone,record.email||null,username,record.name,record.company,
         approved?'club':'client',approved,record.province,record.city,
         approved?record.grade_code:null,approved?record.assigned_price_list_id:null,
         approved?record.credit_limit:0,approved?record.used_credit:0,approved?record.wallet_balance:0,
         approved?record.points:0,JSON.stringify({mustChangePassword:true,onboardingCompleted:approved})]
       );
       const link=await tx.query('update public.crm_customers set auth_user_id=$2,updated_at=now() where id=$1 and (auth_user_id is null or auth_user_id=$2) returning id',[record.id,createdId]);
       if(!link.rowCount)throw fail(409,'اتصال CRM به حساب جدید ناموفق بود.');
       await audit(tx,identity,'ایجاد حساب ورود مشتری',key.id);
      });
    }else{
      await transaction(async tx=>{
       const profile=await profileForReset(tx,key);
       selectedPhone=normalizeCrmPhone(profile.phone);
       displayName=profile.full_name||'مشتری';
       const chosen=validateCredentials(req.body,selectedPhone);username=chosen.username;
       await uniqueUsername(tx,username,profile.id);
       const result=await adminAuth().auth.admin.updateUserById(profile.id,{password:chosen.password});
       if(result.error)throw fail(503,'بازنشانی رمز در Supabase Auth انجام نشد.');
       await tx.query(
        "update public.user_profiles set username=$2,preferences=preferences||'{\"mustChangePassword\":true}'::jsonb,updated_at=now() where id=$1",
        [profile.id,username]);
       await audit(tx,identity,'بازنشانی رمز اولیه مشتری',key.id);
      });
    }
   }catch(e){
    if(createdId){
      // Never delete an existing identity. Only attempt to roll back a newly
      // provisioned Auth user after a failed CRM linking transaction.
      try{await adminAuth().auth.admin.deleteUser(createdId);}
      catch{console.error('[Customer credentials] New Auth rollback unavailable');}
    }
    throw e;
   }
   const smsBody=doSms?renderCrmCredentialSms(template,{username,password:req.body.password,smsName:displayName}):null;
   let smsSent=false;
   let smsWarning='';
   if(doSms&&smsBody){
    try{await sendCrmCredentialSms(selectedPhone,smsBody);smsSent=true;}
    catch{smsWarning='حساب ذخیره شد اما پیامک ارسال نشد؛ اطلاعات ورود را از همین صفحه به‌صورت امن تحویل دهید.';}
   }
   // Password is deliberately absent from API responses and all audit/log records.
   res.status(op==='create'?201:200).json({success:true,username,phone:selectedPhone,hasLogin:true,smsSent,smsWarning,
    message:op==='create'?'حساب واقعی مشتری در Supabase Auth ایجاد شد.':'رمز اولیه حساب واقعی مشتری بازنشانی شد.'});
  }catch(e){errorResponse(res,e);}
 });
}
