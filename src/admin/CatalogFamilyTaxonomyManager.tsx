import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../data/approvedMenuFallback';

type UnassignedFamily={code:string;name:string;oldCategory:string;oldSubmenu:string;skuCount:number};
type MenuNode={name:string;children?:MenuNode[]};

export const CatalogFamilyTaxonomyManager:React.FC=()=>{
  const [families,setFamilies]=useState<UnassignedFamily[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<UnassignedFamily|null>(null);
  const [categorySlug,setCategorySlug]=useState('');
  const [submenu,setSubmenu]=useState('');
  const [leaf,setLeaf]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [limit,setLimit]=useState(30);

  const load=async()=>{
    try{
      const res=await fetch('/api/catalog/menu-unassigned',{credentials:'same-origin',cache:'no-store'});
      const body=await res.json();
      if(!res.ok||!body.success||!Array.isArray(body.families))throw Error(body.message||'خطا در خواندن داده');
      setFamilies(body.families);
      setStatus('ready');
    }catch{setStatus('error');}
  };
  useEffect(()=>{void load();},[]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase();
    return families.filter(f=>!q||[f.name,f.code,f.oldCategory,f.oldSubmenu]
      .some(v=>(v||'').toLocaleLowerCase().includes(q)));
  },[families,query]);
  const category=APPROVED_MENU_CATEGORIES.find(c=>c.slug===categorySlug);
  const availableSubmenus=(category?.children||[]) as MenuNode[];
  const availableLeaves=availableSubmenus.find(x=>x.name===submenu)?.children||[];

  const choose=(family:UnassignedFamily)=>{
    setSelected(family);setError('');setNotice('');setCategorySlug('');setSubmenu('');setLeaf('');
  };
  const save=async()=>{
    if(!selected||!categorySlug||!submenu){setError('لطفاً دسته و زیرمنوی دقیق را انتخاب کن.');return;}
    setSaving(true);setError('');
    try{
      const res=await fetch('/api/catalog/menu-family-assignment',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({familyCode:selected.code,categorySlug,submenu,leaf})
      });
      const data=await res.json();
      if(!res.ok||!data.success)throw Error(data.message||'ذخیره ناموفق بود');
      setFamilies(current=>current.filter(f=>f.code!==selected.code));
      setNotice('خانواده به مسیر انتخاب‌شده در دیتابیس متصل شد.');
      window.dispatchEvent(new Event('catalog-family-menu-updated'));

      setSelected(null);setCategorySlug('');setSubmenu('');setLeaf('');
    }catch(e){setError(e instanceof Error?e.message:'خطا در اتصال خانواده');}
    finally{setSaving(false);}
  };

  return <section dir="rtl" className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
    <header>
      <h3 className="font-black text-slate-800">اتصال خانواده‌های باقی‌مانده به مگامنوی مصوب</h3>
      <p className="mt-1 text-xs leading-6 text-slate-600">
        تطبیق‌های مطمئن خودکار ثبت شده‌اند. خانواده‌های نامشخص را بدون تغییر دسته اصلی یا کد کالا، دستی به یکی از ۱۴ گروه، ۳۴ دسته و زیرمنوهای فایل وصل کن.
      </p>
    </header>
    {status==='loading'&&<p role="status" className="text-xs text-slate-600">در حال دریافت خانواده‌های بررسی‌نشده…</p>}
    {status==='error'&&<button onClick={()=>void load()} className="rounded-lg border bg-white px-4 py-2 text-xs">خواندن داده ناموفق بود؛ تلاش دوباره</button>}
    {status==='ready'&&<>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-700">{families.length} خانواده بدون مسیر تأییدشده</span>
        <label className="flex min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} className="min-w-0 flex-1 text-xs outline-none" placeholder="جست‌وجوی کد یا نام خانواده"/>
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {filtered.slice(0,limit).map(f=><button key={f.code} type="button" onClick={()=>choose(f)}
          className={`rounded-xl border bg-white p-3 text-right hover:border-orange-400 ${selected?.code===f.code?'border-[#E56B1E]':'border-slate-200'}`}>
          <div className="text-xs font-bold text-slate-800">{f.name}</div>
          <div className="mt-2 text-[11px] text-slate-500">{f.oldCategory} / {f.oldSubmenu}</div>
          <div className="mt-1 text-[11px] text-slate-400" dir="ltr">{f.code} · {f.skuCount} SKU</div>
        </button>)}
      </div>
      {filtered.length>limit&&<button className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-orange-700" onClick={()=>setLimit(n=>n+30)}>نمایش ۳۰ خانواده دیگر</button>}
      {selected&&<div className="space-y-3 rounded-xl border border-orange-300 bg-white p-4">
        <h4 className="text-sm font-bold text-slate-800">تعیین مسیر: {selected.name}</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-bold">دسته (سطح ۲)
            <select className="w-full rounded-lg border p-2 text-xs" value={categorySlug}
              onChange={e=>{setCategorySlug(e.target.value);setSubmenu('');setLeaf('');}}>
              <option value="">انتخاب دسته</option>
              {APPROVED_MENU_GROUPS.map(group=><optgroup key={group.id} label={group.title}>
                {group.categorySlugs.map(slug=>{
                  const cat=APPROVED_MENU_CATEGORIES.find(x=>x.slug===slug);
                  return cat?<option key={cat.slug} value={cat.slug}>{cat.name}</option>:null;
                })}
              </optgroup>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold">زیرمنو (سطح ۳)
            <select className="w-full rounded-lg border p-2 text-xs" value={submenu} disabled={!categorySlug}
              onChange={e=>{setSubmenu(e.target.value);setLeaf('');}}>
              <option value="">انتخاب زیرمنو</option>
              {availableSubmenus.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold">ریزقلم (سطح ۴، در صورت انطباق)
            <select className="w-full rounded-lg border p-2 text-xs" value={leaf} disabled={!submenu}
              onChange={e=>setLeaf(e.target.value)}>
              <option value="">بدون ریزقلم مشخص</option>
              {availableLeaves.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </label>
        </div>
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={()=>void save()} className="rounded-lg bg-[#E56B1E] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">ذخیره ارتباط در Supabase</button>
          <button type="button" onClick={()=>setSelected(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs">لغو</button>
        </div>
      </div>}
      {notice&&<p role="status" className="flex items-center gap-2 text-xs text-green-700"><CheckCircle2 size={16}/>{notice}</p>}
    </>}
  </section>;
};
