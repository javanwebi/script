import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { database } from './connection';

const periodDays: Record<string, number | null> = {'30':30,'90':90,'365':365,all:null};
type ReportRow = Record<string, unknown>;
const number = (value:unknown) => Number(value || 0);
const dateCondition = "( $1::integer is null or o.created_at >= now() - make_interval(days => $1::integer) )";
const eligible = "o.status::text in ('confirmed','packing','shipped','delivered') and coalesce(o.payment_status,'') not in ('failed','refunded','cancelled')";
const amount = "(coalesce(nullif(o.final_amount,0),o.total_amount,0) / case when o.currency='IRR' then 10 else 1 end)";
const errorResponse = (res:Response,status:number,message:string)=>res.status(status).json({success:false,message});

export async function adminReportsApi(req:Request,res:Response){
 try{
  if(process.env.DATA_BACKEND!=='postgres')return errorResponse(res,503,'گزارش واقعی فقط با PostgreSQL در دسترس است.');
  const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('sp_access='))?.slice(10);
  if(!token)return errorResponse(res,401,'برای مشاهده گزارش وارد حساب مدیریت شوید.');
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if(!url || !key)return errorResponse(res,503,'احراز هویت Supabase پیکربندی نشده است.');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const identity=await client.auth.getUser(token);
  if(identity.error || !identity.data.user)return errorResponse(res,401,'نشست مدیریت منقضی شده است.');
  const p=await database().query("select role::text as role from public.user_profiles where id=$1 and status='active'",[identity.data.user.id]);
  if(p.rows[0]?.role!=='super_admin')return errorResponse(res,403,'این گزارش فقط برای مدیر سامانه است.');
  const period=typeof req.query.period==='string' && req.query.period in periodDays?req.query.period:'30';
  const days=periodDays[period];
  const db=database();
  const [overview,topProducts,topCustomers,topAgencies,trend,categories]=await Promise.all([
   db.query(`select count(*)::int order_count,coalesce(sum(${amount}),0) revenue,coalesce(avg(${amount}),0) avg_order from public.orders o where ${eligible} and ${dateCondition}`,[days]),
   db.query(`select oi.product_code code,max(oi.product_name) name,sum(oi.quantity)::numeric quantity,sum(oi.total_price / case when o.currency='IRR' then 10 else 1 end) revenue,count(distinct o.id)::int order_count from public.order_items oi join public.orders o on o.id=oi.order_id where ${eligible} and ${dateCondition} group by oi.product_code order by quantity desc,revenue desc limit 500`,[days]),
   db.query(`select c.id,c.name,c.company,c.city,coalesce(sum(${amount}),0) revenue,count(o.id)::int order_count,max(o.created_at) last_order from public.crm_customers c left join public.orders o on o.crm_customer_id=c.id and ${eligible} and ${dateCondition} group by c.id,c.name,c.company,c.city having count(o.id)>0 order by revenue desc,order_count desc limit 500`,[days]),
   db.query(`select a.id,a.code,a.name,a.company_name,a.city,a.province,a.contract_status,coalesce(sum(${amount}),0) revenue,count(o.id)::int order_count,max(o.created_at) last_order from public.agencies a left join public.orders o on o.metadata->>'agencyId'=a.id and ${eligible} and ${dateCondition} where a.contract_status in ('active','approved','signed') group by a.id,a.code,a.name,a.company_name,a.city,a.province,a.contract_status order by revenue desc,order_count desc,a.created_at limit 500`,[days]),
   db.query(`select to_char(date_trunc('day',o.created_at),'YYYY-MM-DD') AS "day",coalesce(sum(${amount}),0) revenue,count(*)::int orders from public.orders o where ${eligible} and ${dateCondition} group by 1 order by 1`,[days]),
   db.query(`select coalesce(f.category_name,'دسته‌بندی نامشخص') category,sum(oi.total_price / case when o.currency='IRR' then 10 else 1 end) revenue from public.order_items oi join public.orders o on o.id=oi.order_id left join public.catalog_variants v on v.code=oi.product_code left join public.catalog_families f on f.code=v.family_code where ${eligible} and ${dateCondition} group by 1 order by revenue desc limit 12`,[days]),
  ]);
  res.setHeader('Cache-Control','private, no-store');
  return res.json({success:true,period,currency:'IRT',source:'supabase-postgresql',overview:overview.rows[0],topProducts:topProducts.rows,topCustomers:topCustomers.rows,topAgencies:topAgencies.rows,trend:trend.rows,categories:categories.rows});
 }catch(err){
  console.error('[Admin reports]',err instanceof Error?err.message:'unknown');
  return errorResponse(res,503,'دریافت گزارش واقعی از دیتابیس انجام نشد.');
 }
}
