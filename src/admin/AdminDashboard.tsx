import React,{useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Clock,ShoppingBag,ShieldAlert,Users,RefreshCw} from 'lucide-react';
import {adminService} from '../services/adminService';
import {RealReportTable,MiniSalesTrend,ReportLink,useRealAdminReports,nf,currency} from './AdminReports';

export const AdminDashboard:React.FC<{onNavigateTab:(tab:string)=>void}>=({onNavigateTab})=>{
 const [period,setPeriod]=useState('30');
 const {report,loading,error,reload}=useRealAdminReports(period);
 const inquiries=adminService.getInquiries().filter(i=>i.status==='pending');
 const pendingOrders=adminService.getOrders().filter(o=>o.status==='registered'||o.status==='processing'||o.status==='pending');
 const pendingAgencies=adminService.getAgencyApplications().filter(a=>a.status==='pending');
 const alerts=[{title:'استعلام‌های بدون پاسخ',count:inquiries.length,tab:'pricing_inquiries',icon:Clock},{title:'سفارش‌های در انتظار ارسال',count:pendingOrders.length,tab:'orders',icon:ShoppingBag},{title:'درخواست‌های عاملیت',count:pendingAgencies.length,tab:'agencies',icon:ShieldAlert}];
 return <div className="space-y-6 text-right" dir="rtl">
  <div className="grid md:grid-cols-3 gap-4">{alerts.map(a=><button key={a.title} onClick={()=>onNavigateTab(a.tab)} className="bg-white border border-slate-200 rounded-2xl p-5 text-right flex items-center gap-3 hover:border-[#E06518]"><a.icon className="text-[#E06518]"/><span><strong className="block text-sm">{a.title}</strong><small className="text-slate-500">{nf(a.count)} مورد</small></span></button>)}</div>
  <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap gap-3 justify-between items-center">
   <div><h2 className="text-lg font-black text-[#55565A]">داشبورد و تحلیل فروش واقعی</h2><p className="text-xs text-slate-500 mt-1">مبنای آمار: سفارش‌های قطعی ذخیره‌شده در Supabase PostgreSQL؛ بدون اعداد نمایشی</p></div>
   <div className="flex gap-2 items-center"><select aria-label="بازه زمانی گزارش" value={period} onChange={e=>setPeriod(e.target.value)} className="border rounded-xl p-2 text-sm"><option value="30">۳۰ روز اخیر</option><option value="90">۹۰ روز اخیر</option><option value="365">یک سال اخیر</option><option value="all">تمام زمان‌ها</option></select><button aria-label="به‌روزرسانی" onClick={reload} className="p-2 border rounded-xl"><RefreshCw size={16}/></button></div>
  </div>
  {error&&<div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">{error} — آمار نمایشی جایگزین نمی‌شود.</div>}
  {loading?<div className="bg-white border rounded-xl p-12 text-center">در حال دریافت گزارش واقعی…</div>:report&&!error?<React.Fragment>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[{title:'تعداد سفارش‌های قطعی',value:nf(report.overview.order_count)},{title:'ارزش فروش',value:currency(report.overview.revenue)},{title:'میانگین ارزش سفارش',value:currency(report.overview.avg_order)},{title:'عاملیت‌های فعال',value:nf(report.topAgencies.length)}].map(card=><div key={card.title} className="bg-white border border-slate-200 rounded-2xl p-5"><div className="text-xs text-slate-500">{card.title}</div><div className="font-black text-xl mt-2 text-[#55565A]">{card.value}</div></div>)}
    </div>
    <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2"><MiniSalesTrend report={report}/></div><div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="font-black text-[#55565A] mb-4">سهم دسته‌بندی‌ها از فروش</div>{report.categories.length?report.categories.map(c=>{const all=report.categories.reduce((s,x)=>s+Number(x.revenue),0);const percent=all>0?Number(c.revenue)/all*100:0;return <div className="my-3" key={c.category}><div className="flex justify-between text-xs"><span>{c.category}</span><span>{nf(percent)}٪</span></div><div className="h-2 rounded bg-slate-100 mt-1" dir="ltr"><div className="h-full bg-[#E06518] rounded" style={{width:percent+'%'}}/></div></div>}):<p className="text-sm text-slate-500 py-10 text-center">هنوز داده واقعی فروش وجود ندارد.</p>}</div></div>
    <div className="grid xl:grid-cols-3 gap-5">
      {(['products','customers','agencies'] as const).map(kind=><section key={kind} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"><header className="space-y-2"><h3 className="font-black text-[#55565A]">{kind==='products'?'پرفروش‌ترین کالاها':kind==='customers'?'مشتریان برتر سازمانی':'عاملیت‌های فعال'}</h3><ReportLink kind={kind}/></header><RealReportTable kind={kind} report={report} limit={5}/></section>)}
    </div>
   </React.Fragment>:null}
 </div>;
};
