import React from 'react';
export type SecurityTab='overview'|'access'|'payments'|'messaging'|'shipping'|'website'|'integrations'|'activity'|'backups';
export type Payment={provider:'mellat'|'saman'|'zarinpal';merchantId:string;terminalId:string;sandbox:boolean};
export type Shipping={barbari:boolean;tipax:boolean;expressPost:boolean;dedicatedFleet:boolean};
export type Seo={metaTitle:string;metaDescription:string;keywords:string;canonicalBase:string};
export interface SecuritySettings{
 id:string;updatedAt:string;paymentGateway:Payment;
 smsProvider:{provider:string;senderNumber:string;configured:boolean;ready:boolean};
 shippingMethods:Shipping;currency:'toman'|'rial';seo:Seo;
}
export interface SecurityOverview{
 db:{name:string;bytes:string;checked_at:string;started_at:string};
 counts:{profiles:number;staff:number;active_staff:number;audits:number;sms:number;tables:number};
 sms:{provider:string;configured:boolean;ready:boolean};
}
export const field='w-full min-w-0 rounded-xl border border-[#E3E6EB] bg-white px-4 py-3 text-sm text-[#363E49] outline-none transition focus:border-[#E56B1E] focus:ring-4 focus:ring-orange-500/10';
export const panel='rounded-[24px] border border-[#E8EAEE] bg-white p-5 shadow-[0_8px_30px_rgba(30,36,45,.035)] sm:p-6';
export const primary='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#D26018] disabled:opacity-50';
export const secondary='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E0E3E8] bg-white px-4 py-3 text-xs font-bold text-[#626A76] transition hover:border-orange-300 disabled:opacity-50';
export function faDate(iso?:string){if(!iso)return '—';const d=new Date(iso);return Number.isNaN(d.getTime())?'—':d.toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'});}
export async function securityApi<T>(url:string,method='GET',body?:unknown):Promise<T>{
 const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({success:false,message:'پاسخ سرور معتبر نیست'}));
 if(!r.ok||!data.success)throw Error(data.message||'دریافت اطلاعات از سرور ممکن نشد');
 return data as T;
}
export const SectionTitle:React.FC<{title:string;subtitle:string;icon:React.ElementType}>=({title,subtitle,icon:Icon})=>
 <div className="mb-5 flex items-start gap-3">
  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF0E3] text-[#E56B1E]"><Icon size={21}/></span>
  <div><h3 className="text-base font-black text-[#353B44]">{title}</h3><p className="mt-1 text-xs leading-6 text-[#9299A3]">{subtitle}</p></div>
 </div>;
