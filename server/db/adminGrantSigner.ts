import crypto from 'node:crypto';
import {validPermissions} from './adminPermissions';
// The public user_profiles.preferences JSON is editable by its owner through RLS.
// Therefore employee grants are signed by the server and bound to the Auth UUID.
const key=()=>{
 const secret=process.env.PORTAL_SESSION_SECRET || '';
 if(secret.length<32)throw Object.assign(new Error('امضای امن دسترسی کارکنان در سرور تنظیم نشده است.'),{status:503});
 return secret;
};
const payload=(userId:string,permissions:string[])=>userId+':'+[...permissions].sort().join(',');
export function signStaffGrant(userId:string,raw:unknown){
 const permissions=validPermissions(raw);
 if(!permissions.length||permissions.includes('settings'))throw Object.assign(new Error('مجوزهای کارمند معتبر نیست.'),{status:400});
 const signature=crypto.createHmac('sha256',key()).update(payload(userId,permissions)).digest('hex');
 return {adminPermissions:permissions,adminPermissionsMac:signature};
}
export function verifiedStaffPermissions(userId:string,preferences:any):string[]{
 try{
  const permissions=validPermissions(preferences?.adminPermissions);
  const signature=String(preferences?.adminPermissionsMac||'');
  if(!permissions.length||permissions.includes('settings')||!/^[0-9a-f]{64}$/.test(signature))return [];
  const expected=crypto.createHmac('sha256',key()).update(payload(userId,permissions)).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'))?permissions:[];
 }catch{return []}
}
