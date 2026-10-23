import {createClient,type Session} from '@supabase/supabase-js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import crypto from 'node:crypto';
import {database} from './connection';
import {handleDevelopmentOtp} from './devOtpPreview';
import {readPortal} from './repository';
const error=(status:number,message:string)=>Object.assign(new Error(message),{status});
function client(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;if(!url || !key)throw error(503,'اتصال Supabase Auth هنوز کامل نشده است.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
const cookie=(req:IncomingMessage,name:string)=>(req.headers.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1);
function cookies(req:IncomingMessage,res:ServerResponse,session:Session|null){const secure=process.env.NODE_ENV==='production'?'; Secure':'';const values=[`sp_access=${session?.access_token || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session?.expires_in || 0}${secure}`,`sp_refresh=${session?.refresh_token || ''}; Path=/api/portal; HttpOnly; SameSite=Lax; Max-Age=${session?2592000:0}${secure}`];res.setHeader('Set-Cookie',values);req.headers.cookie=[...(req.headers.cookie || '').split(';').filter(value=>!/^\s*sp_(access|refresh)=/.test(value)),`sp_access=${session?.access_token || ''}`,`sp_refresh=${session?.refresh_token || ''}`].join(';');}
function phone(raw:string){const value=String(raw || '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[\s()-]/g,'').replace(/^(\+98|0098|98)/,'0');if(!/^09\d{9}$/.test(value))throw error(400,'شماره موبایل معتبر وارد کنید.');return {local:value,e164:'+98'+value.slice(1)};}
// Resolve only the authenticated profile for API authorization; never load all CRM users.
async function identityProfile(authUserId:string){
 const row=(await database().query(`
 select p.*,d.id as draft_id,d.payload as draft_payload,d.active as draft_active,
   coalesce((select jsonb_agg(jsonb_build_object(
     'id',coalesce(a.legacy_id,a.id::text),'title',a.title,'province',a.province,
     'city',a.city,'fullAddress',a.full_address,'postalCode',a.postal_code,
     'recipientName',a.recipient_name,'recipientPhone',a.recipient_phone
   )) from public.user_addresses a where a.user_id=p.id and a.active), '[]'::jsonb) as profile_addresses
 from public.user_profiles p
 left join lateral (
   select id,payload,active from app_private.portal_users
   where auth_user_id=p.id or id=p.legacy_user_id
   order by (auth_user_id=p.id) desc limit 1
 ) d on true
 where p.id=$1 limit 1`,[authUserId])).rows[0];
 if(!row)return undefined;
 const role:{[key:string]:string}={client:'retail',club:'wholesale',agency:'dealer',super_admin:'admin',sales_manager:'sales_manager',warehouse_operator:'warehouse_operator'};
 return {...(row.draft_payload || {}),...(row.preferences || {}),
  addresses:row.profile_addresses || [],id:row.draft_id || row.legacy_user_id || row.id,
  authUserId:row.id,phone:row.phone?.replace(/^\+98/,'0'),
  email:row.email,username:row.username,fullName:row.full_name,companyName:row.company_name,
  role:role[row.role] || 'guest',active:row.status==='active' && row.draft_active!==false,
  approvedB2B:row.approved_b2b,canViewPrices:row.can_view_prices,canViewStock:row.can_view_stock,
  creditLimit:Number(row.credit_limit),creditUsed:Number(row.credit_used),
  walletBalance:Number(row.wallet_balance),clubPoints:row.club_points,
  adminPermissions:Array.isArray(row.preferences?.adminPermissions)?row.preferences.adminPermissions:[]};
}
export async function supabaseIdentity(req:IncomingMessage,db?:{users:any[]}){
 const token=cookie(req,'sp_access');if(!token)return {admin:false};
 const result=await client().auth.getUser(token);if(result.error){if(result.error.status && result.error.status>=500)throw error(503,'بررسی ورود در دسترس نیست.');return {admin:false};}
 const user=db ? db.users.find(profile=>profile.authUserId===result.data.user.id && profile.active!==false) : await identityProfile(result.data.user.id);return {admin:user?.active!==false && (user?.role==='admin'||(['sales_manager','warehouse_operator'].includes(user?.role)&&Array.isArray(user?.adminPermissions)&&user.adminPermissions.length>0)),user:user?.active===false?undefined:user};
}
export async function refreshAuth(req:IncomingMessage,res:ServerResponse){const token=cookie(req,'sp_access'),refresh=cookie(req,'sp_refresh');if(!refresh)return;const auth=client();if(token){const result=await auth.auth.getUser(token);if(!result.error)return;}const result=await auth.auth.refreshSession({refresh_token:refresh});if(!result.error && result.data.session)cookies(req,res,result.data.session);}
export async function supabaseAuthAction(req:IncomingMessage,res:ServerResponse,body:any,safe:(value:any)=>any):Promise<boolean>{
 if(handleDevelopmentOtp(req,res,body))return true;
 if(!['register','login','admin_login','otp_request','otp_verify','registration_credentials','logout'].includes(body.action))return false;
 const send=(status:number,data:any)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 try{
 const auth=client();
 if(body.action==='logout'){const access=cookie(req,'sp_access'),refresh=cookie(req,'sp_refresh');if(access && refresh){const sdk=client();await sdk.auth.setSession({access_token:access,refresh_token:refresh});await sdk.auth.signOut({scope:'local'});}cookies(req,res,null);send(200,{success:true});return true;}
 if(body.action==='register'){
  if(process.env.SUPABASE_SMS_READY!=='true')throw error(503,'سرویس پیامک هنوز فعال نشده است؛ ثبت‌نام پس از اتصال سرویس پیامک امکان‌پذیر است.');
  const p=body.payload || {},number=phone(p.mobile);
  for(const field of ['firstName','lastName','companyName','provinceId','cityId','activityField'])if(typeof p[field]!=='string' || !p[field].trim() || p[field].length>300)throw error(400,'تمام اطلاعات الزامی را کامل کنید.');
  const existing=await database().query('select id from public.user_profiles where phone=$1 or phone=$2',[number.local,number.e164]);
  if(existing.rowCount)throw error(409,'این شماره قبلاً ثبت شده است؛ از بخش ورود استفاده کنید.');
  const draft={id:crypto.randomUUID(),phone:number.local,mobile:number.local,firstName:p.firstName,lastName:p.lastName,fullName:p.firstName+' '+p.lastName,companyName:p.companyName,email:String(p.email || '').slice(0,320),provinceId:p.provinceId,cityId:p.cityId,province:String(p.province || '').slice(0,300),city:String(p.city || '').slice(0,300),activityField:p.activityField,role:'retail',onboardingCompleted:false,registrationCredentialsPending:true,createdAt:new Date().toISOString()};
  await database().query('insert into app_private.auth_provisioning(id,phone,payload) values($1,$2,$3)',[draft.id,number.local,JSON.stringify(draft)]);
  // No password is accepted or stored until the phone is verified. Bind the draft to this browser.
  res.setHeader('Set-Cookie',`sp_registration=${draft.id}; Path=/api/portal; HttpOnly; SameSite=Lax; Max-Age=1800${process.env.NODE_ENV==='production'?'; Secure':''}`);
  const result=await auth.auth.signInWithOtp({phone:number.e164,options:{shouldCreateUser:true}});
  if(result.error)throw error(503,'ارسال کد تأیید انجام نشد؛ تنظیمات پیامک Supabase Auth را بررسی کنید.');
  send(201,{success:true,requiresPhoneVerification:true,isNewUser:true,message:'کد تأیید شماره را وارد کنید.'});return true;
 }
 if(body.action==='registration_credentials'){
  const token=cookie(req,'sp_access'),refresh=cookie(req,'sp_refresh');if(!token || !refresh)throw error(401,'ابتدا شماره موبایل را تأیید کنید.');
  const identity=await auth.auth.getUser(token);const verified=identity.data.user;
  if(identity.error || !verified?.phone_confirmed_at)throw error(401,'تأیید شماره موبایل الزامی است.');
  const profile=(await database().query('select preferences from public.user_profiles where id=$1',[verified.id])).rows[0];
  if(profile?.preferences?.registrationCredentialsPending!==true)throw error(409,'اطلاعات ورود قبلاً ثبت شده است.');
  const username=String(body.username || '').trim().toLowerCase(),password=body.password;
  if(!/^[a-z][a-z0-9_]{3,31}$/.test(username))throw error(400,'نام کاربری باید ۴ تا ۳۲ نویسه انگلیسی باشد و با حرف شروع شود.');
  if(typeof password!=='string' || password.length<10 || password.length>128 || password===phone(verified.phone!).local)throw error(400,'رمز امن، حداقل ۱۰ نویسه و متفاوت با شماره موبایل وارد کنید.');
  // Reserve the username before changing Auth; a failed password update remains retryable.
  try{await database().query('update public.user_profiles set username=$2 where id=$1',[verified.id,username]);}catch(e:any){if(e.code==='23505')throw error(409,'نام کاربری قبلاً استفاده شده است.');throw e;}
  const restored=await auth.auth.setSession({access_token:token,refresh_token:refresh});if(restored.error)throw error(401,'نشست ورود منقضی شده است.');
  const updated=await auth.auth.updateUser({password});if(updated.error)throw error(400,'ذخیره رمز عبور انجام نشد؛ رمز امن‌تری انتخاب کنید.');
  await database().query(`update public.user_profiles set preferences=preferences || '{"registrationCredentialsPending":false}'::jsonb where id=$1`,[verified.id]);
  const current=await readPortal(),user=current.users.find(u=>u.authUserId===verified.id);
  send(200,{success:true,user:safe(user),credentials:{username}});return true;
 }
 if(body.action==='otp_request'){
   const number=phone(body.phone);
   // Only previously provisioned, active CRM/customer profiles may request a login OTP.
   // SMS can never create a new Supabase Auth identity from the login screen.
   const existing=(await database().query(`select id from public.user_profiles where (phone=$1 or phone=$2) and status='active' limit 1`,[number.local,number.e164])).rows[0];
   if(!existing)throw error(404,'این شماره در مشتریان صنعت پیش ثبت نشده است؛ لطفاً ابتدا ثبت‌نام کنید.');
   if(!(await database().query('select 1 from auth.users where id=$1',[existing.id])).rowCount)throw error(409,'حساب مشتری در CRM ثبت شده اما هنوز برای ورود فعال‌سازی نشده است؛ با پشتیبانی تماس بگیرید.');
   if(process.env.SUPABASE_SMS_READY!=='true')throw error(503,'سامانه پیامک هنوز فعال نیست. برای ورود از رمز عبور استفاده کنید؛ کد نمایشی در سایت عمومی امنیت حساب را تضمین نمی‌کند.');
   const result=await auth.auth.signInWithOtp({phone:number.e164,options:{shouldCreateUser:false}});
   if(result.error)throw error(400,'ارسال کد انجام نشد؛ شماره و تنظیمات پیامک Supabase Auth را بررسی کنید.');
   send(200,{success:true,retryAfter:60,message:'کد تأیید برای شماره ثبت‌شده ارسال شد.'});return true;
  }
 let session:Session|null=null;
 if(body.action==='otp_verify'){if(!/^[0-9۰-۹]{6}$/.test(String(body.code || '')))throw error(400,'کد تأیید شش‌رقمی وارد کنید.');const result=await auth.auth.verifyOtp({phone:phone(body.phone).e164,token:String(body.code || '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),type:'sms'});if(result.error)throw error(401,'کد واردشده معتبر نیست.');session=result.data.session;}
 else{
  const identifier=String(body.identifier || body.username || '').trim().toLowerCase();
  if(!identifier || !String(body.password || ''))throw error(400,'نام کاربری و رمز عبور را وارد کنید.');
  const row=(await database().query(
    "select id,email,phone,role,status from public.user_profiles where lower(username)=$1 or lower(email)=$1 or phone=$1 limit 1",
    [identifier]
  )).rows[0];
  if(!row || row.status!=='active' || (body.action==='admin_login' && !['super_admin','sales_manager','warehouse_operator'].includes(row.role)))
    throw error(401,'نام کاربری یا رمز عبور معتبر نیست.');
  const credentials=body.action==='admin_login' && row.email
    ? {email:String(row.email),password:String(body.password)}
    : {phone:phone(row.phone).e164,password:String(body.password)};
  const result=await auth.auth.signInWithPassword(credentials);
  if(result.error)throw error(result.error.status===429?429:401,'نام کاربری یا رمز عبور معتبر نیست؛ در صورت نیاز از ورود پیامکی استفاده کنید.');
  if(result.data.user?.id!==row.id)throw error(403,'حساب تأییدشده با پروفایل مطابقت ندارد.');
  session=result.data.session;
 }
 if(!session)throw error(401,'نشست ورود ایجاد نشد.');cookies(req,res,session);
 // Consume only the draft bound to the verified browser and matching verified phone.
 const draftId=cookie(req,'sp_registration');
 if(draftId && /^[0-9a-f-]{36}$/.test(draftId) && session.user.phone_confirmed_at){
  const local=phone(session.user.phone!).local;
  const pending=(await database().query("select id,payload from app_private.auth_provisioning where id=$1 and phone=$2 and status='pending' and created_at>now()-interval '30 minutes'",[draftId,local])).rows[0];
  if(pending){
   const p=pending.payload;
   await database().query(`update public.user_profiles set full_name=$2,company_name=$3,province=$4,city=$5,preferences=preferences || $6::jsonb,email=coalesce(nullif($7,''),email) where id=$1 and username is null`,[session.user.id,p.fullName,p.companyName,p.province,p.city,JSON.stringify(p),p.email]);
   await database().query("update app_private.auth_provisioning set status='linked' where id=$1",[pending.id]);
  }
 }
 const p=(await database().query('select id,username,email,phone,full_name,company_name,role,status,preferences,approved_b2b,can_view_prices from public.user_profiles where id=$1',[session.user.id])).rows[0];
 const profile=p?{id:p.id,authUserId:p.id,username:p.username,email:p.email,phone:p.phone,fullName:p.full_name,companyName:p.company_name,role:p.role==='super_admin'?'admin':p.role==='club'?'wholesale':p.role==='client'?'retail':p.role==='agency'?'dealer':p.role==='sales_manager'?'sales_manager':p.role==='warehouse_operator'?'warehouse_operator':'guest',active:p.status==='active',approvedB2B:p.approved_b2b,canViewPrices:p.can_view_prices,...(p.preferences || {})}:null;
 if(!profile || !profile.active || (body.action==='admin_login' && !['admin','sales_manager','warehouse_operator'].includes(profile.role))){cookies(req,res,null);throw error(403,'این حساب دسترسی لازم را ندارد.');}
 send(200,{success:true,user:safe(profile),admin:['admin','sales_manager','warehouse_operator'].includes(profile.role),requiresCredentials:profile.registrationCredentialsPending===true,onboardingStep:profile.onboardingCompleted?'completed':1});return true;
 }catch(e:any){send(e.status || 503,{success:false,message:e.status?e.message:'ارتباط با Supabase Auth برقرار نشد.'});return true;}
}
