import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {
 ShieldCheck,Shield,LayoutDashboard,Users,CreditCard,MessageSquare,Truck,Globe2,PlugZap,
 ScrollText,Database,RefreshCcw,Clock3,Wifi,WifiOff,ArrowLeft,Server,HardDrive,
 Activity,KeyRound,LockKeyhole,CheckCircle2,AlertTriangle
} from 'lucide-react';
import {SecurityOverview,SecuritySettings,SecurityTab,faDate,panel,secondary,SectionTitle,securityApi} from './SecurityCenterShared';
import {SecurityCenterConfig} from './SecurityCenterConfig';
import {SecurityCenterActivity} from './SecurityCenterActivity';
import {SecurityCenterDataExport} from './SecurityCenterDataExport';

const TABS:{id:SecurityTab;title:string;description:string;icon:React.ElementType}[]=[
 {id:'overview',title:'نمای کلی سامانه',description:'شاخص‌ها و وضعیت زنده',icon:LayoutDashboard},
 {id:'access',title:'ورود و امنیت',description:'مجوزها و کنترل کارکنان',icon:ShieldCheck},
 {id:'payments',title:'درگاه‌های پرداخت',description:'پیکربندی تجاری',icon:CreditCard},
 {id:'messaging',title:'پیامک و اعلان‌ها',description:'SMS.ir و سوابق ارسال',icon:MessageSquare},
 {id:'shipping',title:'ارسال و لجستیک',description:'روش‌های تحویل کالا',icon:Truck},
 {id:'website',title:'تنظیمات سایت',description:'هویت، سئو و واحد پول',icon:Globe2},
 {id:'integrations',title:'اتصالات و API',description:'سرویس‌های متصل',icon:PlugZap},
 {id:'activity',title:'تاریخچه فعالیت',description:'رویدادهای سروری',icon:ScrollText},
 {id:'backups',title:'داده‌ها و پشتیبان',description:'خروجی امن اطلاعات',icon:Database}
];
const number=(x:number|undefined)=>x===undefined?'—':Number(x).toLocaleString('fa-IR');
const Tile:React.FC<{title:string;value:string;detail:string;icon:React.ElementType}>=({title,value,detail,icon:Icon})=>
 <div className="min-w-0 rounded-2xl border border-[#E9EBEF] bg-white p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3">
   <div><p className="text-[11px] font-bold text-slate-500">{title}</p><p className="mt-2 break-all text-2xl font-black text-[#363D47]">{value}</p></div>
   <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-[#E56B1E]"><Icon size={19}/></span>
  </div><p className="mt-2 text-[11px] text-slate-400">{detail}</p>
 </div>;

export const SecurityCenterModule:React.FC=()=>{
 const [tab,setTab]=useState<SecurityTab>('overview');
 const [overview,setOverview]=useState<SecurityOverview|null>(null);
 const [settings,setSettings]=useState<SecuritySettings|null>(null);
 const [checking,setChecking]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [lastSync,setLastSync]=useState<Date|null>(null);
 async function sync(initial=false){
  if(initial)setChecking(true);
  const results=await Promise.allSettled([
   securityApi<SecurityOverview>('/api/admin/security/overview'),
   securityApi<{settings:SecuritySettings|null}>('/api/admin/security/settings')
  ]);
  if(results[0].status==='fulfilled')setOverview(results[0].value);
  if(results[1].status==='fulfilled')setSettings(results[1].value.settings);
  if(results.some(x=>x.status==='rejected'))setError('برخی اطلاعات از سرور دریافت نشدند؛ دسترسی مدیر و ارتباط PostgreSQL را بررسی کنید.');
  else{setError('');setLastSync(new Date());}
  setChecking(false);
 }
 useEffect(()=>{
  void sync(true);
  const focus=()=>{void sync();};
  window.addEventListener('focus',focus);
  const ticker=window.setInterval(()=>{if(document.visibilityState==='visible')void sync();},30000);
  return ()=>{window.removeEventListener('focus',focus);window.clearInterval(ticker);};
 },[]);
 const selected=TABS.find(item=>item.id===tab)!;
 const ActiveIcon=selected.icon;
 const notify=(message:string,failed=false)=>{if(failed){setError(message);setNotice('');}else{setNotice(message);setError('');}};
 const dbSize=overview?Number(overview.db.bytes)/1048576:NaN;
 return <div className="min-w-0 space-y-5 text-right" dir="rtl">
  <header className="relative isolate overflow-hidden rounded-[26px] bg-[#252A34] p-6 text-white shadow-[0_14px_34px_rgba(25,31,42,.12)] sm:p-8">
   <div className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full bg-[#E56B1E]/20 blur-3xl"/>
   <div className="relative flex flex-wrap items-start justify-between gap-4">
    <div className="flex items-start gap-4">
     <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-orange-300"><Shield size={29}/></span>
     <div><p dir="ltr" className="mb-2 text-left text-[10px] font-black tracking-[.22em] text-orange-300">SANATPISH · SYSTEM CONTROL</p>
      <h2 className="text-xl font-black sm:text-2xl">مرکز تنظیمات و امنیت</h2>
      <p className="mt-2 max-w-xl text-xs leading-7 text-white/65">تنظیمات چندبخشی و کنترل امنیت سامانه؛ متصل به داده‌های واقعی و سرور اختصاصی صنعت پیش</p>
     </div>
    </div>
    <button type="button" onClick={()=>void sync(true)} disabled={checking}
     className="flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50">
     <RefreshCcw size={16} className={checking?'animate-spin':''}/> تازه‌سازی</button>
   </div>
   <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-[11px] text-white/70">
    <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">{overview?<Wifi size={14} className="text-emerald-400"/>:<WifiOff size={14} className="text-amber-400"/>}{overview?'اتصال دیتابیس تأیید شد':'در انتظار پاسخ سرور'}</span>
    <span className="flex items-center gap-2"><Clock3 size={14}/> آخرین دریافت: {lastSync?lastSync.toLocaleTimeString('fa-IR'):'—'}</span>
    <span className="flex items-center gap-2"><LockKeyhole size={14}/> دسترسی مدیر اصلی</span>
   </div>
  </header>
  {error&&<div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800"><span className="flex items-center gap-2"><AlertTriangle size={17}/>{error}</span><button type="button" onClick={()=>setError('')} aria-label="بستن">×</button></div>}
  {notice&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">{notice}</div>}
  <div className="grid min-w-0 gap-5 lg:grid-cols-[215px_minmax(0,1fr)]">
   <nav aria-label="بخش‌های تنظیمات" className="flex min-w-0 gap-2 overflow-x-auto rounded-[22px] border border-[#ECEEF1] bg-white p-2 [scrollbar-width:thin] lg:flex-col lg:self-start lg:overflow-visible lg:p-3">
    {TABS.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" aria-current={tab===item.id?'page':undefined}
     onClick={()=>{setTab(item.id);setError('');setNotice('');}}
     className={'flex min-w-[145px] shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-right transition lg:min-w-0 '+(tab===item.id?'bg-[#FFF0E5] text-[#C55E1B]':'text-[#636B76] hover:bg-[#F6F7F9]')}>
     <Icon size={19} className="shrink-0"/><span className="min-w-0"><span className="block text-xs font-black">{item.title}</span><span className="mt-1 hidden text-[10px] text-slate-400 lg:block">{item.description}</span></span>
    </button>;})}
   </nav>
   <main className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
     <div className="flex items-center gap-2"><ActiveIcon size={20} className="text-[#E56B1E]"/><div><h3 className="text-base font-black text-[#343C46]">{selected.title}</h3><p className="mt-1 text-xs text-slate-400">{selected.description}</p></div></div>
     <span className="rounded-full bg-[#F0F2F5] px-3 py-2 text-[10px] font-bold text-[#7B838F]">داده واقعی سرور</span>
    </div>
    {tab==='overview'&&<>
     <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <Tile title="حساب‌های مشتری و کاربر" value={number(overview?.counts.profiles)} icon={Users} detail="user_profiles"/>
      <Tile title="کارکنان فعال" value={number(overview?.counts.active_staff)} icon={ShieldCheck} detail="مجوزهای سازمانی"/>
      <Tile title="جدول‌های دیتابیس" value={number(overview?.counts.tables)} icon={Database} detail="PostgreSQL"/>
      <Tile title="حجم PostgreSQL" value={Number.isFinite(dbSize)?dbSize.toLocaleString('fa-IR',{maximumFractionDigits:1})+' MB':'—'} icon={HardDrive} detail="اندازه گزارش‌شده دیتابیس"/>
      <Tile title="وقایع مدیریتی" value={number(overview?.counts.audits)} icon={Activity} detail="audit_logs"/>
      <Tile title="رویدادهای پیامک" value={number(overview?.counts.sms)} icon={MessageSquare} detail="sms_logs"/>
     </div>
     <section className={panel}><SectionTitle title="سلامت بخش‌های اصلی" subtitle="اطلاعات زنده بدون نمونه یا نمایش ساختگی" icon={Server}/>
      <div className="grid gap-3 sm:grid-cols-2">
       <p className="rounded-xl bg-[#F7F8FA] p-4 text-xs text-slate-600">PostgreSQL: <strong>{overview?.db.name||'نامشخص'}</strong></p>
       <p className="rounded-xl bg-[#F7F8FA] p-4 text-xs text-slate-600">آخرین بررسی: <strong>{faDate(overview?.db.checked_at)}</strong></p>
       <p className="rounded-xl bg-[#F7F8FA] p-4 text-xs text-slate-600">تنظیمات عمومی: <strong>{settings?'ثبت‌شده':'نیازمند بررسی'}</strong></p>
       <p className="rounded-xl bg-[#F7F8FA] p-4 text-xs text-slate-600">پیامک: <strong>{overview?.sms.configured?'پیکربندی‌شده':'تنظیم‌نشده'}</strong></p>
      </div>
     </section>
    </>}
    {tab==='access'&&<section className={panel}>
     <SectionTitle icon={KeyRound} title="امنیت مدیریت و مجوزها" subtitle="کاربران فقط در یک صفحه تعریف می‌شوند؛ اینجا دوباره فرم ساخت کارمند نداریم."/>
     <div className="grid gap-3 sm:grid-cols-2">
      <Tile title="کارکنان فعال" value={number(overview?.counts.active_staff)} detail="دسترسی‌های ثبت‌شده" icon={Users}/>
      <Tile title="کل حساب‌های سازمانی" value={number(overview?.counts.staff)} detail="کارمندان فعال و غیرفعال" icon={Shield}/>
     </div>
     <Link to="/admin/staff-users" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#E56B1E] px-5 py-3 text-xs font-black text-white hover:bg-[#CF601A]"><Users size={17}/> بازکردن مدیریت کاربران و دسترسی‌ها <ArrowLeft size={15}/></Link>
     <p className="mt-4 text-xs leading-7 text-slate-500">تغییر مجوزها از API سرور اعمال می‌شود. مدیریت مجوزها، تنظیمات محرمانه و خروجی کامل داده‌ها فقط برای مدیر اصلی است.</p>
    </section>}
    {(['payments','messaging','shipping','website'] as SecurityTab[]).includes(tab)&&<SecurityCenterConfig tab={tab as 'payments'|'messaging'|'shipping'|'website'} settings={settings} onSaved={v=>setSettings(v)} notify={notify}/>}
    {tab==='messaging'&&<SecurityCenterActivity mode="sms"/>}
    {tab==='integrations'&&<section className={panel}>
     <SectionTitle title="وضعیت اتصالات سرویس‌ها" subtitle="نمایش وضعیت مستند؛ اتصال‌های آزموده‌نشده سالم اعلام نمی‌شوند." icon={PlugZap}/>
     <div className="grid gap-3 sm:grid-cols-2">
      <Tile title="PostgreSQL اصلی" value={overview?'متصل':'نامشخص'} detail={overview?.db.name||'بدون پاسخ'} icon={Database}/>
      <Tile title="درگاه احراز هویت پیامکی" value={overview?.sms.ready?'پیکربندی آماده':'نیازمند بررسی'} detail={overview?.sms.provider||'نامشخص'} icon={MessageSquare}/>
      <Tile title="تعداد حساب‌های سازمانی" value={number(overview?.counts.staff)} detail="اطلاعات جدول اختصاصی" icon={Users}/>
      <Tile title="اتصال بانکی" value="تأیید نشده" detail="بدون تراکنش واقعی، وضعیت اتصال قابل ادعا نیست" icon={CreditCard}/>
     </div>
    </section>}
    {tab==='activity'&&<SecurityCenterActivity mode="audit"/>}
    {tab==='backups'&&<SecurityCenterDataExport/>}
   </main>
  </div>
 </div>;
};
