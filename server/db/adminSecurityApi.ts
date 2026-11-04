import type {Express,Request,Response} from 'express';
import {randomUUID} from 'node:crypto';
import {database,databaseEnabled,adoptedSchema} from './connection';
import {getPortalIdentity} from '../../api/portal';
import {smsConfigured} from '../../api/sms';
import {registerFullDataExport} from './adminFullDataExport';

export type SecurityOwner={id:string;name:string;email:string;phone:string};
export const securityError=(status:number,message:string)=>Object.assign(new Error(message),{status});
export async function securityOwner(req:Request):Promise<SecurityOwner>{
 if(!databaseEnabled()||!adoptedSchema())throw securityError(503,'دیتابیس اصلی PostgreSQL در دسترس نیست.');
 const who=await getPortalIdentity(req);
 if(!who.admin||!who.user?.authUserId)throw securityError(403,'تنها مدیر اصلی به تنظیمات امنیت دسترسی دارد.');
 if(req.method!=='GET' && (!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host))
  throw securityError(403,'مبدأ درخواست معتبر نیست.');
 return {id:String(who.user.authUserId),name:String(who.user.fullName||who.user.username||'مدیر اصلی'),
  email:String(who.user.email||''),phone:String(who.user.phone||'')};
}
export function securityFailure(res:Response,e:unknown){
 const error=e as {status?:number;message?:string};
 const status=error.status||503;
 if(status>=500)console.error('[Security admin API]',e instanceof Error?e.name:'backend-unavailable');
 if(res.headersSent){res.destroy();return;}
 return res.status(status).json({success:false,message:status>=500?'دریافت اطلاعات از سرویس امنیت امکان‌پذیر نیست.':error.message});
}
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const str=(x:unknown,max:number)=>{if(typeof x!=='string'||x.length>max)throw securityError(400,'مقدار ورودی معتبر نیست.');return x.trim();};
const select=(x:unknown,values:readonly string[])=>{if(typeof x!=='string'||!values.includes(x))throw securityError(400,'گزینه انتخاب‌شده معتبر نیست.');return x;};
const flag=(x:unknown)=>{if(typeof x!=='boolean')throw securityError(400,'وضعیت باید مشخص شود.');return x;};
export async function securityAudit(actor:SecurityOwner,action:string,target:string,details:string){
 try{await database().query(
  "insert into public.audit_logs(id,user_id,user_name,user_role,action,entity,target,details,created_at) values($1,$2,$3,'super_admin',$4,'system_security',$5,$6,now())",
  [randomUUID(),actor.id,actor.name,action,target,details]);
 }catch{console.warn('[Security audit] Insert failed');}
}
function sanitized(row:Record<string,unknown>|undefined){
 if(!row)return null;
 const pay=record(row.payment_gateway),sms=record(row.sms_provider),ship=record(row.shipping_methods),seo=record(row.seo);
 // Never send raw_settings, SMS tokens, merchant secrets or passwords to the browser.
 return {id:row.id,updatedAt:row.updated_at,
  paymentGateway:{provider:pay.provider==='saman'||pay.provider==='zarinpal'?pay.provider:'mellat',
   merchantId:String(pay.merchantId||'').slice(0,120),terminalId:String(pay.terminalId||'').slice(0,120),
   sandbox:pay.sandbox===true},
  smsProvider:{provider:process.env.SMS_PROVIDER==='kavenegar'?'kavenegar':'smsir',
   senderNumber:String(sms.senderNumber||'').slice(0,32),
   configured:smsConfigured(),ready:smsConfigured()&&process.env.SUPABASE_SMS_READY==='true'},
  shippingMethods:{barbari:ship.barbari===true,tipax:ship.tipax===true,
   expressPost:ship.expressPost===true,dedicatedFleet:ship.dedicatedFleet===true},
  currency:row.currency==='rial'?'rial':'toman',
  seo:{metaTitle:String(seo.metaTitle||'').slice(0,160),metaDescription:String(seo.metaDescription||'').slice(0,500),
   keywords:String(seo.keywords||'').slice(0,500),canonicalBase:String(seo.canonicalBase||'').slice(0,250)}};
}
async function current(){
 const r=await database().query('select id,payment_gateway,sms_provider,shipping_methods,currency,seo,updated_at from public.system_settings order by id limit 1');
 return r.rows[0] as Record<string,unknown>|undefined;
}
export function registerAdminSecurityApi(app:Express){
 app.get('/api/admin/security/overview',async(req,res)=>{
  try{
   await securityOwner(req);res.setHeader('Cache-Control','private,no-store');
   const [i,c]=await Promise.all([
    database().query("select current_database() as name,pg_database_size(current_database())::text as bytes,now() as checked_at,pg_postmaster_start_time() as started_at"),
    database().query("select (select count(*)::int from public.user_profiles) as profiles,"+
     "(select count(*)::int from app_private.admin_staff_accounts) as staff,"+
     "(select count(*)::int from app_private.admin_staff_accounts where active) as active_staff,"+
     "(select count(*)::int from public.audit_logs) as audits,"+
     "(select count(*)::int from public.sms_logs) as sms,"+
     "(select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not like 'pg_%' and n.nspname<>'information_schema') as tables")
   ]);
   return res.json({success:true,db:i.rows[0],counts:c.rows[0],sms:{provider:process.env.SMS_PROVIDER==='kavenegar'?'Kavenegar':'SMS.ir',configured:smsConfigured(),ready:smsConfigured()&&process.env.SUPABASE_SMS_READY==='true'}});
  }catch(e){return securityFailure(res,e);}
 });
 app.get('/api/admin/security/settings',async(req,res)=>{
  try{await securityOwner(req);res.setHeader('Cache-Control','private,no-store');
   return res.json({success:true,settings:sanitized(await current())});
  }catch(e){return securityFailure(res,e);}
 });
 app.post('/api/admin/security/settings/initialize',async(req,res)=>{
  try{
   const a=await securityOwner(req);
   await database().query("insert into public.system_settings(id) select 'global' where not exists(select 1 from public.system_settings) on conflict(id) do nothing");
   await securityAudit(a,'ایجاد تنظیمات پایه','system_settings','بررسی یا ایجاد سند پایه بدون داده نمایشی');
   return res.json({success:true,settings:sanitized(await current())});
  }catch(e){return securityFailure(res,e);}
 });
 app.put('/api/admin/security/settings',async(req,res)=>{
  try{
   const a=await securityOwner(req);
   const version=str(req.body?.expectedUpdatedAt,100);
   if(!version||Number.isNaN(Date.parse(version)))throw securityError(400,'نسخه تنظیمات معتبر نیست.');
   const section=select(req.body?.section,['payment','sms','shipping','seo','currency']);
   const input=record(req.body?.data);
   let column:string,value:Record<string,unknown>|string;
   if(section==='payment'){
    column='payment_gateway';
    value={provider:select(input.provider,['mellat','saman','zarinpal']),merchantId:str(input.merchantId,120),
      terminalId:str(input.terminalId,120),sandbox:flag(input.sandbox)};
   }else if(section==='sms'){
    column='sms_provider';value={senderNumber:str(input.senderNumber,32)};
   }else if(section==='shipping'){
    column='shipping_methods';
    value={barbari:flag(input.barbari),tipax:flag(input.tipax),expressPost:flag(input.expressPost),dedicatedFleet:flag(input.dedicatedFleet)};
   }else if(section==='seo'){
    column='seo';
    const canonicalBase=str(input.canonicalBase,250);
    if(canonicalBase&&!/^https:\/\/[a-z0-9.-]+(?:\/.*)?$/i.test(canonicalBase))throw securityError(400,'آدرس اصلی باید HTTPS معتبر باشد.');
    value={metaTitle:str(input.metaTitle,160),metaDescription:str(input.metaDescription,500),keywords:str(input.keywords,500),canonicalBase};
   }else{column='currency';value=select(input.currency,['toman','rial']);}
   // Column is a closed internal allowlist, never raw user input.
   const sql=column==='currency'
    ? "update public.system_settings set currency=$1,updated_at=now() where id=(select id from public.system_settings order by id limit 1) and updated_at=$2::timestamptz returning id"
    : 'update public.system_settings set '+column+'='+column+" || $1::jsonb,updated_at=now() where id=(select id from public.system_settings order by id limit 1) and updated_at=$2::timestamptz returning id";
   const result=await database().query(sql,[column==='currency'?value:JSON.stringify(value),version]);
   if(!result.rowCount)throw securityError(409,'سند تنظیمات تغییر کرده یا وجود ندارد؛ اطلاعات را تازه‌سازی کنید.');
   await securityAudit(a,'ویرایش تنظیمات',section,'تنظیمات در دیتابیس ذخیره شد؛ هیچ کلید محرمانه‌ای ثبت یا بازگردانده نشد.');
   return res.json({success:true,settings:sanitized(await current())});
  }catch(e){return securityFailure(res,e);}
 });
 app.get('/api/admin/security/activity',async(req,res)=>{
  try{
   await securityOwner(req);res.setHeader('Cache-Control','private,no-store');
   const page=Math.min(200,Math.max(1,Math.floor(Number(req.query.page)||1)));
   const term=typeof req.query.q==='string'?req.query.q.trim().slice(0,80):'';
   const rows=await database().query(
    "select id,user_name,user_role,action,entity,target,details,created_at from public.audit_logs "+
    "where ($1='' or action ilike $2 or user_name ilike $2 or target ilike $2) "+
    "order by created_at desc,id desc limit 30 offset $3",
    [term,'%'+term.replace(/[%_\\]/g,'\\$&')+'%',(page-1)*30]);
   return res.json({success:true,rows:rows.rows,page,hasMore:rows.rows.length===30});
  }catch(e){return securityFailure(res,e);}
 });
 app.get('/api/admin/security/sms-logs',async(req,res)=>{
  try{
   await securityOwner(req);res.setHeader('Cache-Control','private,no-store');
   const rows=await database().query('select id,recipient_phone,event_key,status,created_at from public.sms_logs order by created_at desc limit 50');
   return res.json({success:true,rows:rows.rows,configured:smsConfigured()});
  }catch(e){return securityFailure(res,e);}
 });
 registerFullDataExport(app);
}
