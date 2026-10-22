import {createHash,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';

const requests=new Map<string,{phone:string;hash:Buffer;expires:number;attempts:number}>();
const digest=(value:string)=>createHash('sha256').update(value).digest();
const localHost=(host:string)=>/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
export function developmentOtpEnabled(env:NodeJS.ProcessEnv=process.env,host=''){
 return env.NODE_ENV==='development' && env.DATABASE_ENV==='development' &&
   env.DEV_OTP_PREVIEW==='true' && localHost(host);
}
export function handleDevelopmentOtp(req:IncomingMessage,res:ServerResponse,body:any,env:NodeJS.ProcessEnv=process.env):boolean{
 if(!['dev_otp_request','dev_otp_verify'].includes(body?.action))return false;
 const send=(status:number,record:Record<string,unknown>)=>{res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(record));};
 if(!developmentOtpEnabled(env,String(req.headers.host||''))){
  send(404,{success:false,message:'حالت آزمایشی تأیید موبایل غیرفعال است.'});return true;
 }
 const phone=String(body.phone||'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
 if(!/^09\d{9}$/.test(phone)){send(400,{success:false,message:'شماره موبایل نامعتبر است.'});return true;}
 const now=Date.now();
 for(const [id,entry] of requests)if(entry.expires<=now)requests.delete(id);
 if(body.action==='dev_otp_request'){
  const code=String(randomInt(100000,1000000)),requestId=randomUUID();
  requests.set(requestId,{phone,hash:digest(requestId+':'+code),expires:now+120000,attempts:0});
  send(200,{success:true,preview:true,requestId,devCode:code,retryAfter:30,message:'کد فقط برای آزمایش در مرورگر نمایش داده می‌شود؛ هیچ حساب کاربری تأیید نشده است.'});
  return true;
 }
 const requestId=String(body.requestId||''),entry=requests.get(requestId);
 if(!entry||entry.expires<=now||entry.phone!==phone){send(401,{success:false,message:'درخواست منقضی یا نامعتبر است.'});return true;}
 if(++entry.attempts>5){requests.delete(requestId);send(429,{success:false,message:'تعداد تلاش‌ها بیشتر از حد مجاز است.'});return true;}
 const candidate=digest(requestId+':'+String(body.code||''));
 if(!timingSafeEqual(entry.hash,candidate)){send(401,{success:false,message:'کد صحیح نیست.'});return true;}
 requests.delete(requestId);
 send(200,{success:true,previewVerified:true,message:'کد آزمایشی صحیح است؛ این تأیید مالکیت شماره نیست و نشست ورود ایجاد نمی‌کند.'});
 return true;
}
