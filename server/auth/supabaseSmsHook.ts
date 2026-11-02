/**
 * Supabase Auth Send SMS hook. Supabase generates and verifies the OTP;
 * the application only transports the code through the server-side SMS provider.
 *
 * Configure Authentication > Hooks > Send SMS with HTTPS /api/hooks/send-sms.
 * Hook secret (v1,whsec_...) and Kavenegar key are server environment variables,
 * never injected into the browser or committed to Git.
 */
import type {Express} from 'express';
import express from 'express';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {sendVerificationCode,smsConfigured} from '../../api/sms';

type HookHeaders={id?:string;timestamp?:string;signature?:string};
const isSixDigits=(value:string)=>/^\d{6}$/.test(value);
const getSecretBytes=(secret:string)=>{
  const part=secret.trim().replace(/^v\d+,whsec_/,'');
  if(!/^[a-zA-Z0-9+/=_-]{24,}$/.test(part))return null;
  const bytes=Buffer.from(part.replace(/-/g,'+').replace(/_/g,'/'),'base64');
  return bytes.length>=16?bytes:null;
};

/** Validate the Standard Webhooks HMAC over the original (unparsed) request bytes. */
export function verifySmsHookSignature(raw:Buffer,headers:HookHeaders,secret:string,now=Date.now()):boolean{
  const {id='',timestamp='',signature=''}=headers;
  if(!id||id.length>200||!/^[0-9]{10}$/.test(timestamp)||!signature)return false;
  if(Math.abs(now-Number(timestamp)*1000)>300_000)return false;
  const key=getSecretBytes(secret);
  if(!key)return false;
  const expected=createHmac('sha256',key).update(id+'.'+timestamp+'.').update(raw).digest();
  for(const item of signature.split(/\s+/)){
    if(!item.startsWith('v1,'))continue;
    const encoded=item.slice(3);
    if(!/^[a-zA-Z0-9+/=_-]{32,}$/.test(encoded))continue;
    const received=Buffer.from(encoded.replace(/-/g,'+').replace(/_/g,'/'),'base64');
    if(received.length===expected.length&&timingSafeEqual(received,expected))return true;
  }
  return false;
}

export function registerSupabaseSmsHook(app:Express){
  // Raw body must be captured BEFORE global express.json() middleware.
  app.post('/api/hooks/send-sms',express.raw({type:'application/json',limit:'16kb'}),async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const secret=process.env.SUPABASE_SEND_SMS_HOOK_SECRET||'';
    if(!secret||!smsConfigured()||process.env.SUPABASE_SMS_READY!=='true')
      return res.status(503).json({error:{message:'SMS provider not configured'}});
    if(!Buffer.isBuffer(req.body)||!verifySmsHookSignature(req.body,{
      id:String(req.headers['webhook-id']||''),
      timestamp:String(req.headers['webhook-timestamp']||''),
      signature:String(req.headers['webhook-signature']||''),
    },secret))return res.status(401).json({error:{message:'Invalid webhook signature'}});
    try{
      const event=JSON.parse(req.body.toString('utf8'));
      const phone=String(event?.user?.phone||'').replace(/^\+98/,'0');
      const otp=String(event?.sms?.otp||'');
      if(!/^09\d{9}$/.test(phone)||!isSixDigits(otp))
        return res.status(400).json({error:{message:'Invalid phone or code'}});
      await sendVerificationCode(phone,otp);
      return res.status(200).end();
    }catch{
      // Never log/persist the OTP, callback payload, or SMS provider credentials.
      return res.status(503).json({error:{message:'SMS delivery failed'}});
    }
  });
}
