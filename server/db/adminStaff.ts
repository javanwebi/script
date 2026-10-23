import {createClient} from '@supabase/supabase-js';
import type {Request,Response} from 'express';
import {database} from './connection';
import {validPermissions,STAFF_ROLES} from './adminPermissions';
const httpError=(status:number,message:string)=>Object.assign(new Error(message),{status});
const cookie=(req:Request,name:string)=>(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const authClient=()=>{const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;if(!url||!key)throw httpError(503,'Supabase Auth تنظیم نشده است.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
const managementClient=()=>{const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw httpError(503,'برای ایجاد حساب کارکنان، کلید امن Service Role باید فقط در تنظیمات Railway ثبت شود.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
export async function adminStaffApi(req:Request,res:Response){
 res.setHeader('Cache-Control','private, no-store');
 try{
  if(!['GET','POST','PATCH'].includes(req.method))throw httpError(405,'عملیات مجاز نیست.');
  if(req.method!=='GET'){
   const origin=req.headers.origin;
   if(origin && new URL(origin).host!==req.headers.host)throw httpError(403,'مبدأ درخواست معتبر نیست.');
  }
  const token=cookie(req,'sp_access');if(!token)throw httpError(401,'ابتدا وارد پنل مدیریت شوید.');
  const who=await authClient().auth.getUser(token);
  if(who.error || !who.data.user)throw httpError(401,'نشست مدیریت معتبر نیست.');
  const supervisor=(await database().query("select role::text role,status::text status from public.user_profiles where id=$1",[who.data.user.id])).rows[0];
  if(supervisor?.role!=='super_admin'||supervisor?.status!=='active')throw httpError(403,'این قسمت فقط برای مدیر اصلی است.');
  if(req.method==='GET'){
   const result=await database().query("select id,username,full_name as name,email,role::text role,status::text status,coalesce(preferences->'adminPermissions','[]'::jsonb) as permissions from public.user_profiles where role::text in ('sales_manager','warehouse_operator') order by created_at desc limit 200");
   return res.json({success:true,staff:result.rows,provisioningReady:!!process.env.SUPABASE_SERVICE_ROLE_KEY});
  }
  const body=req.body||{};
  if(req.method==='POST'){
   const username=String(body.username||'').trim().toLowerCase(),name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),password=body.password,role=body.role;
   if(!/^[a-z][a-z0-9_]{3,31}$/.test(username))throw httpError(400,'نام کاربری باید ۴ تا ۳۲ نویسه معتبر انگلیسی داشته باشد.');
   if(name.length<2||name.length>120)throw httpError(400,'نام کارمند معتبر نیست.');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>240)throw httpError(400,'ایمیل معتبر برای Supabase Auth الزامی است.');
   if(typeof password!=='string'||password.length<12||password.length>128)throw httpError(400,'رمز عبور باید حداقل ۱۲ نویسه داشته باشد.');
   if(!STAFF_ROLES.includes(role))throw httpError(400,'نقش کارمند معتبر نیست.');
   const permissions=validPermissions(body.permissions);
   // Employee accounts never gain the security-settings module or super-admin rights.
   if(permissions.includes('settings'))throw httpError(403,'مدیریت امنیت فقط برای مدیر اصلی است.');
   const duplicate=await database().query('select id from public.user_profiles where lower(username)=$1 or lower(email)=$2 limit 1',[username,email]);
   if(duplicate.rowCount)throw httpError(409,'نام کاربری یا ایمیل تکراری است.');
   const admin=managementClient();
   const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{staff:true}});
   if(created.error||!created.data.user)throw httpError(400,'ایجاد حساب Auth انجام نشد؛ ایمیل یا رمز عبور را بررسی کنید.');
   try{
    await database().query("insert into public.user_profiles (id,username,full_name,email,role,status,preferences) values($1,$2,$3,$4,$5::public.app_role_type,'active',$6::jsonb)",[created.data.user.id,username,name,email,role,JSON.stringify({adminPermissions:permissions})]);
   }catch(e){
    // Undo orphan Auth account when the profile cannot be stored.
    await admin.auth.admin.deleteUser(created.data.user.id).catch(()=>{});
    throw e;
   }
   return res.status(201).json({success:true,message:'کارمند ایجاد شد.',staff:{id:created.data.user.id,username,name,email,role,status:'active',permissions}});
  }
  const id=String(body.id||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw httpError(400,'شناسه نامعتبر است.');
  const existing=(await database().query("select id from public.user_profiles where id=$1 and role::text in ('sales_manager','warehouse_operator')",[id])).rows[0];
  if(!existing)throw httpError(404,'کارمند یافت نشد.');
  if(body.operation==='set_permissions'){
   const permissions=validPermissions(body.permissions);
   if(permissions.includes('settings'))throw httpError(403,'مجوز تنظیمات امنیتی قابل واگذاری نیست.');
   await database().query("update public.user_profiles set preferences=jsonb_set(coalesce(preferences,'{}'::jsonb),'{adminPermissions}',$2::jsonb,true),updated_at=now() where id=$1",[id,JSON.stringify(permissions)]);
  }else if(body.operation==='set_active'){
   if(typeof body.active!=='boolean')throw httpError(400,'وضعیت نامعتبر است.');
   await database().query("update public.user_profiles set status=case when $2::boolean then 'active'::public.account_status_type else 'disabled'::public.account_status_type end,updated_at=now() where id=$1",[id,body.active]);
  }else if(body.operation==='reset_password'){
   if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw httpError(400,'رمز عبور حداقل ۱۲ نویسه لازم دارد.');
   const changed=await managementClient().auth.admin.updateUserById(id,{password:body.password});
   if(changed.error)throw httpError(503,'تغییر رمز عبور در Supabase Auth موفق نبود.');
  }else throw httpError(400,'عملیات نامعتبر است.');
  return res.json({success:true,message:'تغییرات ذخیره شد.'});
 }catch(e:any){
  console.error('[Admin staff]',e?.status?e.message:'Unexpected staff management error');
  return res.status(e?.status||503).json({success:false,message:e?.status?e.message:'ارتباط با بخش مدیریت کارکنان ممکن نشد.'});
 }
}
