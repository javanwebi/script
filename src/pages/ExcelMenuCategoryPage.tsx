import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, Layers, Package, Search } from 'lucide-react';
import { getAllProducts, subscribeCatalogChanges } from '../data/mockGenerator';
import { ProductCard } from '../components/product/ProductCard';
import { DirectSkuProducts } from '../components/catalog/DirectSkuProducts';
import type { Product } from '../types';
import type { CategoryNode } from '../data/categories';

type MenuFamily = {
  code: string; name: string; brand: string;
  submenu: string | null; leaf: string | null; skuCount: number;
};
type MenuCategory = { slug: string; name: string; description: string; image: string | null; children: CategoryNode[] };
type MenuResponse = { success: boolean; category?: MenuCategory; families?: MenuFamily[]; message?: string };

export const ExcelMenuCategoryPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = searchParams.get('sub') || '';
  const [data, setData] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [search, setSearch] = useState('');
  const [catalogRevision, refreshProducts] = useState(0);

  useEffect(() => subscribeCatalogChanges(() => refreshProducts(n => n + 1)), []);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    setData(null);
    fetch('/api/catalog/menu-category/' + encodeURIComponent(slug), { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const body = await response.json() as MenuResponse;
        if (!response.ok || !body.success || !body.category || !Array.isArray(body.families)) throw Error(body.message || 'catalog unavailable');
        return body;
      })
      .then(body => { if (active) { setData(body); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [slug]);

  const products = useMemo(() => new Map<string, Product>(
    getAllProducts().map(p => [p.code, p])
  ), [data, status, catalogRevision]);

  const families = useMemo(() => (data?.families || []).filter(family => {
    const matchesSelection = !selection || family.submenu === selection || family.leaf === selection;
    const query = search.trim().toLocaleLowerCase();
    return matchesSelection && (!query || [family.name, family.code, family.brand]
      .some(value => (value || '').toLocaleLowerCase().includes(query)));
  }), [data, selection, search]);

  const selectNode = (name: string) => {
    const params = new URLSearchParams(searchParams);
    if (name) params.set('sub', name);
    else params.delete('sub');
    setSearchParams(params);
  };

  const groupCount = (name: string) => (data?.families || []).filter(f => f.submenu === name || f.leaf === name).length;

  return <main className="mx-auto w-full max-w-[1600px] px-4 py-6 text-right sm:px-6 lg:px-8" dir="rtl">
    <nav className="mb-5 flex items-center gap-2 text-xs text-slate-500">
      <Link to="/">خانه</Link><ChevronLeft size={13}/><Link to="/categories">دسته‌بندی‌ها</Link>
      {data?.category && <><ChevronLeft size={13}/><span className="text-slate-800">{data.category.name}</span></>}
    </nav>
    {status === 'loading' && <p role="status" className="rounded-xl bg-white p-8 text-slate-600">در حال دریافت خانواده‌های این دسته از دیتابیس…</p>}
    {status === 'error' && <div role="alert" className="rounded-xl border border-orange-200 bg-orange-50 p-6">
      <strong>دسته‌بندی دریافت نشد.</strong>
      <p className="mt-2 text-sm">ارتباط با پایگاه داده را بررسی کنید. اطلاعات کالا حذف نشده است.</p>
      <button className="mt-4 rounded-lg bg-[#E56B1E] px-4 py-2 text-sm text-white" onClick={() => window.location.reload()}>تلاش دوباره</button>
    </div>}
    {status === 'ready' && data?.category && <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#303337] p-6 text-white">
        <div><span className="text-xs text-orange-300">کاتالوگ صنعت پیش</span>
          <h1 className="mt-2 text-2xl font-black">{data.category.name}</h1>
          <p className="mt-3 text-sm text-slate-200">{data.category.description}</p>
          <p className="mt-3 text-xs text-orange-200">{data.families?.length || 0} خانواده ثبت‌شده</p>
        </div>
        {data.category.image && <img src={data.category.image} alt="" className="h-28 w-28 rounded-xl bg-white p-2 object-contain"/>}
      </header>
      <div className="mb-5">
        <DirectSkuProducts categorySlug={slug} selectedSub={selection||'all'}/>
      </div>
      <div className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="self-start rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><Layers size={17}/> زیرمنوها و مشخصات</h2>
          <button onClick={() => selectNode('')} className={`mb-2 w-full rounded-lg px-3 py-2 text-right text-sm ${!selection ? 'bg-orange-50 font-bold text-[#CF5C15]' : 'hover:bg-slate-50'}`}>تمام خانواده‌ها</button>
          {(data.category.children || []).map(node => <section key={node.name} className="mb-3 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => selectNode(node.name)} className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-right text-xs font-bold ${selection===node.name ? 'bg-orange-50 text-[#CF5C15]' : 'text-slate-700 hover:bg-orange-50'}`}>
              <span>{node.name}</span><span className="text-slate-400">{groupCount(node.name)}</span>
            </button>
            {(node.children || []).map(leaf => <button key={leaf.name} type="button" onClick={() => selectNode(leaf.name)}
              className={`block w-full rounded-lg py-2 pr-5 text-right text-xs ${selection===leaf.name ? 'bg-orange-50 font-bold text-[#CF5C15]' : 'text-slate-500 hover:text-[#CF5C15]'}`}>{leaf.name}</button>)}
          </section>)}
        </aside>
        <section className="min-w-0">
          <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <Search size={17} className="text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="جست‌وجوی خانواده یا کد کالا" className="w-full bg-transparent text-sm outline-none"/>
          </label>
          <p className="mb-3 text-sm font-bold text-slate-700">{families.length} خانواده مطابق فیلتر</p>
          {families.length === 0 && <p className="rounded-xl bg-white p-8 text-sm text-slate-500">برای این زیرمنو هنوز خانواده‌ای با تطبیق تأییدشده ثبت نشده است.</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {families.map(family => {
              const product = products.get(family.code);
              return product ? <ProductCard key={family.code} product={product}/> :
                <article key={family.code} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-slate-400"><Package size={24}/><span className="text-xs">{family.brand || 'قطعه صنعتی'}</span></div>
                  <h3 className="min-h-12 text-sm font-bold text-slate-800">{family.name}</h3>
                  <p className="mt-2 text-xs text-slate-500" dir="ltr">{family.code}</p>
                  <p className="mt-2 text-xs text-slate-500">{family.skuCount} کد کالا / سایز</p>
                  <Link className="mt-4 flex items-center gap-1 text-xs font-bold text-[#D26017]" to={`/product/${encodeURIComponent(family.code)}`}>مشاهده خانواده و محصولات <ArrowLeft size={14}/></Link>
                </article>;
            })}
          </div>
        </section>
      </div>
    </>}
  </main>;
};
