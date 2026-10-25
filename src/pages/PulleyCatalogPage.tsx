import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Grid2X2, Heart, List, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Truck, X } from "lucide-react";
import type { Product } from "../types";
import { ProductImage } from "../components/product/ProductImage";
import { useWishlist } from "../context/WishlistContext";
import { toPersianDigits } from "../utils/formatters";
import "./pulley-catalog.css";

type Props = { products: Product[] };
const fa = (value: number) => toPersianDigits(value);
const unique = (items: string[]) => Array.from(new Set(items.map(x => x.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"fa"));
const amount = (p: Product) => p.inquiryOnly ? 0 : Number(p.prices?.retail || 0);
const num = (s: string) => Number(s.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
function categoryItems(products: Product[]) {
  const labels = unique(products.map(p => p.submenu || p.subcategory));
  return labels.map(label => ({ label, count: products.filter(p => (p.submenu || p.subcategory) === label).length, image: products.find(p => (p.submenu || p.subcategory) === label && p.images?.[0])?.images[0] }));
}
export const PulleyCatalogPage: React.FC<Props> = ({ products }) => {
  const [params, setParams] = useSearchParams();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [group, setGroup] = useState("all");
  const [brands, setBrands] = useState<string[]>([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sort, setSort] = useState("default");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [spec, setSpec] = useState("all");
  const [priceOpen, setPriceOpen] = useState(false);
  const groups = useMemo(() => categoryItems(products), [products]);
  const brandOptions = useMemo(() => unique(products.map(p=>p.brand)), [products]);
  const specOptions = useMemo(() => unique(products.flatMap(p=>p.technicalSpecs?.filter(s=>/شیار|قطر|جنس|پروفیل|تعداد/i.test(s.key)).map(s=>s.value) || [])).slice(0,40), [products]);
  const selectGroup = (name: string) => { setGroup(name);setPage(1);setSpec("all"); };
  const toggleBrand = (brand: string) => { setBrands(old=>old.includes(brand)?old.filter(b=>b!==brand):[...old,brand]);setPage(1); };
  const clear = () => {setGroup("all");setBrands([]);setQuery("");setMinPrice("");setMaxPrice("");setOnlyAvailable(false);setSpec("all");setPage(1);setParams({category:"پولی-و-انتقال-نیرو"});};
  const filtered = useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("fa");
    const lower=Number.isFinite(num(minPrice)) && minPrice!=="" ? num(minPrice):0;
    const upper=Number.isFinite(num(maxPrice)) && maxPrice!=="" ? num(maxPrice):Infinity;
    const entries=products.filter(p=>
      (group==="all" || (p.submenu||p.subcategory)===group) &&
      (!brands.length || brands.includes(p.brand)) &&
      (!onlyAvailable || (p.stockKnown!==false && p.stock>0 && !p.inquiryOnly)) &&
      (spec==="all" || p.technicalSpecs?.some(s=>s.value===spec)) &&
      ((!minPrice && !maxPrice) || (amount(p)>0 && amount(p)>=lower && amount(p)<=upper)) &&
      (!q || [p.name,p.nameEn,p.code,p.brand,p.submenu,p.subcategory,...(p.technicalSpecs||[]).flatMap(s=>[s.key,s.value])].some(s=>s?.toLocaleLowerCase("fa").includes(q)))
    );
    if(sort==="price_asc") entries.sort((a,b)=>(amount(a)||Infinity)-(amount(b)||Infinity));
    if(sort==="price_desc") entries.sort((a,b)=>amount(b)-amount(a));
    if(sort==="name") entries.sort((a,b)=>a.name.localeCompare(b.name,"fa"));
    if(sort==="stock") entries.sort((a,b)=>b.stock-a.stock);
    return entries;
  },[products,group,brands,onlyAvailable,spec,minPrice,maxPrice,query,sort]);
  const perPage=16, totalPages=Math.max(1,Math.ceil(filtered.length/perPage));
  const visible=filtered.slice((Math.min(page,totalPages)-1)*perPage,Math.min(page,totalPages)*perPage);
  const heroImage=products.find(p=>p.images?.[0])?.images[0];
  const panel=<div className="pulley-filter-content">
    <div className="pulley-filter-heading"><SlidersHorizontal size={17}/> فیلتر محصولات</div>
    <section><h3>دسته‌بندی</h3><label className="pulley-check"><input type="radio" checked={group==="all"} onChange={()=>selectGroup("all")}/> همه پولی‌ها <small>({fa(products.length)})</small></label>{groups.map(g=><label key={g.label} className="pulley-check"><input type="radio" checked={group===g.label} onChange={()=>selectGroup(g.label)}/><span>{g.label}</span><small>({fa(g.count)})</small></label>)}</section>
    <section><h3>برند</h3>{brandOptions.map(b=><label key={b} className="pulley-check"><input type="checkbox" checked={brands.includes(b)} onChange={()=>toggleBrand(b)}/>{b}</label>)}</section>
    {!!specOptions.length&&<section><h3>مشخصات فنی</h3><select aria-label="مشخصات فنی" value={spec} onChange={e=>{setSpec(e.target.value);setPage(1)}}><option value="all">همه مشخصات</option>{specOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></section>}
    <section><h3>محدوده قیمت (تومان)</h3><div className="pulley-price-inputs"><input inputMode="numeric" placeholder="از" aria-label="حداقل قیمت" value={minPrice} onChange={e=>{setMinPrice(e.target.value);setPage(1)}}/><input inputMode="numeric" placeholder="تا" aria-label="حداکثر قیمت" value={maxPrice} onChange={e=>{setMaxPrice(e.target.value);setPage(1)}}/></div><small>فقط قیمت‌های واقعی ثبت‌شده در کاتالوگ</small></section>
    <section><label className="pulley-check"><input type="checkbox" checked={onlyAvailable} onChange={e=>{setOnlyAvailable(e.target.checked);setPage(1)}}/> فقط موجود در انبار</label></section>
    <button type="button" className="pulley-clear" onClick={clear}><RotateCcw size={15}/> حذف همه فیلترها</button>
  </div>;
  return <main className="pulley-catalog" dir="rtl">
    <div className="pulley-hero">
      <div className="pulley-hero-image">{heroImage&&<ProductImage src={heroImage} alt="پولی صنعتی" />}</div>
      <div className="pulley-hero-copy"><div className="pulley-breadcrumb"><Link to="/">خانه</Link><ChevronLeft size={13}/> تسمه و انتقال نیرو <ChevronLeft size={13}/> پولی و انتقال نیرو</div><h1>پولی و انتقال نیرو</h1><p>انتخاب پولی صنعتی بر اساس خانواده، برند و مشخصات فنی واقعی قطعات</p><div className="pulley-benefits"><span><Truck size={19}/> هماهنگی ارسال</span><span><ShieldCheck size={19}/> اطلاعات فنی کالا</span><span><Check size={19}/> مشاوره تخصصی</span></div></div>
    </div>
    <div className="pulley-container">
      <div className="pulley-group-strip"><button type="button" className={group==="all"?"active":""} onClick={()=>selectGroup("all")}><span>همه پولی‌ها</span><small>{fa(products.length)} خانواده</small></button>{groups.map(g=><button type="button" key={g.label} className={group===g.label?"active":""} onClick={()=>selectGroup(g.label)}>{g.image&&<ProductImage src={g.image} alt={g.label} thumbnail/>}<span>{g.label}</span><small>{fa(g.count)} خانواده</small></button>)}</div>
      <div className="pulley-layout"><aside className="pulley-sidebar">{panel}</aside><div className="pulley-main">
        <div className="pulley-toolbar"><button type="button" className="pulley-mobile-filter" onClick={()=>setMobileFilters(true)}><SlidersHorizontal size={16}/> فیلترها</button><span className="pulley-results">{fa(filtered.length)} خانواده یافت شد</span><div className="pulley-tools"><label>مرتب‌سازی: <select value={sort} onChange={e=>{setSort(e.target.value);setPage(1)}}><option value="default">پیش‌فرض</option><option value="name">نام کالا</option><option value="price_asc">ارزان‌ترین قیمت ثبت‌شده</option><option value="price_desc">گران‌ترین قیمت ثبت‌شده</option><option value="stock">موجودی بیشتر</option></select></label><div className="pulley-view"><button aria-label="نمایش شبکه‌ای" aria-pressed={view==="grid"} onClick={()=>setView("grid")}><Grid2X2 size={17}/></button><button aria-label="نمایش لیستی" aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={17}/></button></div></div></div>
        <div className="pulley-search"><Search size={18}/><input value={query} placeholder="جستجوی نام، کد کالا، برند یا مشخصات فنی…" onChange={e=>{setQuery(e.target.value);setPage(1)}}/></div>
        {visible.length?<div className={view==="grid"?"pulley-grid":"pulley-grid pulley-list"}>{visible.map(p=><article className="pulley-product" key={p.code}><div className="pulley-media"><Link to={`/product/${encodeURIComponent(p.code)}`}><ProductImage src={p.images?.[0]} alt={p.name} thumbnail loading="lazy" decoding="async"/></Link><button type="button" className="pulley-heart" aria-label="افزودن به علاقه‌مندی" aria-pressed={isInWishlist(p.code)} onClick={()=>toggleWishlist(p.code)}><Heart size={17} fill={isInWishlist(p.code)?"#e06518":"none"}/></button></div><div className="pulley-product-copy"><div className="pulley-code"><span>{p.brand || "قطعات صنعتی"}</span><span dir="ltr">{p.code}</span></div><Link className="pulley-name" to={`/product/${encodeURIComponent(p.code)}`}>{p.name}</Link><div className="pulley-specs"><span>{p.subcategory}</span><span>{p.variants?.length ? `${fa(p.variants.length)} کد و سایز` : (p.technicalSpecs?.[0] ? `${p.technicalSpecs[0].key}: ${p.technicalSpecs[0].value}` : "مشخصات در صفحه کالا")}</span></div><div className="pulley-bottom"><span className="pulley-stock">{p.stockKnown!==false && p.stock>0 && !p.inquiryOnly?"موجود":"استعلام موجودی"}</span><strong>{amount(p)>0?`${fa(amount(p).toLocaleString("en-US"))} تومان`:"استعلام قیمت"}</strong></div><Link className="pulley-cta" to={`/product/${encodeURIComponent(p.code)}`}>مشاهده محصول و انتخاب سایز <ArrowLeft size={16}/></Link></div></article>)}</div>:<div className="pulley-empty">محصولی با فیلترهای انتخاب‌شده یافت نشد.<button onClick={clear}>نمایش همه پولی‌ها</button></div>}
        {totalPages>1&&<nav className="pulley-pagination" aria-label="صفحات محصولات"><button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronRight size={18}/></button>{Array.from({length:totalPages},(_,i)=>i+1).filter(n=>n===1||n===totalPages||Math.abs(page-n)<=2).map(n=><button className={page===n?"active":""} key={n} onClick={()=>{setPage(n);window.scrollTo({top:250,behavior:"smooth"})}}>{fa(n)}</button>)}<button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}><ChevronLeft size={18}/></button></nav>}
        <div className="pulley-promo"><div><h2>انواع پولی صنعتی</h2><p>قطعه مناسب را با مشخصات فنی واقعی خانواده‌های کاتالوگ انتخاب کنید.</p><button onClick={clear}>مشاهده همه محصولات <ArrowLeft size={16}/></button></div>{heroImage&&<ProductImage src={heroImage} alt="پولی صنعتی" thumbnail/>}</div>
      </div></div>
    </div>
    {mobileFilters&&<div className="pulley-filter-overlay"><button className="pulley-overlay-backdrop" aria-label="بستن فیلترها" onClick={()=>setMobileFilters(false)}/><div className="pulley-filter-drawer"><button className="pulley-drawer-close" onClick={()=>setMobileFilters(false)}><X size={20}/> بستن</button>{panel}<button className="pulley-apply" onClick={()=>setMobileFilters(false)}>نمایش {fa(filtered.length)} محصول</button></div></div>}
  </main>;
};