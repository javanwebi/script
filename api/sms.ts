/** Server-only OTP transport. Supabase Auth owns verification and session creation. */
type SmsProvider='kavenegar'|'smsir';
// SMS.ir is the primary SMS provider for SanatPish. Kavenegar remains opt-in only.
const provider=():SmsProvider=>process.env.SMS_PROVIDER==='kavenegar'?'kavenegar':'smsir';

export const smsConfigured=()=>{
  if(provider()==='smsir')return Boolean(process.env.SMSIR_API_KEY&&/^[0-9]+$/.test(process.env.SMSIR_TEMPLATE_ID||''));
  return Boolean(process.env.KAVENEGAR_API_KEY&&process.env.KAVENEGAR_VERIFY_TEMPLATE);
};

async function sendKavenegar(phone:string,code:string){
  const response=await fetch(
    `https://api.kavenegar.com/v1/${encodeURIComponent(process.env.KAVENEGAR_API_KEY!)}/verify/lookup.json`,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({receptor:phone,token:code,template:process.env.KAVENEGAR_VERIFY_TEMPLATE!,type:'sms'}),
      signal:AbortSignal.timeout(5000),
    });
  const data=await response.json();
  if(!response.ok||data.return?.status!==200)throw Error('SMS provider rejected');
}

async function sendSmsIr(phone:string,code:string){
  const response=await fetch('https://api.sms.ir/v1/send/verify',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':process.env.SMSIR_API_KEY!},
    body:JSON.stringify({
      mobile:phone,
      templateId:Number(process.env.SMSIR_TEMPLATE_ID),
      parameters:[{name:process.env.SMSIR_CODE_PARAMETER||'Code',value:code}],
    }),
    signal:AbortSignal.timeout(5000),
  });
  const data=await response.json();
  if(!response.ok||data.status!==1)throw Error('SMS provider rejected');
}

export async function sendVerificationCode(phone:string,code:string){
  if(!smsConfigured())throw Object.assign(
    new Error('ورود پیامکی هنوز فعال نشده است؛ با رمز عبور وارد شوید.'),{status:503});
  if(!/^09\d{9}$/.test(phone)||!/^\d{6}$/.test(code))
    throw Object.assign(new Error('شماره یا کد تأیید معتبر نیست.'),{status:400});
  try{
    if(provider()==='smsir')await sendSmsIr(phone,code);
    else await sendKavenegar(phone,code);
  }catch{
    // Never log provider responses: some return the phone and verification code.
    throw Object.assign(new Error('ارسال پیامک انجام نشد؛ دوباره تلاش کنید یا با رمز عبور وارد شوید.'),{status:503});
  }
}
