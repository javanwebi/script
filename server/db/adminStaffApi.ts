import type {Express,Request,Response} from 'express';
import {createClient} from '@supabase/supabase-js';
import crypto from 'node:crypto';
import {database,transaction,databaseEnabled,adoptedSchema} from './connection';
import {getPortalIdentity} from '../../api/portal';
import {sanitizeStaffPermissions} from './staffPermissions';

// Owner-only event channel: a change notification without account details.
const staffListeners = new Set<Response>();
function notifyStaffChanged() {
 for (const listener of staffListeners) {
  try { listener.write('event: staff-updated\\ndata: {}\\n\\n'.replaceAll('\\n','\n')); }
  catch { staffListeners.delete(listener); }
 }
}
const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
const usernamePattern=/^[a-z][a-z0-9_]{3,31}$/;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function adminAuth(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key)throw fail(503,'کلید محرمانه سرور Supabase برای ساخت حساب کارکنان تنظیم نشده است.');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function owner(req:Request){
 if(!databaseEnabled() || !adoptedSchema())throw fail(503,'مدیریت کاربران فقط روی دیتابیس اصلی صنعت پیش فعال می‌شود.');
 const identity=await getPortalIdentity(req);
 if(!identity.admin || !identity.user?.authUserId)throw fail(403,'فقط مدیر اصلی مجاز به مدیریت کاربران است.');
 if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'مبدأ درخواست معتبر نیست.');
 return String(identity.user.authUserId);
}
function respond(res:Response,error:unknown){
 const e=error as {status?:number;code?:string;message?:string};
 const status=e?.code==='23505'?409:e?.status || 503;
 if(status>=500)console.error('[Staff accounts]',e?.code || 'database/service-unavailable');
 return res.status(status).json({success:false,message:e?.code==='23505'?'نام کاربری یا ایمیل قبلاً ثبت شده است.':(status<500?e.message:'اتصال به سرویس مدیریت کاربران ممکن نشد.')});
}
export function registerAdminStaffApi(app:Express){
 app.get('/api/admin/staff/events',async(req,res)=>{
  try{
   await owner(req);
   res.setHeader('Content-Type','text/event-stream; charset=utf-8');
   res.setHeader('Cache-Control','private, no-cache, no-transform');
   res.setHeader('Connection','keep-alive');
   res.setHeader('X-Accel-Buffering','no');
   res.flushHeaders();
   res.write('retry: 5000\n\n');
   staffListeners.add(res);
   const heartbeat=setInterval(()=>{
    try{res.write(': keep-alive\n\n');}catch{clearInterval(heartbeat);staffListeners.delete(res);}
   },25000);
   req.on('close',()=>{clearInterval(heartbeat);staffListeners.delete(res);});
  }catch(e){return respond(res,e);}
 });
 app.get('/api/admin/staff',async(req,res)=>{
  try{
   await owner(req);res.setHeader('Cache-Control','private, no-store');
   const rows=await database().query(`
    select s.user_id as id,p.username,p.full_name as name,p.email,
           s.permissions,s.active,s.created_at as "createdAt",s.updated_at as "updatedAt",
           p.last_login_at as "lastLogin"
    from app_private.admin_staff_accounts s
    join public.user_profiles p on p.id=s.user_id
    order by s.created_at desc`);
   return res.json({success:true,users:rows.rows});
  }catch(e){return respond(res,e);}
 });
 app.post('/api/admin/staff',async(req,res)=>{
  let createdId:string|undefined;
  try{
   const creator=await owner(req);
   const username=String(req.body?.username||'').trim().toLowerCase();
   const name=String(req.body?.name||'').trim();
   const suppliedEmail=String(req.body?.email||'').trim().toLowerCase();
   const email=suppliedEmail || (username+'.'+crypto.randomUUID().slice(0,8)+'@staff.sanatpish.com');
   const password=req.body?.password;
   if(!usernamePattern.test(username))throw fail(400,'نام کاربری باید ۴ تا ۳۲ حرف انگلیسی، عدد یا زیرخط باشد و با حرف شروع شود.');
   if(name.length<2 || name.length>160)throw fail(400,'نام کارمند باید بین ۲ تا ۱۶۰ نویسه باشد.');
   if(email.length>320 || !emailPattern.test(email))throw fail(400,'ایمیل کارمند معتبر نیست.');
   if(typeof password!=='string' || password.length<12 || password.length>128)throw fail(400,'رمز عبور باید حداقل ۱۲ و حداکثر ۱۲۸ نویسه باشد.');
   const permissions=sanitizeStaffPermissions(req.body?.permissions);
   const existing=await database().query('select id from public.user_profiles where lower(username)=$1 or lower(email)=$2 limit 1',[username,email]);
   if(existing.rowCount)throw fail(409,'نام کاربری یا ایمیل قبلاً ثبت شده است.');
   const created=await adminAuth().auth.admin.createUser({email,password,email_confirm:true,app_metadata:{account_kind:'staff'}});
   if(created.error || !created.data.user)throw fail(400,'ایجاد حساب احراز هویت انجام نشد؛ ایمیل و رمز را بررسی کنید.');
   createdId=created.data.user.id;
   await transaction(async client=>{
    await client.query(`
      insert into public.user_profiles(id,email,username,full_name,role,status,approved_b2b,can_view_prices,can_view_stock)
      values($1,$2,$3,$4,'warehouse_operator','active',false,false,false)
      on conflict(id) do update set email=excluded.email,username=excluded.username,full_name=excluded.full_name,
       role='warehouse_operator',status='active',approved_b2b=false,can_view_prices=false,can_view_stock=false`,
      [createdId,email,username,name]);
    await client.query(`
      insert into app_private.admin_staff_accounts(user_id,permissions,created_by)
      values($1,$2::jsonb,$3)`,[createdId,JSON.stringify(permissions),creator]);
   });
   notifyStaffChanged();
   return res.status(201).json({success:true,id:createdId});
  }catch(e){
   // Compensate only for the Auth identity created by this failed request.
   if(createdId)await adminAuth().auth.admin.deleteUser(createdId).catch(()=>{});
   return respond(res,e);
  }
 });
 app.patch('/api/admin/staff/:id',async(req,res)=>{
  try{
   await owner(req);
   const id=String(req.params.id||'');
   if(!uuidPattern.test(id))throw fail(400,'شناسه کاربر نامعتبر است.');
   const active=req.body?.active;
   if(typeof active!=='boolean')throw fail(400,'وضعیت کاربر باید مشخص باشد.');
   const permissions=sanitizeStaffPermissions(req.body?.permissions);
   const name=req.body?.name;
   if(name!==undefined && (typeof name!=='string'||name.trim().length<2||name.length>160))
    throw fail(400,'نام کارمند معتبر نیست.');
   const count=await transaction(async client=>{
    const result=await client.query(`
     update app_private.admin_staff_accounts set active=$2,permissions=$3::jsonb,updated_at=now()
     where user_id=$1 returning user_id`,[id,active,JSON.stringify(permissions)]);
    if(!result.rowCount)return 0;
    await client.query(`
     update public.user_profiles set status=$2::public.account_status_type,
      full_name=coalesce($3,full_name),updated_at=now()
     where id=$1 and role='warehouse_operator'`,[id,active?'active':'suspended',typeof name==='string'?name.trim():null]);
    return result.rowCount;
   });
   if(!count)throw fail(404,'حساب کارمند یافت نشد.');
   notifyStaffChanged();
   return res.json({success:true});
  }catch(e){return respond(res,e);}
 });
 app.post('/api/admin/staff/:id/reset-password',async(req,res)=>{
  try{
   await owner(req);
   const id=String(req.params.id||'');
   const password=req.body?.password;
   if(!uuidPattern.test(id))throw fail(400,'شناسه کاربر نامعتبر است.');
   if(typeof password!=='string'||password.length<12||password.length>128)throw fail(400,'رمز باید حداقل ۱۲ نویسه باشد.');
   if(!(await database().query('select 1 from app_private.admin_staff_accounts where user_id=$1',[id])).rowCount)
     throw fail(404,'کارمند یافت نشد.');
   const result=await adminAuth().auth.admin.updateUserById(id,{password});
   if(result.error)throw fail(503,'بازنشانی رمز کارمند انجام نشد.');
   notifyStaffChanged();
   return res.json({success:true});
  }catch(e){return respond(res,e);}
 });
}
