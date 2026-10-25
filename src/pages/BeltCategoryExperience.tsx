import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpDown, Check, ChevronLeft, ChevronDown, CircleHelp, Filter, Heart, Headphones, Layers3, PackageSearch, RotateCcw, Ruler, Search, Settings2, ShieldCheck, SlidersHorizontal, Truck, X, Zap } from 'lucide-react';
import type { Product } from '../types';
import { ProductImage } from '../components/product/ProductImage';
import { useWishlist } from '../context/WishlistContext';
import { getProductsByCategory, subscribeCatalogChanges } from '../data/mockGenerator';
import { categorySlugFor, matchesCatalogCategory } from '../data/categories';
import { matchesProductSearch } from '../data/userProducts';
import { toPersianDigits } from '../utils/formatters';
import heroFallback from '../assets/images/forza_sub_belt_1791282448324.jpg';
import industryCeramic from '../assets/images/ind_ceramic_1789372889504.jpg';
import industryTextile from '../assets/images/ind_textile_1789372911510.jpg';
import industryPackaging from '../assets/images/ind_factory_1789372929899.jpg';
import industryFood from '../assets/images/ind_food_bottles_1789640622505.jpg';
import aiVisual from '../assets/images/ai_search_mobile_1789379723502.jpg';
import aiConsult from '../assets/images/ai_consult_robot_1789379706342.jpg';
import './BeltCategoryExperience.css';

