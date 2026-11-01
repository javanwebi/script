import React,{useEffect,useMemo,useState} from 'react';
import {Check,Image as ImageIcon,Upload,ChevronDown} from 'lucide-react';
import type {Category} from '../types';

type NavGroup={id:string;title:string;iconKey:string;imageUrl:string|null;categorySlugs:string[];sortOrder:number;active:boolean};


export function CatalogNavigationGroupsEditor({categories}:{categories:Category[]}){
  const [groups,setGroups]=useState<NavGroup[]>([]);
  const [draft,setDraft]=useState<NavGroup|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const sorted=useMemo(()=>[...categories].sort((a,b)=>a.name.localeCompare(b.name,'fa')),[categories]);
  const reload=()=>{
    fetch('/api/catalog/navigation-groups?includeInactive=1',{credentials:'same-origin'})
      .then(async response=>{const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||'بارگذاری گروه‌ها انجام نشد.');return data.groups;})
      .then(items=>{
        const approved=(items as NavGroup[]).filter(group=>/^excel-v2-[0-9]+$/.test(group.id)&&group.active);
        setGroups(approved);setLoaded(true);
      })
      .catch(err=>setError(err.message||'اتصال به پایگاه داده برقرار نشد.'));
  };
  useEffect(()=>{reload();},[]);

  const upload=async(file:File)=>{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('فقط PNG/JPG/WebP تا ۸ مگابایت مجاز است.');
    const res=await fetch('/api/catalog/category-images/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type},body:file});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.url)throw Error(data.message||'آپلود تصویر انجام نشد.');
    setDraft(old=>old?{...old,imageUrl:data.url}:old);
  };
  const save=async()=>{
    if(!draft||!draft.title.trim()||busy)return;
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/catalog/navigation-groups',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw Error(data.message||'ثبت گروه ناموفق بود.');
      await reload();
      setDraft(null);
      window.dispatchEvent(new Event('catalog-navigation-groups-updated'));
    }catch(err){setError(err instanceof Error?err.message:'خطا در ثبت گروه');}
    finally{setBusy(false);}
  };
  return <section dir="rtl" className="space-y-4 rounded-2xl border border-slate-200 bg-[#FAFBFC] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-black text-[#55565A]">گروه‌بندی‌های مگامنو</h3>
        <p className="mt-1 text-[11px] leading-6 text-slate-500">این گروه‌ها فقط در «همه محصولات» نمایش داده می‌شوند. دسته‌بندی‌ها و اطلاعات کالا تغییر نمی‌کنند.</p></div>
      <span className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#C65A16]">۱۴ گروه‌بندی مصوب</span>
    </div>
    {!loaded&&<p className="text-xs text-slate-500">در حال دریافت گروه‌ها از پایگاه داده…</p>}
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {groups.map(group=><button key={group.id} type="button" onClick={()=>setDraft({...group,categorySlugs:[...group.categorySlugs]})} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-right hover:border-orange-300">
        {group.imageUrl?<img src={group.imageUrl} alt="" className="h-14 w-14 rounded-lg object-contain bg-slate-50"/>:<div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50"><ImageIcon size={20}/></div>}
        <span className="min-w-0 flex-1"><strong className="block text-xs text-slate-800">{group.title}</strong><small className="mt-1 block text-[10px] text-slate-500">{group.categorySlugs.length.toLocaleString('fa-IR')} دسته · ترتیب {group.sortOrder.toLocaleString('fa-IR')} {group.active?'':'· مخفی'}</small></span>
        <ChevronDown size={15} className="text-slate-400"/>
      </button>)}
    </div>
    {draft&&<div className="space-y-3 rounded-2xl border border-orange-200 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between"><h4 className="text-sm font-black text-[#55565A]">{draft.id?'ویرایش گروه مگامنو':'ساخت گروه مگامنو'}</h4><button type="button" onClick={()=>setDraft(null)} className="text-xs font-bold text-slate-600">بستن</button></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-[11px] font-bold text-slate-700">نام گروه<input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs"/></label>
        <label className="text-[11px] font-bold text-slate-700">آیکون<select value={draft.iconKey} onChange={e=>setDraft({...draft,iconKey:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs"><option value="layers">انتقال قدرت</option><option value="move">حرکت</option><option value="link-2">اتصالات</option><option value="box">قطعات مهندسی</option></select></label>
        <label className="text-[11px] font-bold text-slate-700">اولویت نمایش<input type="number" min={0} max={10000} value={draft.sortOrder} onChange={e=>setDraft({...draft,sortOrder:Number(e.target.value)||0})} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs"/></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
        {draft.imageUrl?<img src={draft.imageUrl} alt="تصویر گروه" className="h-20 w-20 rounded-xl bg-white object-contain"/>:<div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white"><ImageIcon size={23}/></div>}
        <label className="cursor-pointer rounded-lg border border-orange-300 bg-white px-3 py-2 text-[11px] font-bold text-[#C65A16]"><Upload size={14} className="inline"/> انتخاب تصویر گروه
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file){setBusy(true);void upload(file).catch(err=>setError(err.message)).finally(()=>setBusy(false));}e.target.value='';}}/>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> نمایش در مگامنو</label>
      </div>
      <h5 className="text-xs font-bold text-slate-700">انتخاب دسته‌بندی‌های زیر این گروه</h5>
      <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(category=><label key={category.slug} className="flex items-center gap-2 rounded-lg bg-white p-2 text-[11px] text-slate-700"><input type="checkbox" checked={draft.categorySlugs.includes(category.slug)} onChange={e=>setDraft({...draft,categorySlugs:e.target.checked?[...draft.categorySlugs,category.slug]:draft.categorySlugs.filter(slug=>slug!==category.slug)})}/><span className="truncate">{category.name}</span></label>)}
      </div>
      <p className="text-[10px] text-slate-500">برای انتقال یک دسته، آن را از گروه قبلی بردارید و در گروه جدید انتخاب کنید. هر دسته در مگامنو فقط یک‌بار نمایش داده می‌شود.</p>
      <button type="button" disabled={busy||!draft.title.trim()} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#E06518] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Check size={15}/>{busy?'در حال ذخیره…':'ثبت گروه و تغییرات در دیتابیس'}</button>
    </div>}
    {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
  </section>;
}
