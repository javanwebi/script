import {createClient,type Session} from '@supabase/supabase-js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import crypto from 'node:crypto';
import {database} from './connection';
import {readPortal} from './repository';
const error=(status:number,message:string)=>Object.assign(new Error(message),{status});
function client(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;if(!url || !key)throw error(503,'اتصال Supabase Auth هنوز کامل نشده است.');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
const cookie=(req:IncomingMessage,name:string)=>(req.headers.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1);
function cookies(req:IncomingMessage,res:ServerResponse,session:Session|null){const secure=process.env.NODE_ENV==='production'?'; Secure':'';const values=[`sp_access=${session?.access_token || ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session?.expires_in || 0}${secure}`,`sp_refresh=${session?.refresh_token || ''}; Path=/api/portal; HttpOnly; SameSite=Lax; Max-Age=${session?2592000:0}${secure}`];res.setHeader('Set-Cookie',values);req.headers.cookie=[...(req.headers.cookie || '').split(';').filter(value=>!/^\s*sp_(access|refresh)=/.test(value)),`sp_access=${session?.access_token || ''}`,`sp_refresh=${session?.refresh_token || ''}`].join(';');}
function phone(raw:string){const value=String(raw || '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[\s()-]/g,'').replace(/^(\+98|0098|98)/,'0');if(!/^09\d{9}$/.test(value))throw error(400,'شماره موبایل معتبر وارد کنید.');return {local:value,e164:'+98'+value.slice(1)};}
export async function supabaseIdentity(req:IncomingMessage,db:{users:any[]}){
 const token=cookie(req,'sp_access');if(!token)return {admin:false};
 const result=await client().auth.getUser(token);if(result.error){if(result.error.status && result.error.status>=500)throw error(503,'بررسی ورود در دسترس نیست.');return {admin:false};}
 const user=db.users.find(profile=>profile.authUserId===result.data.user.id && profile.active!==false);return {admin:user?.role==='admin',user};
}
export async function refreshAuth(req:IncomingMessage,res:ServerResponse){const token=cookie(req,'sp_access'),refresh=cookie(req,'sp_refresh');if(!refresh)return;const auth=client();if(token){const result=await auth.auth.getUser(token);if(!result.error)return;}const result=await auth.auth.refreshSession({refresh_token:refresh});if(!result.error && result.data.session)cookies(req,res,result.data.session);}
export async function supabaseAuthAction(req:IncomingMessage,res:ServerResponse,body:any,safe:(value:any)=>any):Promise<boolean>{
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
 if(body.action==='otp_request'){if(process.env.SUPABASE_SMS_READY!=='true')throw error(503,'سرویس پیامک هنوز فعال نشده است.');const number=phone(body.phone);const result=await auth.auth.signInWithOtp({phone:number.e164,options:{shouldCreateUser:false}});if(result.error)throw error(400,'ارسال کد انجام نشد؛ شماره و تنظیمات پیامک Supabase Auth را بررسی کنید.');send(200,{success:true,retryAfter:60,message:'اگر حساب فعال وجود داشته باشد، کد تأیید ارسال می‌شود.'});return true;}
 let session:Session|null=null;
 if(body.action==='otp_verify'){if(!/^[0-9۰-۹]{6}$/.test(String(body.code || '')))throw error(400,'کد تأیید شش‌رقمی وارد کنید.');const result=await auth.auth.verifyOtp({phone:phone(body.phone).e164,token:String(body.code || '').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),type:'sms'});if(result.error)throw error(401,'کد واردشده معتبر نیست.');session=result.data.session;}
 else{const db=await readPortal();const identifier=String(body.identifier || body.username || '').trim().toLowerCase();const profile=db.users.find(user=>user.username?.toLowerCase()===identifier || user.phone===identifier);if(!profile?.authUserId)throw error(401,'ورود معتبر نیست یا انتقال حساب به Supabase Auth باید تکمیل شود.');const result=await auth.auth.signInWithPassword({phone:phone(profile.phone).e164,password:String(body.password || '')});if(result.error)throw error(401,'نام کاربری یا رمز عبور معتبر نیست؛ در صورت نیاز از ورود پیامکی استفاده کنید.');session=result.data.session;}
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
 let db=await readPortal();let profile=db.users.find(user=>user.authUserId===session!.user.id);
 if(!profile || (body.action==='admin_login' && profile.role!=='admin')){cookies(req,res,null);throw error(403,'این حساب دسترسی لازم را ندارد.');}
 send(200,{success:true,user:safe(profile),admin:profile.role==='admin',requiresCredentials:profile.registrationCredentialsPending===true,onboardingStep:profile.onboardingCompleted?'completed':1});return true;
 }catch(e:any){send(e.status || 503,{success:false,message:e.status?e.message:'ارتباط با Supabase Auth برقرار نشد.'});return true;}
}
