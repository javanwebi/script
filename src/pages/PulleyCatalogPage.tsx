import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowUpDown, BadgeCheck, Check, ChevronLeft, ChevronRight,
  CircleDot, Filter, Heart, ImageOff, Layers3, List, PackageSearch,
  RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Truck, X,
  Grid2X2, Ruler, Info, ArrowUpLeft
} from "lucide-react";
import type { Product } from "../types";
import { ProductImage } from "../components/product/ProductImage";
import { useWishlist } from "../context/WishlistContext";
import { toPersianDigits } from "../utils/formatters";
import { STORE_ASSETS } from "../assets/images";
import "./pulley-catalog.css";

type Props = { products: Product[] };
type PulleyKind = "all" | "idler" | "timing" | "grooved" | "variable" | "fixed" | "flat" | "other";

const nf = (n: number) => toPersianDigits(n.toLocaleString("en-US"));
const clean = (s?: string) => (s || "").trim();
const normalize = (s: string) => s.toLocaleLowerCase("fa").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
const knownBrand = (s?: string) => !!s && !/^(ثبت نشده|نامشخص|بدون برند|unknown|n\/a|-|عمومی)$/i.test(s.trim());
const realImage = (p: Product) => Boolean(p.hasCatalogueImage && p.images?.[0]);
const priceOf = (p: Product) => (!p.inquiryOnly && Number(p.prices?.retail || 0) > 0) ? Number(p.prices.retail) : 0;
const inStock = (p: Product) => p.stockKnown === true && p.stock > 0 && !p.inquiryOnly;
const skuCount = (p: Product) => p.variants?.length || 0;
const values = (products: Product[]) => Array.from(new Set(products.map(x => clean(x.brand)).filter(knownBrand))).sort((a, b) => a.localeCompare(b, "fa"));

const TYPE_INFO: Array<{ id: PulleyKind; title: string; desc: string }> = [
  { id: "all", title: "همه پولی‌ها", desc: "کل کاتالوگ" },
  { id: "idler", title: "پولی هرزگرد", desc: "Idler Pulley" },
  { id: "grooved", title: "پولی شیاری", desc: "V / Multi Groove" },
  { id: "timing", title: "پولی تایمینگ", desc: "Timing Pulley" },
  { id: "variable", title: "پولی دورمتغیر", desc: "Variable Speed" },
  { id: "fixed", title: "پولی ثابت", desc: "Fixed Pulley" },
  { id: "flat", title: "پولی تخت", desc: "Flat Pulley" },
  { id: "other", title: "سایر انواع", desc: "Other Types" },
];

function typeOf(p: Product): PulleyKind {
  const name = normalize(p.name);
  if (/دور\s*متغ/.test(name)) return "variable";
  if (/تایم|تسمه\s*تایم|دندانه/.test(name) || /(?:^|\s)t(?:5|10)(?:\s|$)/i.test(name)) return "timing";
  if (/هرزگرد|بلبرینگ\s*پولی/.test(name)) return "idler";
  if (/شیار|دوبل|دوقلو|(?:^|\s)[234]b\d*/i.test(name)) return "grooved";
  if (/ثابت/.test(name)) return "fixed";
  if (/تخت/.test(name)) return "flat";
  return "other";
}
function profiles(p: Product): string[] {
  const entries = (p.technicalSpecs || []).filter(s => /پروفیل|profile/i.test(s.key));
  return entries.flatMap(s => s.value.split(/[,،;/]+/g).map(v => clean(v)).filter(Boolean));
}

