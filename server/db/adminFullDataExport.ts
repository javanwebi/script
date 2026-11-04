import type {Express,Request,Response} from 'express';
import type {PoolClient} from 'pg';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createGzip} from 'node:zlib';
import {once} from 'node:events';
import {database} from './connection';
import {securityOwner,securityError,securityFailure,securityAudit} from './adminSecurityApi';

// One-use, 60-second, owner-bound tickets: never put credentials in a URL.
const approvals=new Map<string,{digest:Buffer;expiry:number}>();
const failures=new Map<string,{count:number;until:number}>();
const COOKIE='sp_db_export';
let exportRunning=false;
const digest=(v:string)=>createHash('sha256').update(v).digest();
const cookie=(token:string,ttl:number)=>COOKIE+'='+token+'; Path=/api/admin/security/export; HttpOnly; Secure; SameSite=Strict; Max-Age='+ttl;
const getCookie=(req:Request)=> (req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const ident=(v:string)=>'"'+v.replace(/"/g,'""')+'"';
async function append(gz:ReturnType<typeof createGzip>,line:unknown,res:Response){
 if(res.destroyed||gz.destroyed)throw Error('DOWNLOAD_CANCELLED');
 if(!gz.write(JSON.stringify(line)+'\n'))await once(gz,'drain');
}

export function registerFullDataExport(app:Express){
 app.post('/api/admin/security/export/authorize',async(req,res)=>{
  try{
   const actor=await securityOwner(req);
   const now=Date.now();
   const previous=failures.get(actor.id);
   if(previous&&previous.until>now&&previous.count>=5)throw securityError(429,'تعداد تلاش زیاد است؛ ۱۵ دقیقه دیگر دوباره امتحان کنید.');
   const password=req.body?.password;
   if(typeof password!=='string'||password.length<1||password.length>256)throw securityError(400,'رمز ورود مدیر الزامی است.');
   const url=process.env.SUPABASE_URL;
   const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
   if(!url||!key)throw securityError(503,'تأیید هویت دوباره Supabase هنوز تنظیم نشده است.');
   const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   // Reverify against actual Auth login identifiers, not profile display fields.
   const identity=await database().query('select email,phone from auth.users where id=$1',[actor.id]);
   const authEmail=String(identity.rows[0]?.email||'');
   const authPhone=String(identity.rows[0]?.phone||'');
   const credentials=authEmail?{email:authEmail,password}:authPhone?{phone:authPhone,password}:null;
   if(!credentials)throw securityError(403,'برای دانلود باید ایمیل یا تلفن حساب اصلی در Supabase Auth ثبت شده باشد.');
   const result=await client.auth.signInWithPassword(credentials);
   if(result.error||result.data.user?.id!==actor.id){
    failures.set(actor.id,{count:previous&&previous.until>now?previous.count+1:1,until:now+15*60_000});
    throw securityError(403,'رمز ورود نادرست است.');
   }
   failures.delete(actor.id);
   const token=randomBytes(32).toString('hex');
   approvals.set(actor.id,{digest:digest(token),expiry:Date.now()+60_000});
   res.setHeader('Cache-Control','no-store');
   res.setHeader('Set-Cookie',cookie(token,60));
   return res.json({success:true,downloadUrl:'/api/admin/security/export/file',expiresIn:60});
  }catch(e){return securityFailure(res,e);}
 });
 app.get('/api/admin/security/export/file',async(req,res)=>{
  let conn:PoolClient|undefined;
  let gz:ReturnType<typeof createGzip>|undefined;
  let ownerInfo:Awaited<ReturnType<typeof securityOwner>>|undefined;
  try{
   ownerInfo=await securityOwner(req);
   const stored=approvals.get(ownerInfo.id),token=getCookie(req);
   approvals.delete(ownerInfo.id);
   res.setHeader('Set-Cookie',cookie('',0));
   if(!stored||stored.expiry<Date.now()||!/^[a-f0-9]{64}$/.test(token)
     ||!timingSafeEqual(stored.digest,digest(token)))throw securityError(403,'مجوز دانلود منقضی شده است؛ دوباره رمز ورود را تأیید کنید.');
   if(exportRunning)throw securityError(429,'خروجی دیگری در حال دریافت است.');
   exportRunning=true;
   conn=await database().connect();
   await conn.query('begin transaction isolation level repeatable read read only');
   await conn.query("set local statement_timeout='180s'");
   const catalog=await conn.query(
    "select n.nspname as schema,c.relname as tablename,has_table_privilege(c.oid,'SELECT') as readable "+
    "from pg_class c join pg_namespace n on n.oid=c.relnamespace "+
    "where c.relkind='r' and n.nspname not like 'pg_%' and n.nspname<>'information_schema' "+
    "order by n.nspname,c.relname");
   if(catalog.rows.some(row=>!row.readable))throw securityError(503,'دسترسی پایگاه داده به بعضی جدول‌ها کافی نیست؛ آرشیو ناقص صادر نمی‌شود.');
   res.setHeader('Cache-Control','no-store,no-transform');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Referrer-Policy','no-referrer');
   res.setHeader('Content-Type','application/gzip');
   res.setHeader('Content-Disposition','attachment; filename="sanatpish-db-data-'+new Date().toISOString().slice(0,10)+'.ndjson.gz"');
   gz=createGzip({level:3});
   gz.pipe(res);
   const out=gz;
   res.on('close',()=>{if(!res.writableFinished)out.destroy(new Error('DOWNLOAD_ABORTED'));});
   await append(out,{kind:'manifest',format:'sanatpish-db-data-ndjson-v1',
     at:new Date().toISOString(),tableCount:catalog.rows.length,
     scope:'all readable user-data tables in all non-system schemas',
     notIncluded:['PostgreSQL role/DDL/sequence state','physical Supabase Storage objects']},res);
   for(const table of catalog.rows){
    if(res.destroyed)throw Error('DOWNLOAD_CANCELLED');
    const qualified=ident(table.schema)+'.'+ident(table.tablename);
    const columns=await conn.query(
     "select a.attname as name,format_type(a.atttypid,a.atttypmod) as type "+
     "from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace "+
     "where n.nspname=$1 and c.relname=$2 and a.attnum>0 and not a.attisdropped order by a.attnum",
     [table.schema,table.tablename]);
    await append(out,{kind:'table',schema:table.schema,name:table.tablename,columns:columns.rows},res);
    await conn.query('declare sanat_export_cursor no scroll cursor for select row_to_json(t) as data from '+qualified+' t');
    let count=0;
    try{
     for(;;){
      if(res.destroyed)throw Error('DOWNLOAD_CANCELLED');
      const batch=await conn.query('fetch forward 25 from sanat_export_cursor');
      if(!batch.rows.length)break;
      for(const row of batch.rows){
       await append(out,{kind:'row',schema:table.schema,table:table.tablename,data:row.data},res);count++;
      }
     }
    }finally{await conn.query('close sanat_export_cursor').catch(()=>{});}
    await append(out,{kind:'table_end',schema:table.schema,name:table.tablename,rows:count},res);
   }
   await append(out,{kind:'complete',tableCount:catalog.rows.length},res);
   await conn.query('commit');conn.release();conn=undefined;
   out.end();
   await securityAudit(ownerInfo,'خروجی تمام داده‌ها','database','آرشیو فشرده جدول‌های دیتابیس پس از تأیید دوباره رمز ورود صادر شد.');
  }catch(e){
   if(conn){await conn.query('rollback').catch(()=>{});conn.release();}
   if(gz)gz.destroy();
   securityFailure(res,e);
  }finally{exportRunning=false;}
 });
}
