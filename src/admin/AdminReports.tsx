import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowRight,Download,RefreshCw,Search,BarChart3} from 'lucide-react';

export type RankingKind='products'|'customers'|'agencies';
export type DashboardReport={
 success:boolean;period:string;currency:string;
 overview:{order_count:number;revenue:string;avg_order:string};
 topProducts:Array<{code:string;name:string;quantity:string;revenue:string;order_count:number}>;
 topCustomers:Array<{id:string;name:string;company:string;city:string;revenue:string;order_count:number;last_order:string|null}>;
 topAgencies:Array<{id:string;code:string;name:string;company_name:string;city:string;province:string;revenue:string;order_count:number;last_order:string|null;contract_status:string}>;
 trend:Array<{day:string;revenue:string;orders:number}>;
 categories:Array<{category:string;revenue:string}>;
};
const nf=(v:number|string|undefined)=>Number(v||0).toLocaleString('fa-IR',{maximumFractionDigits:0});
const currency=(v:number|string|undefined)=>nf(v)+' تومان';
export function useRealAdminReports(period:string){
 const [report,setReport]=useState<DashboardReport|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
   const controller=new AbortController();
   setLoading(true);setError('');
   fetch('/api/admin/reports?period='+encodeURIComponent(period),{credentials:'same-origin',signal:controller.signal})
    .then(async r=>{const json=await r.json();if(!r.ok||!json.success)throw new Error(json.message||'خطا در دریافت گزارش');return json as DashboardReport;})
    .then(data=>{setReport(data);setLoading(false);})
    .catch(e=>{if(controller.signal.aborted)return;setError(e.message||'دریافت گزارش امکان‌پذیر نشد.');setLoading(false);});
   return ()=>controller.abort();
 },[period,refresh]);
 return {report,loading,error,reload:()=>setRefresh(x=>x+1)};
}
export const reportPaths={products:'/admin/reports/top-products',customers:'/admin/reports/top-customers',agencies:'/admin/reports/top-agencies'} as const;
const titles={products:'پرفروش‌ترین کالاها',customers:'مشتریان برتر سازمانی',agencies:'عامل‌های فعال شبکه پخش'};
export function ReportLink({kind}:{kind:RankingKind}){
 const navigate=useNavigate();
 return <button type="button" className="text-[#E06518] font-bold text-sm hover:underline" onClick={()=>navigate(reportPaths[kind])}>مشاهده همه و رتبه‌بندی ←</button>;
}
export const RealReportTable:React.FC<{kind:RankingKind;report:DashboardReport;limit?:number;search?:string}> =({kind,report,limit,search=''})=>{
 const rows=kind==='products'?report.topProducts:kind==='customers'?report.topCustomers:report.topAgencies;
 const filtered=rows.filter((r)=>Object.values(r).some(v=>String(v??'').toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 const shown=limit?filtered.slice(0,limit):filtered;
 if(!shown.length)return <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-xl">هنوز داده واقعی برای این رتبه‌بندی ثبت نشده است.</div>;
 return <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="text-slate-500 bg-slate-50"><tr><th className="p-3">رتبه</th><th className="p-3">{kind==='products'?'کالا':kind==='customers'?'مشتری':'عاملیت'}</th><th className="p-3">{kind==='products'?'تعداد فروش':'سفارش‌های قطعی'}</th><th className="p-3">ارزش فروش (تومان)</th></tr></thead><tbody>{shown.map((item,index)=>{
 const name=kind==='products'?(item as DashboardReport['topProducts'][number]).name:kind==='customers'?((item as DashboardReport['topCustomers'][number]).company||(item as DashboardReport['topCustomers'][number]).name):((item as DashboardReport['topAgencies'][number]).company_name||(item as DashboardReport['topAgencies'][number]).name);
 const count=kind==='products'?(item as DashboardReport['topProducts'][number]).quantity:(item as DashboardReport['topCustomers'][number]).order_count;
 const key='code' in item?item.code:item.id;
 return <tr key={key} className="border-b border-slate-100"><td className="p-3 font-bold text-[#E06518]">{nf(index+1)}</td><td className="p-3 font-medium">{name||'بدون عنوان'}<p className="text-xs text-slate-400">{'code' in item?item.code:'city' in item?item.city:''}</p></td><td className="p-3">{nf(count)}</td><td className="p-3 font-bold">{currency(item.revenue)}</td></tr>;
 })}</tbody></table></div>;
};
function downloadCsv(kind:RankingKind,report:DashboardReport){
 const rows=kind==='products'?report.topProducts:kind==='customers'?report.topCustomers:report.topAgencies;
 const csv=['\uFEFF'+['rank','name','code','quantity_or_orders','sales_irt'].join(','),...rows.map((item,i)=>{const name='company_name'in item?item.company_name||item.name:'company'in item?item.company||item.name:item.name;const code='code'in item?item.code:item.id;const count='quantity'in item?item.quantity:item.order_count;return [i+1,name,code,count,item.revenue].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')})].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='sanatpish-'+kind+'-'+report.period+'.csv';anchor.click();URL.revokeObjectURL(url);
}
export function AdminRankingPage({kind}:{kind:RankingKind}){
 const navigate=useNavigate();
 const [period,setPeriod]=useState('30');const [query,setQuery]=useState('');const {report,loading,error,reload}=useRealAdminReports(period);
 return <div className="space-y-5 text-right" dir="rtl">
  <button className="flex items-center gap-2 text-sm text-[#55565A]" onClick={()=>navigate('/admin')}><ArrowRight size={16}/> بازگشت به داشبورد</button>
  <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
   <div><h1 className="font-black text-xl text-[#55565A]">{titles[kind]}</h1><p className="text-xs text-slate-500 mt-2">آمار واقعی PostgreSQL • سفارش‌های تأییدشده، در حال بسته‌بندی، ارسال‌شده یا تحویل‌شده • بدون داده نمایشی</p></div>
   <div className="flex gap-2">
    <button className="rounded-xl border p-2" aria-label="بارگذاری مجدد" onClick={reload}><RefreshCw size={16}/></button>
    <button disabled={!report} onClick={()=>report&&downloadCsv(kind,report)} className="flex gap-2 items-center rounded-xl border px-3 py-2 disabled:opacity-40"><Download size={16}/> خروجی CSV مخصوص Excel</button>
   </div>
  </div>
  <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
   <label className="flex items-center gap-2 border rounded-xl px-3 py-2"><Search size={16}/><input className="outline-none bg-transparent" placeholder="جستجو در رتبه‌بندی" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <select aria-label="بازه زمانی" className="border rounded-xl px-3 py-2" value={period} onChange={e=>setPeriod(e.target.value)}><option value="30">۳۰ روز اخیر</option><option value="90">۹۰ روز اخیر</option><option value="365">یک سال اخیر</option><option value="all">تمام زمان‌ها</option></select>
  </div>
  <div className="bg-white border border-slate-200 rounded-2xl p-5">{loading?<div className="py-12 text-center">در حال دریافت آمار واقعی…</div>:error?<div role="alert" className="text-red-600 py-10">{error}</div>:report?<RealReportTable kind={kind} report={report} search={query}/>:null}</div>
 </div>;
}
export function MiniSalesTrend({report}:{report:DashboardReport}){
 const points=report.trend.slice(-30);const max=Math.max(1,...points.map(x=>Number(x.revenue)));
 return <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"><div className="flex items-center gap-2 font-black text-[#55565A]"><BarChart3 size={18}/> روند فروش واقعی</div>{points.length?<div className="flex items-end gap-1 h-36">{points.map(p=><div key={p.day} title={p.day+' — '+currency(p.revenue)} className="flex-1 bg-[#E06518] rounded-t" style={{height:Math.max(3,Number(p.revenue)/max*100)+'%'}}/>)}</div>:<div className="bg-slate-50 rounded-xl py-12 text-center text-slate-500">برای نمایش نمودار هنوز سفارش قطعی ثبت نشده است.</div>}</section>;
}
export {nf,currency};