const BELT_SLUG = 'تسمه-و-انتقال-نیرو';
const FAMILY_OPTIONS = [
  { id: 'کلاسیک', title: 'کلاسیک V', subtitle: 'A / B / C / D / E / Z / M', search: /کلاسیک/i },
  { id: 'اسپشیال', title: 'پروفیل باریک', subtitle: 'SPA / SPB / SPC', search: /اسپشیال|پروفیل باریک/i },
  { id: 'تسمه تایمینگ', title: 'تایمینگ', subtitle: 'متریک و اینچی', search: /تایم/i },
  { id: 'تسمه شیاری', title: 'شیاری', subtitle: 'PK / PY / PL', search: /شیاری/i },
  { id: 'تسمه گرد پلی اورتان', title: 'گرد پلی‌یورتان', subtitle: 'صنعتی و انتقال حرکت', search: /گرد.*پلی|پلی.*گرد/i },
  { id: 'تسمه CRC پنج ضلعی', title: 'CRC پنج‌ضلعی', subtitle: 'جوشی و فابریک', search: /CRC|پنج ضلعی/i },
] as const;
const PROFILES = ['A', 'B', 'C', 'D', 'E', 'Z', 'M'] as const;
const number = (raw: string) => Number(raw.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٬,]/g, ''));
const priceOf = (p: Product) => p.prices?.retail > 0 && !p.inquiryOnly ? p.prices.retail : null;
const lengthMm = (p: Product): number | null => {
  const spec = p.technicalSpecs?.find(item => /طول|length/i.test(item.key));
  if (!spec) return null;
  const text = String(spec.value).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const match = text.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(',', '.'));
  return Number.isFinite(value) ? (/اینچ|inch/i.test(text) ? value * 25.4 : value) : null;
};
const matchesProfile = (p: Product, profile: string) => {
  if (profile === 'all') return true;
  const pattern = new RegExp('(^|[^A-Z])' + profile + '[-\\s]?\\d', 'i');
  return [p.code, ...(p.variants || []).map(v => v.code)].some(code => pattern.test(code));
};
type Filters = { brands: string[]; profile: string; minimumLength: string; maximumLength: string; minimumPrice: string; maximumPrice: string; inStock: boolean; quoteOnly: boolean };
const blankFilters = (): Filters => ({ brands: [], profile: 'all', minimumLength: '', maximumLength: '', minimumPrice: '', maximumPrice: '', inStock: false, quoteOnly: false });
type FilterPanelProps = {
  value: Filters; onChange: (next: Filters) => void; brands: string[]; products: Product[]; classic: boolean; hasPrices: boolean;
};
function FilterFields({ value, onChange, brands, products, classic, hasPrices }: FilterPanelProps) {
  const [brandSearch, setBrandSearch] = useState('');
  const change = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  return <div className="bce-filter-fields">
    {classic && <section className="bce-filter-group"><h3><Ruler size={17}/> پروفیل تسمه</h3>
      <div className="bce-filter-chips" dir="ltr">{['all', ...PROFILES].map(item => <button type="button" key={item} className={value.profile === item ? 'active' : ''} onClick={() => change({ profile: item })}>{item === 'all' ? 'همه' : item}</button>)}</div>
    </section>}
    <section className="bce-filter-group"><h3><Layers3 size={17}/> برند سازنده</h3>
      <div className="bce-filter-search"><Search size={15}/><input aria-label="جستجو در برندها" value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="جستجوی برند..." /></div>
      <div className="bce-filter-brand-list">{brands.filter(brand => brand.toLowerCase().includes(brandSearch.toLowerCase())).map(brand => <label key={brand}>
        <span><strong dir="ltr">{brand}</strong><small>{toPersianDigits(products.filter(p => p.brand === brand).length)}</small></span>
        <input type="checkbox" checked={value.brands.includes(brand)} onChange={e => change({ brands: e.target.checked ? [...value.brands, brand] : value.brands.filter(v => v !== brand) })}/>
      </label>)}</div>
    </section>
    <section className="bce-filter-group"><h3><Ruler size={17}/> محدوده طول ثبت‌شده</h3><p>فقط محصولاتی که طول آن‌ها در مشخصات فنی ثبت شده است.</p>
      <div className="bce-range-fields"><label>از (mm)<input type="number" min="0" value={value.minimumLength} onChange={e => change({ minimumLength: e.target.value })} placeholder="حداقل"/></label><label>تا (mm)<input type="number" min="0" value={value.maximumLength} onChange={e => change({ maximumLength: e.target.value })} placeholder="حداکثر"/></label></div>
    </section>
    {hasPrices && <section className="bce-filter-group"><h3>محدوده قیمت ثبت‌شده</h3><p>فقط محصولاتی با قیمت معتبر و قابل نمایش.</p>
      <div className="bce-range-fields"><label>از<input type="number" min="0" value={value.minimumPrice} onChange={e => change({ minimumPrice: e.target.value })} placeholder="حداقل"/></label><label>تا<input type="number" min="0" value={value.maximumPrice} onChange={e => change({ maximumPrice: e.target.value })} placeholder="حداکثر"/></label></div>
    </section>}
    <section className="bce-filter-group bce-toggles"><h3>وضعیت تأمین</h3>
      <label><span>فقط موجودی تأییدشده</span><input type="checkbox" checked={value.inStock} onChange={e => change({ inStock: e.target.checked, quoteOnly: e.target.checked ? false : value.quoteOnly })}/></label>
      <label><span>فقط نیازمند استعلام قیمت</span><input type="checkbox" checked={value.quoteOnly} onChange={e => change({ quoteOnly: e.target.checked, inStock: e.target.checked ? false : value.inStock })}/></label>
    </section>
  </div>;
}
function CatalogCard({ product }: { product: Product }) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const href = '/product/' + encodeURIComponent(product.code);
  const marked = isInWishlist(product.code);
  const price = priceOf(product);
  const specs = (product.technicalSpecs || []).filter(spec => spec.key && spec.value).slice(0, 2);
  return <article className="bce-product-card">
    <div className="bce-product-image"><Link to={href} aria-label={'مشاهده ' + product.name}><ProductImage src={product.images?.[0]} alt={product.name} thumbnail loading="lazy" decoding="async"/></Link>
      <button type="button" aria-label={marked ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'} aria-pressed={marked} className="bce-heart" onClick={() => toggleWishlist(product.code)}><Heart size={18} fill={marked ? '#E06518' : 'none'}/></button>
      {product.variants && product.variants.length > 1 && <span className="bce-variant-badge">{toPersianDigits(product.variants.length)} سایز</span>}
    </div>
    <div className="bce-product-info"><div className="bce-product-code"><b dir="ltr">{product.code}</b><span dir="ltr">{product.brand || 'قطعات صنعتی'}</span></div>
      <Link to={href} className="bce-product-name">{product.name}</Link>
      <p className="bce-product-family"><Layers3 size={13}/>{product.subcategory}</p>
      <div className="bce-product-specs">{specs.length ? specs.map(spec => <div key={spec.key}><span>{spec.key}</span><strong>{spec.value}</strong></div>) : <div><span>گروه محصول</span><strong>{product.subcategory}</strong></div>}</div>
      <div className="bce-product-availability"><span className={product.stockKnown && product.stock > 0 ? 'dot in-stock' : 'dot'}/>{product.stockKnown && product.stock > 0 ? 'موجودی ثبت‌شده' : 'موجودی نیازمند تأیید'}</div>
      <div className="bce-product-price">{price !== null ? <><strong>{toPersianDigits(price.toLocaleString('en-US'))}</strong><small>قیمت ثبت‌شده</small></> : <small>قیمت پس از استعلام</small>}</div>
      <Link className="bce-product-cta" to={href}>مشاهده مشخصات و استعلام <ChevronLeft size={16}/></Link>
    </div>
  </article>;
}