export const PulleyCatalogPage: React.FC<Props> = ({ products }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Every submenu, including links from the header, stays on this landing page.
  const selectedSubmenu = searchParams.get("sub") || "all";
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [kind, setKind] = useState<PulleyKind>("all");
  const [keyword, setKeyword] = useState(searchParams.get("q") || "");
  const [brand, setBrand] = useState<string[]>([]);
  const [profile, setProfile] = useState("");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("featured");
  // Most catalogue families do not yet have verified photography: a compact index is clearer.
  const [listView, setListView] = useState(true);
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [useCase, setUseCase] = useState<"unknown" | "timing" | "idler" | "variable" | "fixed" | "grooved">("unknown");
  const [haveCode, setHaveCode] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const submenuOptions = useMemo(() => {
    const options = Array.from(new Set(products.map(p => p.subcategory).filter(Boolean)));
    return options.map(name => ({ name, count: products.filter(p => p.subcategory === name).length }));
  }, [products]);
  const selectSubmenu = (name: string) => {
    const next = new URLSearchParams(searchParams);
    if (name === "all") next.delete("sub"); else next.set("sub", name);
    setSearchParams(next);
    setKind("all");
    setPage(1);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const types = useMemo(() => TYPE_INFO.map(type => {
    const matching = type.id === "all" ? products : products.filter(p => typeOf(p) === type.id);
    return { ...type, count: matching.length, image: matching.find(realImage)?.images?.[0] };
  }).filter(type => type.count > 0), [products]);
  const brands = useMemo(() => values(products), [products]);
  const profileOptions = useMemo(() => Array.from(new Set(products.flatMap(profiles))).sort((a, b) => a.localeCompare(b, "fa")), [products]);
  const pricedCount = useMemo(() => products.filter(p => priceOf(p) > 0).length, [products]);
  const totalSkus = useMemo(() => products.reduce((s, p) => s + skuCount(p), 0), [products]);
  const imageCount = useMemo(() => products.filter(realImage).length, [products]);
  const knownStockCount = useMemo(() => products.filter(inStock).length, [products]);
  const activeCount = (selectedSubmenu !== "all" ? 1 : 0) + (kind !== "all" ? 1 : 0) + brand.length + (profile ? 1 : 0) + (photoOnly ? 1 : 0) + (availableOnly ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0);
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const selectType = (next: PulleyKind) => { setKind(next); setPage(1); };
  const startGuidedSearch = () => {setKind(useCase === "unknown" ? "all" : useCase);setPage(1);setGuideOpen(false);requestAnimationFrame(scrollToResults);};
  const reset = () => {
    setKind("all"); setBrand([]); setProfile(""); setPhotoOnly(false); setAvailableOnly(false);
    setMinPrice(""); setMaxPrice(""); setKeyword(""); setPage(1);
    setSearchParams({});
  };
  const setBrandValue = (name: string) => {
    setBrand(current => current.includes(name) ? current.filter(x => x !== name) : [...current, name]);
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = normalize(keyword);
    const min = Number(minPrice.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٬,\s]/g, "")) || 0;
    const maxParsed = Number(maxPrice.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٬,\s]/g, ""));
    const max = maxPrice.trim() && Number.isFinite(maxParsed) ? maxParsed : Infinity;
    const list = products.filter(p => {
      if (selectedSubmenu !== "all" && p.subcategory !== selectedSubmenu && p.submenu !== selectedSubmenu) return false;
      if (kind !== "all" && typeOf(p) !== kind) return false;
      if (brand.length && !brand.includes(p.brand)) return false;
      if (profile && !profiles(p).includes(profile)) return false;
      if (photoOnly && !realImage(p)) return false;
      if (availableOnly && !inStock(p)) return false;
      if ((minPrice || maxPrice) && !(priceOf(p) > 0 && priceOf(p) >= min && priceOf(p) <= max)) return false;
      if (q) {
        const content = [p.name, p.code, p.nameEn || "", p.brand, p.subcategory, ...(p.technicalSpecs || []).flatMap(s => [s.key, s.value]), ...(p.variants || []).map(v => v.code)].join(" ");
        if (!normalize(content).includes(q)) return false;
      }
      return true;
    });
    if (sort === "featured") list.sort((a, b) => Number(realImage(b)) - Number(realImage(a)) || skuCount(b) - skuCount(a));
    if (sort === "title") list.sort((a, b) => a.name.localeCompare(b.name, "fa"));
    if (sort === "variants") list.sort((a, b) => skuCount(b) - skuCount(a));
    if (sort === "price-low") list.sort((a, b) => (priceOf(a) || Infinity) - (priceOf(b) || Infinity));
    if (sort === "price-high") list.sort((a, b) => priceOf(b) - priceOf(a));
    return list;
  }, [products, kind, brand, profile, photoOnly, availableOnly, minPrice, maxPrice, keyword, sort, selectedSubmenu]);

  const pageSize = 12;
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const displayedPage = Math.min(page, lastPage);
  const shown = filtered.slice((displayedPage - 1) * pageSize, displayedPage * pageSize);
  const setPageAndScroll = (next: number) => {
    setPage(Math.max(1, Math.min(lastPage, next)));
    scrollToResults();
  };
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const filters = (
    <div className="pc-filters">
      <div className="pc-filter-heading"><span><SlidersHorizontal size={17}/> فیلترهای تخصصی</span><button onClick={reset} type="button">پاک‌سازی</button></div>
      <fieldset className="pc-filter-block"><legend>نوع پولی</legend>
        {types.map(item => <label key={item.id} className="pc-option"><input type="radio" name={drawer ? "pulley-mobile-kind" : "pulley-desktop-kind"} checked={kind === item.id} onChange={() => selectType(item.id)}/><span>{item.title}</span><small>{nf(item.count)}</small></label>)}
      </fieldset>
      {brands.length > 0 && <fieldset className="pc-filter-block"><legend>برندهای ثبت‌شده</legend>
        {brands.map(name => <label key={name} className="pc-option"><input type="checkbox" checked={brand.includes(name)} onChange={() => setBrandValue(name)}/><span>{name}</span></label>)}
      </fieldset>}
      {profileOptions.length > 0 && <div className="pc-filter-block"><label className="pc-field-label" htmlFor={drawer ? "pc-profile-mobile" : "pc-profile"}><Ruler size={15}/> پروفیل فنی</label>
        <select id={drawer ? "pc-profile-mobile" : "pc-profile"} value={profile} onChange={e => { setProfile(e.target.value); setPage(1); }}>
          <option value="">تمام پروفیل‌های ثبت‌شده</option>{profileOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>}
      {pricedCount > 0 && <div className="pc-filter-block"><div className="pc-field-label">محدوده قیمت ثبت‌شده (تومان)</div>
        <div className="pc-price-fields"><input aria-label="حداقل قیمت" inputMode="numeric" placeholder="از" value={minPrice} onChange={e => { setMinPrice(e.target.value); setPage(1); }}/><input aria-label="حداکثر قیمت" inputMode="numeric" placeholder="تا" value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setPage(1); }}/></div>
        <p className="pc-field-help">فقط خانواده‌های دارای قیمت معتبر</p>
      </div>}
      <div className="pc-filter-block pc-toggle-block">
        <label className="pc-option"><input type="checkbox" checked={photoOnly} onChange={e => { setPhotoOnly(e.target.checked); setPage(1); }}/><span>دارای تصویر تأییدشده</span><small>{nf(imageCount)}</small></label>
        {knownStockCount > 0 && <label className="pc-option"><input type="checkbox" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }}/><span>موجودی تأییدشده</span><small>{nf(knownStockCount)}</small></label>}
      </div>
      <div className="pc-filter-note"><Info size={16}/><span>فقط مشخصات ثبت‌شده نمایش داده می‌شوند. قیمت و موجودی نامشخص، قابل استعلام هستند.</span></div>
    </div>
  );

  return (
    <main className="pc-page" dir="rtl">
      <header className="pc-hero">
        <div className="pc-hero-art" aria-hidden="true"/>
        <img className="pc-hero-photo" src={STORE_ASSETS.heroPulley} alt="" aria-hidden="true" />
        <div className="pc-hero-content">
          <nav className="pc-crumb" aria-label="مسیر صفحه"><Link to="/">خانه</Link><ChevronLeft size={13}/><span>قطعات انتقال نیرو</span><ChevronLeft size={13}/><strong>پولی صنعتی</strong></nav>
          <span className="pc-overline"><Sparkles size={16}/> مهندسی انتقال قدرت / کاتالوگ صنعت پیش</span>
          <h1>پولی و <em>انتقال نیرو</em></h1>
          <p>از شناسایی نوع پولی تا انتخاب دقیق کد کالا؛ خانواده‌های واقعی کاتالوگ را با مشخصات فنی مقایسه کنید.</p>
          <div className="pc-hero-actions"><button type="button" onClick={() => setGuideOpen(true)} className="pc-hero-primary">راهنمای انتخاب پولی <ArrowLeft size={18}/></button><button type="button" onClick={scrollToResults} className="pc-hero-secondary">مشاهده محصولات <ArrowUpLeft size={16}/></button></div>
          <div className="pc-hero-stats"><span><strong>{nf(products.length)}</strong> خانواده ثبت‌شده</span><span><strong>{nf(totalSkus)}</strong> کد کالای مرتبط</span><span><strong>{nf(imageCount)}</strong> خانواده تصویردار</span></div>
        </div>
        <div className="pc-hero-corner"><BadgeCheck size={17}/> خانواده‌ها و کدهای ثبت‌شده در صنعت پیش</div>
      </header>

      <div className="pc-shell">
        <section className="pc-explore" aria-label="انتخاب نوع پولی">
          <div className="pc-section-heading"><div><span className="pc-eyebrow">راهنمای انتخاب سریع</span><h2>چه نوع پولی نیاز دارید؟</h2><p>بر اساس عنوان واقعی خانواده‌ها انتخاب کنید</p></div><span className="pc-guide-label"><CircleDot size={17}/> {nf(types.length - 1)} گروه قابل جستجو</span></div>
          <nav className="pc-taxonomy-nav" aria-label="زیردسته‌های واقعی پولی">
            <span>مسیر انتخاب محصول</span>
            <button type="button" aria-current={selectedSubmenu === "all" ? "page" : undefined} onClick={() => selectSubmenu("all")}>همه خانواده‌ها <b>{nf(products.length)}</b></button>
            {submenuOptions.map(option => <button type="button" key={option.name} aria-current={selectedSubmenu === option.name ? "page" : undefined} onClick={() => selectSubmenu(option.name)}>{option.name} <b>{nf(option.count)}</b></button>)}
          </nav>
          <div className="pc-types" role="group" aria-label="گروه‌های پولی">
            {types.map(item => <button type="button" onClick={() => selectType(item.id)} aria-pressed={kind === item.id} className={"pc-type" + (kind === item.id ? " is-selected" : "")} key={item.id}>
              <div className="pc-type-image">{item.image ? <ProductImage src={item.image} alt={"نمونه ثبت‌شده " + item.title} thumbnail loading="lazy"/> : <span className="pc-type-icon"><CircleDot size={30}/></span>}</div>
              <div className="pc-type-copy"><strong>{item.title}</strong><span>{item.desc}</span><small>{nf(item.count)} خانواده</small></div><ChevronLeft className="pc-type-arrow" size={18}/>
            </button>)}
          </div>
        </section>

        <div className="pc-benefit-strip">
          <span><ShieldCheck size={20}/> داده‌های فنی از کاتالوگ</span>
          <span><PackageSearch size={20}/> جستجو با نام و کد کالا</span>
          <span><Truck size={20}/> هماهنگی روش ارسال پس از ثبت سفارش</span>
        </div>

        <section ref={resultsRef} id="pulley-results" className="pc-results" aria-label="محصولات پولی">
          <div className="pc-section-heading pc-section-heading--results"><div><span className="pc-eyebrow">کاتالوگ محصولات</span><h2>انتخاب و بررسی پولی صنعتی</h2><p>برای مشاهده کدها، اندازه‌ها و جزئیات هر خانواده وارد صفحه محصول شوید.</p></div><div className="pc-count-tag"><Layers3 size={17}/>{nf(filtered.length)} خانواده یافت شد</div></div>
          <div className="pc-layout">
            <aside className="pc-sidebar">{filters}</aside>
            <div className="pc-content">
              <div className="pc-toolbox">
                <label className="pc-search"><Search size={19}/><input type="search" aria-label="جستجوی پولی صنعتی" placeholder="نام پولی، کد فنی، پروفیل یا مشخصات را جستجو کنید…" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}/>{keyword && <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setKeyword(""); setPage(1); }}><X size={17}/></button>}</label>
                <div className="pc-toolbox-controls">
                  <button type="button" className="pc-mobile-filters" onClick={() => setDrawer(true)}><Filter size={17}/> فیلترها {activeCount > 0 && <b>{nf(activeCount)}</b>}</button>
                  <label className="pc-sort"><ArrowUpDown size={16}/><select aria-label="مرتب‌سازی محصولات" value={sort} onChange={e => {setSort(e.target.value); setPage(1);}}><option value="featured">پیشنهادی: ابتدا تصویردارها</option><option value="title">نام خانواده</option><option value="variants">بیشترین کد و سایز</option>{pricedCount > 0 && <><option value="price-low">قیمت: کم به زیاد</option><option value="price-high">قیمت: زیاد به کم</option></>}</select></label>
                  <div className="pc-switch-view"><button type="button" aria-label="نمایش شبکه‌ای" aria-pressed={!listView} onClick={() => setListView(false)}><Grid2X2 size={18}/></button><button type="button" aria-label="نمایش لیستی" aria-pressed={listView} onClick={() => setListView(true)}><List size={18}/></button></div>
                </div>
              </div>

              {(activeCount > 0 || keyword) && <div className="pc-active-filters"><span>فیلترهای فعال:</span>{selectedSubmenu !== "all" && <button onClick={() => selectSubmenu("all")}>{selectedSubmenu}<X size={13}/></button>}{kind !== "all" && <button onClick={() => selectType("all")}>{TYPE_INFO.find(t => t.id === kind)?.title}<X size={13}/></button>}{brand.map(b => <button key={b} onClick={() => setBrandValue(b)}>{b}<X size={13}/></button>)}{profile && <button onClick={() => {setProfile("");setPage(1);}}>{profile}<X size={13}/></button>}{keyword && <button onClick={() => setKeyword("")}>جستجو: {keyword}<X size={13}/></button>}{(photoOnly || availableOnly || minPrice || maxPrice) && <button onClick={reset}>حذف فیلترهای تکمیلی<X size={13}/></button>}<button className="pc-reset-inline" onClick={reset}><RotateCcw size={13}/> همه فیلترها</button></div>}

              {shown.length === 0 ? <div className="pc-empty"><PackageSearch size={46}/><h3>محصولی با این مشخصات پیدا نشد</h3><p>فیلترها یا عبارت جستجو را تغییر دهید. هیچ کالای فرضی به فهرست اضافه نمی‌شود.</p><button type="button" onClick={reset}>نمایش همه خانواده‌ها <ArrowLeft size={16}/></button></div> :
                <div className={"pc-grid" + (listView ? " pc-grid--list" : "")}>
                  {shown.map(p => {
                    const hasPhoto = realImage(p);
                    const cost = priceOf(p);
                    const type = TYPE_INFO.find(t => t.id === typeOf(p));
                    const wishlist = isInWishlist(p.code);
                    return <article className={"pc-product" + (hasPhoto ? "" : " pc-product--unpictured")} key={p.code}>
                      <div className="pc-product-photo">
                        <Link to={"/product/" + encodeURIComponent(p.code)} aria-label={"جزئیات " + p.name}>{hasPhoto ? <ProductImage src={p.images[0]} alt={p.name} thumbnail loading="lazy"/> : <div className="pc-no-photo"><ImageOff size={35}/><span>تصویر تأییدشده موجود نیست</span></div>}</Link>
                        {hasPhoto && <span className="pc-verified"><Check size={12}/> تصویر کاتالوگ</span>}
                        <button type="button" className="pc-wishlist" aria-label={wishlist ? "حذف از علاقه‌مندی" : "افزودن به علاقه‌مندی"} aria-pressed={wishlist} onClick={() => toggleWishlist(p.code)}><Heart size={19} fill={wishlist ? "#e06518" : "none"}/></button>
                      </div>
                      <div className="pc-product-info">
                        <div className="pc-product-overline"><span>{type?.title || "پولی صنعتی"}</span><span dir="ltr">{p.code}</span></div>
                        <Link to={"/product/" + encodeURIComponent(p.code)} className="pc-product-title">{p.name}</Link>
                        <div className="pc-product-tags"><span><Layers3 size={13}/>{skuCount(p) ? nf(skuCount(p)) + " کد و سایز" : "جزئیات فنی"}</span>{profiles(p).length > 0 && <span><Ruler size={13}/>{profiles(p).slice(0,2).join("، ")}</span>}</div>
                        <div className="pc-product-bottom"><div><small>وضعیت قیمت</small><strong>{cost > 0 ? nf(cost) + " تومان" : "استعلام قیمت"}</strong></div><span className={inStock(p) ? "pc-status available" : "pc-status"}>{inStock(p) ? "موجودی ثبت‌شده" : "استعلام موجودی"}</span></div>
                        <Link to={"/product/" + encodeURIComponent(p.code)} className="pc-product-link">مشاهده مشخصات و کدها <ArrowLeft size={17}/></Link>
                      </div>
                    </article>;
                  })}
                </div>
              }

              {lastPage > 1 && <nav className="pc-pagination" aria-label="صفحه‌بندی محصولات">
                <button type="button" disabled={displayedPage === 1} onClick={() => setPageAndScroll(displayedPage - 1)} aria-label="صفحه قبل"><ChevronRight size={18}/></button>
                {Array.from({length: lastPage}, (_, i) => i + 1).filter(n => n === 1 || n === lastPage || Math.abs(n - displayedPage) <= 1).map(n => <button type="button" key={n} aria-current={displayedPage === n ? "page" : undefined} onClick={() => setPageAndScroll(n)}>{nf(n)}</button>)}
                <button type="button" disabled={displayedPage === lastPage} onClick={() => setPageAndScroll(displayedPage + 1)} aria-label="صفحه بعد"><ChevronLeft size={18}/></button>
              </nav>}
            </div>
          </div>
        </section>


        <section className="pc-finder-section" aria-label="راهنمای انتخاب پولی">
          <div className="pc-finder-title"><span className="pc-eyebrow">راهنمای انتخاب قدم‌به‌قدم</span><h2>چطور پولی مناسب دستگاهتان را پیدا کنید؟</h2><p>اگر شماره فنی پولی را ندارید، با چند مشخصه ساده شروع کنید.</p></div>
          <div className="pc-finder-steps">
            <div><span className="pc-step-number">۱</span><strong>نوع مکانیزم</strong><p>تایمینگ، تسمه شیاری، هرزگرد یا دورمتغیر بودن پولی را مشخص کنید.</p></div>
            <div><span className="pc-step-number">۲</span><strong>ابعاد و پروفیل</strong><p>قطر بیرونی، قطر سوراخ محور، تعداد شیار و پروفیل را اندازه بگیرید.</p></div>
            <div><span className="pc-step-number">۳</span><strong>تطبیق کد فنی</strong><p>کد کالا و مشخصات را بررسی کرده و پیش از سفارش تأیید کنید.</p></div>
            <div><span className="pc-step-number">۴</span><strong>کمک متخصص</strong><p>اگر اطلاعات ناقص است، تصویر پولی یا پلاک دستگاه را ارائه کنید.</p></div>
          </div>
          <div className="pc-finder-footer"><button type="button" onClick={() => setGuideOpen(true)}>شروع انتخاب راهنمایی‌شده <ArrowLeft size={17}/></button><span>بدون حدس‌زدن سایز و بدون پیشنهاد کالای ساختگی</span></div>
        </section>
        <aside className="pc-assist"><div className="pc-assist-icon"><CircleDot size={34}/></div><div><span className="pc-eyebrow">کمک در انتخاب قطعه</span><h2>کد فنی پولی را نمی‌دانید؟</h2><p>تصویر یا مشخصات دستگاه را آماده کنید و از میزکار شناسایی صنعت پیش کمک بگیرید.</p></div><Link to="/ai-consult">رفتن به مشاوره هوشمند <ArrowLeft size={18}/></Link></aside>
      </div>


      {guideOpen && <div className="pc-guide-root" role="presentation">
        <button className="pc-guide-scrim" aria-label="بستن راهنما" onClick={() => setGuideOpen(false)}/>
        <section className="pc-guide-dialog" role="dialog" aria-modal="true" aria-label="راهنمای انتخاب پولی">
          <div className="pc-guide-head"><div><span className="pc-eyebrow">انتخاب تخصصی</span><h2>پولی مناسب را پیدا کنید</h2></div><button type="button" onClick={() => setGuideOpen(false)} aria-label="بستن"><X size={21}/></button></div>
          <p>کدام توصیف به نیازتان نزدیک‌تر است؟ دسته‌بندی فقط محصولات واقعی همین کاتالوگ را نشان می‌دهد.</p>
          <div className="pc-guide-choices">
            {[
              {id:"unknown",label:"نوع پولی را نمی‌دانم",hint:"همه خانواده‌ها را بررسی می‌کنم"},
              {id:"idler",label:"هرزگرد یا بلبرینگی",hint:"هدایت تسمه یا تنظیم کشش"},
              {id:"timing",label:"تایمینگ و دندانه‌دار",hint:"انتقال حرکت هم‌زمان"},
              {id:"grooved",label:"شیاری و چندتسمه",hint:"تسمه V یا چندشیار"},
              {id:"variable",label:"دورمتغیر",hint:"تغییر نسبت و سرعت"},
              {id:"fixed",label:"پولی ثابت",hint:"انتقال نیرو با نسبت ثابت"}
            ].map(option => <button key={option.id} type="button" className={useCase===option.id?"chosen":""} onClick={()=>setUseCase(option.id as typeof useCase)}><CircleDot size={17}/><span><strong>{option.label}</strong><small>{option.hint}</small></span>{useCase===option.id&&<Check size={17}/>}</button>)}
          </div>
          <label className="pc-guide-check"><input type="checkbox" checked={haveCode} onChange={e=>setHaveCode(e.target.checked)}/> کد یا مشخصات فنی پولی را دارم</label>
          {haveCode&&<label className="pc-guide-search"><Search size={17}/><input value={keyword} placeholder="کد، سایز یا پروفیل را بنویسید" onChange={e=>{setKeyword(e.target.value);setPage(1)}}/></label>}
          <button type="button" className="pc-guide-submit" onClick={startGuidedSearch}>نمایش خانواده‌های مرتبط <ArrowLeft size={18}/></button>
          <small>برای انتخاب قطعی باید مشخصات فنی و ابعاد را با دستگاه خود مطابقت دهید.</small>
        </section>
      </div>}

      {drawer && <div className="pc-drawer-root"><button className="pc-drawer-scrim" type="button" aria-label="بستن فیلترها" onClick={() => setDrawer(false)}/><div className="pc-drawer" role="dialog" aria-modal="true" aria-label="فیلتر محصولات"><div className="pc-drawer-head"><strong>فیلتر محصولات</strong><button type="button" aria-label="بستن" onClick={() => setDrawer(false)}><X size={21}/></button></div>{filters}<button type="button" className="pc-drawer-apply" onClick={() => setDrawer(false)}>نمایش {nf(filtered.length)} خانواده <ArrowLeft size={18}/></button></div></div>}
    </main>
  );
};