export const BeltCategoryExperience: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFamily = searchParams.get('sub') || 'all';
  const isClassic = selectedFamily === 'کلاسیک';
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [draft, setDraft] = useState<Filters>(blankFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [page, setPage] = useState(1);
  const productsRef = useRef<HTMLDivElement>(null);
  const firstSheetButton = useRef<HTMLButtonElement>(null);
  useEffect(() => subscribeCatalogChanges(() => setRevision(v => v + 1)), []);
  useEffect(() => { setPage(1); setFilters(blankFilters()); }, [selectedFamily]);
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', close);
    firstSheetButton.current?.focus();
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); };
  }, [sheetOpen]);
  const allProducts = useMemo(() => getProductsByCategory(BELT_SLUG, 12000).products, [revision]);
  const familyProducts = useMemo(() => allProducts.filter(product => matchesCatalogCategory(product, BELT_SLUG, selectedFamily)), [allProducts, selectedFamily]);
  const brands = useMemo(() => Array.from(new Set(familyProducts.map(p => p.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [familyProducts]);
  const hasPrices = familyProducts.some(p => priceOf(p) !== null);
  const filtered = useMemo(() => {
    const minLength = filters.minimumLength !== '' ? number(filters.minimumLength) : null;
    const maxLength = filters.maximumLength !== '' ? number(filters.maximumLength) : null;
    const minPrice = filters.minimumPrice !== '' ? number(filters.minimumPrice) : null;
    const maxPrice = filters.maximumPrice !== '' ? number(filters.maximumPrice) : null;
    const selected = familyProducts.filter(product => {
      if (search.trim() && !matchesProductSearch(product, search.trim())) return false;
      if (filters.brands.length && !filters.brands.includes(product.brand)) return false;
      if (isClassic && !matchesProfile(product, filters.profile)) return false;
      if (filters.inStock && !(product.stockKnown && product.stock > 0 && !product.inquiryOnly)) return false;
      if (filters.quoteOnly && !product.inquiryOnly && priceOf(product) !== null) return false;
      if (minLength !== null || maxLength !== null) {
        const length = lengthMm(product);
        if (length === null || (minLength !== null && length < minLength) || (maxLength !== null && length > maxLength)) return false;
      }
      if (minPrice !== null || maxPrice !== null) {
        const price = priceOf(product);
        if (price === null || (minPrice !== null && price < minPrice) || (maxPrice !== null && price > maxPrice)) return false;
      }
      return true;
    });
    if (sortBy === 'code') selected.sort((a,b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
    if (sortBy === 'price-low') selected.sort((a,b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity));
    if (sortBy === 'price-high') selected.sort((a,b) => (priceOf(b) ?? -Infinity) - (priceOf(a) ?? -Infinity));
    return selected;
  }, [familyProducts, filters, search, isClassic, sortBy]);
  const pageSize = 24;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = filters.brands.length + (filters.profile !== 'all' ? 1 : 0) + [filters.minimumLength, filters.maximumLength, filters.minimumPrice, filters.maximumPrice].filter(Boolean).length + Number(filters.inStock) + Number(filters.quoteOnly);
  const chooseFamily = (family: string) => { const params = new URLSearchParams(searchParams); if (family === 'all') params.delete('sub'); else params.set('sub', family); setSearchParams(params); setSearch(''); setPage(1); };
  const scrollToProducts = () => productsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const changeFilters = (next: Filters) => { setFilters(next); setPage(1); };
  const openSheet = () => { setDraft({ ...filters, brands: [...filters.brands] }); setSheetOpen(true); };
  const applySheet = () => { changeFilters(draft); setSheetOpen(false); scrollToProducts(); };
  return <main className="bce" dir="rtl">
    <div className="bce-breadcrumb"><Link to="/">خانه</Link><ChevronLeft size={14}/><Link to="/categories">دسته‌بندی کالاها</Link><ChevronLeft size={14}/><strong>تسمه و انتقال نیرو</strong></div>
    <section className="bce-hero" aria-labelledby="bce-hero-title">
      <img className="bce-hero-photo" src={heroFailed ? heroFallback : '/images/belt-hero-cinematic.webp'} onError={() => setHeroFailed(true)} alt="مجموعه پولی و تسمه انتقال نیرو در خط تولید صنعتی"/>
      <div className="bce-hero-wash"/><div className="bce-hero-slash"/>
      <div className="bce-hero-content"><span className="bce-kicker"><Zap size={15}/> سامانه تخصصی قطعات خطوط تولید</span>
        <h1 id="bce-hero-title">تسمه و انتقال نیرو <em>{isClassic ? 'تسمه‌های کلاسیک V' : 'انتخاب حرفه‌ای قطعات انتقال قدرت'}</em></h1>
        <p>انتخاب دقیق خانواده، پروفیل و کد محصول از کاتالوگ صنعت پیش؛ بررسی مشخصات فنی، تصاویر واقعی و درخواست استعلام در چند مرحله.</p>
        <div className="bce-hero-actions"><button type="button" onClick={scrollToProducts}>مشاهده محصولات <ArrowLeft size={18}/></button><Link to="/ai-consult">مشاوره انتخاب تسمه <Headphones size={18}/></Link></div>
        <div className="bce-hero-points"><span><ShieldCheck size={20}/> کدهای واقعی کاتالوگ</span><span><Truck size={20}/> استعلام تأمین و ارسال</span><span><Settings2 size={20}/> انتخاب مهندسی</span></div>
      </div>
      <div className="bce-hero-stamp"><span>POWER TRANSMISSION</span><b>صنعت پیش</b></div>
    </section>
    <section className="bce-family-area" aria-labelledby="bce-family-title"><div className="bce-section-heading"><div><span>کاوش سریع</span><h2 id="bce-family-title">تسمه موردنیاز خود را پیدا کنید</h2></div><button type="button" onClick={() => chooseFamily('all')}>همه خانواده‌ها <ChevronLeft size={16}/></button></div>
      <div className="bce-family-grid">{FAMILY_OPTIONS.map((item, i) => {
        const sample = allProducts.find(p => matchesCatalogCategory(p, BELT_SLUG, item.id) && p.images?.[0]);
        return <button type="button" key={item.id} aria-pressed={selectedFamily === item.id} onClick={() => chooseFamily(item.id)} className={'bce-family-tile ' + (selectedFamily === item.id ? 'selected' : '')}>
          <span className="bce-family-image">{sample?.images?.[0] ? <img src={sample.images[0]} alt="" loading="lazy"/> : <Layers3 size={39}/>}</span>
          <span className="bce-family-name">{item.title}</span><small dir="ltr">{item.subtitle}</small><span className="bce-family-chevron"><ChevronLeft size={15}/></span>
        </button>;
      })}</div>
    </section>
    <section className="bce-brand-strip" aria-label="برندهای کاتالوگ"><strong>برندهای حاضر در این خانواده</strong><div className="bce-brands-scroll">{brands.slice(0,12).map(brand => <button type="button" key={brand} onClick={() => changeFilters({ ...filters, brands: filters.brands.includes(brand) ? [] : [brand] })} aria-pressed={filters.brands.includes(brand)} dir="ltr">{brand}</button>)}</div><span>{toPersianDigits(familyProducts.length)} خانواده محصول</span></section>
    {isClassic && <section className="bce-profile-row"><div><strong>پروفیل تسمه کلاسیک</strong><small>انتخاب مقطع مناسب دستگاه</small></div><div className="bce-profile-buttons" dir="ltr">{['all', ...PROFILES].map(value => <button key={value} type="button" aria-pressed={filters.profile === value} onClick={() => changeFilters({ ...filters, profile: value })}>{value === 'all' ? 'همه' : value}</button>)}</div></section>}
    <div className="bce-catalog" ref={productsRef}>
      <aside className="bce-sidebar" aria-label="فیلترهای محصولات"><div className="bce-sidebar-top"><h2><SlidersHorizontal size={19}/> فیلتر محصولات</h2><button type="button" onClick={() => changeFilters(blankFilters())}>پاکسازی <RotateCcw size={14}/></button></div><div className="bce-sidebar-search"><Search size={17}/><input aria-label="جستجو در کاتالوگ" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="نام، کد یا مشخصات فنی..."/></div><FilterFields value={filters} onChange={changeFilters} brands={brands} products={familyProducts} classic={isClassic} hasPrices={hasPrices}/></aside>
      <section className="bce-results" aria-labelledby="bce-results-title"><div className="bce-results-heading"><div><small>کاتالوگ تخصصی صنعت پیش</small><h2 id="bce-results-title">محصولات {selectedFamily === 'all' ? 'تسمه و انتقال نیرو' : FAMILY_OPTIONS.find(item => item.id === selectedFamily)?.title || selectedFamily}</h2></div><p>{toPersianDigits(filtered.length)} محصول مطابق انتخاب شما</p></div>
        <div className="bce-toolbar"><div className="bce-sort-desktop"><ArrowUpDown size={16}/><span>مرتب‌سازی:</span><button type="button" className={sortBy === 'default' ? 'current' : ''} onClick={() => setSortBy('default')}>پیشنهادی</button><button type="button" className={sortBy === 'code' ? 'current' : ''} onClick={() => setSortBy('code')}>کد کالا</button>{hasPrices && <><button type="button" className={sortBy === 'price-low' ? 'current' : ''} onClick={() => setSortBy('price-low')}>ارزان‌ترین</button><button type="button" className={sortBy === 'price-high' ? 'current' : ''} onClick={() => setSortBy('price-high')}>گران‌ترین</button></>}</div>
          <div className="bce-mobile-tools"><button type="button" onClick={openSheet}><Filter size={17}/> فیلتر {activeCount > 0 && <b>{toPersianDigits(activeCount)}</b>}</button><label><ArrowUpDown size={17}/><select aria-label="مرتب‌سازی موبایل" value={sortBy} onChange={e => setSortBy(e.target.value)}><option value="default">پیشنهادی</option><option value="code">کد کالا</option>{hasPrices && <><option value="price-low">ارزان‌ترین</option><option value="price-high">گران‌ترین</option></>}</select></label></div><span className="bce-count">{toPersianDigits(visible.length)} از {toPersianDigits(filtered.length)}</span>
        </div>
        {filtered.length === 0 ? <div className="bce-empty"><PackageSearch size={42}/><h3>کالایی مطابق این فیلترها پیدا نشد</h3><p>کد، خانواده یا فیلترها را تغییر دهید. اطلاعات ساختگی به جای محصولات واقعی نمایش داده نمی‌شود.</p><button type="button" onClick={() => { setSearch('');changeFilters(blankFilters()); }}>حذف فیلترها</button></div> : <>
          <div className="bce-products-grid">{visible.map(p => <CatalogCard key={p.code} product={p}/>)}</div>
          {totalPages > 1 && <nav className="bce-pagination" aria-label="صفحه‌بندی محصولات"><button type="button" disabled={currentPage <= 1} onClick={() => {setPage(currentPage - 1); scrollToProducts();}}>قبلی</button><span>صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => {setPage(currentPage + 1);scrollToProducts();}}>بعدی</button></nav>}
        </>}
      </section>
    </div>
    <section className="bce-selection-guide"><div className="bce-section-heading"><div><span>راهنمای کاربردی</span><h2>با اطمینان تسمه مناسب را انتخاب کنید</h2></div><Link to="/ai-consult">راهنمای تخصصی <ChevronLeft size={17}/></Link></div><div className="bce-steps">{[
      ['۰۱','نوع کاربرد','دستگاه، شرایط و محیط کاری را مشخص کنید.'],['۰۲','انتخاب مقطع','پروفیل و خانواده انتقال قدرت را تطبیق دهید.'],['۰۳','سایز و کد','طول و کد درج‌شده روی تسمه را کنترل کنید.'],['۰۴','استعلام','قیمت و موجودی کد موردنظر را دریافت کنید.']
    ].map(([n,title,desc]) => <div key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></div>)}</div></section>
    <section className="bce-industry-section"><div className="bce-section-heading"><div><span>از قطعه تا خط تولید</span><h2>کاربرد تسمه‌ها در صنایع مختلف</h2></div><Link to="/industries">مشاهده صنایع <ChevronLeft size={16}/></Link></div><div className="bce-industries">{[
      {name:'کاشی و سرامیک',image:industryCeramic,link:'/industries/ceramic',desc:'قطعات انتقال نیرو در خطوط تولید'}, {name:'نساجی و پارچه',image:industryTextile,link:'/industries/textile',desc:'ماشین‌آلات ریسندگی و بافندگی'}, {name:'بسته‌بندی و کارتن‌سازی',image:industryPackaging,link:'/industries/packaging',desc:'انتقال حرکت و تجهیزات تولید'}, {name:'غذایی و نوشیدنی',image:industryFood,link:'/industries/food',desc:'تجهیزات خطوط فرآوری و بسته‌بندی'}
    ].map(item => <Link key={item.name} to={item.link} className="bce-industry"><img src={item.image} alt={item.name} loading="lazy"/><div><h3>{item.name}</h3><small>{item.desc}</small></div><ChevronLeft size={21}/></Link>)}</div></section>
    <section className="bce-help-cards"><Link className="bce-help-visual" to="/identify-part"><img src={aiVisual} alt="" loading="lazy"/><div><span><Zap size={15}/> میزکار شناسایی</span><h2>قطعه را با تصویر پیدا کنید</h2><p>تصویر قطعه یا نوشته روی تسمه را ارسال کنید تا مسیر شناسایی ساده‌تر شود.</p><strong>شروع شناسایی <ArrowLeft size={16}/></strong></div></Link><Link className="bce-help-ai" to="/ai-consult"><img src={aiConsult} alt="" loading="lazy"/><div><span><Headphones size={15}/> مشاوره مهندسی</span><h2>در انتخاب قطعه تردید دارید؟</h2><p>مشخصات دستگاه و نیاز فنی را مطرح کنید و راهنمایی تخصصی دریافت کنید.</p><strong>شروع مشاوره <ArrowLeft size={16}/></strong></div></Link></section>
    <div className="bce-bottom-line"><CircleHelp size={17}/> سایز و سازگاری قطعه پیش از سفارش باید با مشخصات واقعی دستگاه تطبیق داده شود.</div>
    {sheetOpen && <div className="bce-sheet-backdrop" onMouseDown={() => setSheetOpen(false)}><section className="bce-sheet" role="dialog" aria-modal="true" aria-label="فیلتر محصولات" onMouseDown={e => e.stopPropagation()}><div className="bce-sheet-grip"/><header><strong>فیلتر محصولات</strong><button type="button" ref={firstSheetButton} aria-label="بستن فیلترها" onClick={() => setSheetOpen(false)}><X size={22}/></button></header><div className="bce-sheet-scroll"><FilterFields value={draft} onChange={setDraft} brands={brands} products={familyProducts} classic={isClassic} hasPrices={hasPrices}/></div><footer><button type="button" onClick={() => setDraft(blankFilters())}>حذف فیلترها</button><button type="button" onClick={applySheet}><Check size={18}/> اعمال و نمایش محصولات</button></footer></section></div>}
  </main>;
};
