import beltHero from '../assets/images/forza_sub_belt_1791282448324.jpg';
import '../category-showcase.css';
import { matchesProductSearch } from '../data/userProducts';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { scrollToSectionElement } from '../components/layout/ScrollToTop';
import { CATEGORIES, findCatalogCategory, matchesCatalogCategory } from '../data/categories';
import { CategoryNavigation } from '../components/catalog/CategoryNavigation';
import { getProductsByCategory } from '../data/mockGenerator';
import { ProductCard } from '../components/product/ProductCard';
import { ProductImage } from '../components/product/ProductImage';
import { toPersianDigits } from '../utils/formatters';
import {
  ChevronLeft,
  SlidersHorizontal,
  ArrowUpDown,
  Layers,
  Sparkles,
  Package,
  CheckCircle2,
  Search,
  RotateCcw,
  Boxes,
  ShieldCheck,
  Check,
  Heart,
  Truck,
  Headphones,
  Ruler,
  Camera,
  MessageCircle,
  ChevronDown
} from 'lucide-react';

export const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const category = findCatalogCategory(slug || '') || CATEGORIES[0];
  const [searchParams, setSearchParams] = useSearchParams();
  const subParam = searchParams.get('sub') || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState<string>(subParam);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState('all');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileFiltersOpen]);
  const isBeltCategory = category.name === 'تسمه و انتقال نیرو';
  const isClassicBelt = category.name === 'تسمه و انتقال نیرو' && /کلاسیک/.test(selectedSubcat);
  const beltProfiles = ['A', 'B', 'C', 'D', 'E', 'Z', 'M'];
  const beltLength = (product: { technicalSpecs: {key:string;value:string}[] }): number | null => {
    const entry = product.technicalSpecs?.find(spec => /طول|length/i.test(spec.key));
    if (!entry) return null;
    const normalized = entry.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/,/g, '');
    const number = normalized.match(/\d+(?:\.\d+)?/);
    if (!number) return null;
    const parsed = Number(number[0]);
    return Number.isFinite(parsed) ? (/اینچ|inch/i.test(normalized) ? parsed * 25.4 : parsed) : null;
  };
  const [inStockOnly, setInStockOnly] = useState(false);
  const [inquiryOnlyFilter, setInquiryOnlyFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'code'>('default');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const productsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedSubcat(subParam);
    setSelectedProfile('all');
    setPage(1);
  }, [category.slug, subParam]);
  const selectSubcategory = (name: string) => {
    const params = new URLSearchParams(searchParams);
    if (name === 'all') params.delete('sub');
    else params.set('sub', name);
    setSearchParams(params);
    setSelectedSubcat(name);
    setPage(1);
    window.requestAnimationFrame(() => {
      scrollToSectionElement(productsSectionRef.current, { behavior: 'smooth' });
    });
  };

  const rawData = useMemo(() => {
    return getProductsByCategory(category.slug, 1000, 0);
  }, [category.slug]);

  // Extract unique brands for filtering
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    rawData.products.forEach(p => {
      if (p.brand) brandsSet.add(p.brand);
    });
    return Array.from(brandsSet);
  }, [rawData]);

  // Filter and sort
  const filteredProducts = useMemo(() => {
    let list = [...rawData.products];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        matchesProductSearch(p, q) ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.subcategory && p.subcategory.toLowerCase().includes(q))
      );
    }

    if (selectedSubcat !== 'all') {
      list = list.filter(p => matchesCatalogCategory(p, category.slug, selectedSubcat));
    }
    if (isClassicBelt && selectedProfile !== 'all') {
      const pattern = new RegExp('^' + selectedProfile + '[-\\s]?\\d', 'i');
      list = list.filter(p => pattern.test(p.code) || p.variants?.some(v => pattern.test(v.code)));
    }
    if (minLength.trim() || maxLength.trim()) {
      const min = minLength.trim() ? Number(minLength) : null;
      const max = maxLength.trim() ? Number(maxLength) : null;
      list = list.filter(p => {
        const length = beltLength(p);
        return length !== null && (min === null || length >= min) && (max === null || length <= max);
      });
    }
    if (selectedBrands.length) list = list.filter(p => selectedBrands.includes(p.brand));
    if (selectedBrand !== 'all') {
      list = list.filter(p => p.brand === selectedBrand);
    }
    if (inStockOnly) {
      list = list.filter(p => p.stock > 0 && !p.inquiryOnly);
    }
    if (inquiryOnlyFilter) {
      list = list.filter(p => p.inquiryOnly);
    }

    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.prices.retail - b.prices.retail);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.prices.retail - a.prices.retail);
    } else if (sortBy === 'code') {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }

    return list;
  }, [rawData, category.slug, searchQuery, selectedSubcat, selectedBrand, selectedBrands, inStockOnly, inquiryOnlyFilter, sortBy, selectedProfile, minLength, maxLength, isClassicBelt]);

  const paginated = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProfile('all');
    setMinLength('');
    setMaxLength('');
    selectSubcategory('all');
    setSelectedBrand('all');
    setSelectedBrands([]);
    setInStockOnly(false);
    setInquiryOnlyFilter(false);
    setSortBy('default');
    setPage(1);
  };

  const hasActiveFilters = searchQuery !== '' || selectedSubcat !== 'all' || selectedBrand !== 'all' || selectedBrands.length > 0 || inStockOnly || inquiryOnlyFilter || selectedProfile !== 'all' || minLength !== '' || maxLength !== '';

  return (
    <div className="category-showcase space-y-8 text-right pb-16" dir="rtl">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
        <Link to="/" className="hover:text-[#E06518] transition-colors">
          صفحه اصلی
        </Link>
        <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        <Link to="/categories" className="hover:text-[#E06518] transition-colors">
          دسته‌بندی‌ها
        </Link>
        <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-bold">{category.name}</span>
      </nav>


      {isBeltCategory ? (
        <>
          <section className="category-showcase-hero relative isolate min-h-[360px] overflow-hidden rounded-2xl bg-[#222529] text-white md:min-h-[440px]">
            <img src={beltHero} alt="تسمه‌های صنعتی و انتقال نیرو" className="category-showcase-hero-image absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#202225] via-[#202225]/95 to-[#202225]/20"/>
            <div className="absolute left-[27%] top-0 h-full w-[12%] -skew-x-[25deg] bg-[#E06518]/75"/>
            <div className="relative z-10 flex min-h-[360px] flex-col justify-center gap-5 p-7 md:min-h-[440px] md:p-14">
              <h1 className="text-3xl font-black md:text-5xl">تسمه و انتقال نیرو</h1>
              <h2 className="text-xl font-bold md:text-3xl">{isClassicBelt ? 'تسمه‌های کلاسیک V' : selectedSubcat === 'all' ? 'انواع تسمه‌های صنعتی' : selectedSubcat}</h2>
              <p className="max-w-[450px] text-xs leading-7 text-slate-200 md:text-sm">انتخاب سریع و دقیق تسمه مناسب خط تولید شما بر اساس خانواده، کد و مشخصات ثبت‌شده در کاتالوگ صنعت پیش.</p>
              <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-bold md:gap-7">
                <span className="flex items-center gap-2"><ShieldCheck className="text-[#E06518]"/> انتخاب از کاتالوگ واقعی</span>
                <span className="flex items-center gap-2"><Truck className="text-[#E06518]"/> استعلام تأمین و موجودی</span>
                <span className="flex items-center gap-2"><Headphones className="text-[#E06518]"/> مشاوره تخصصی</span>
              </div>
            </div>
          </section>
          <section className="category-showcase-families grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="خانواده‌های تسمه">
            {[
              {label:'کلاسیک',value:'کلاسیک',matcher:/کلاسیک/},
              {label:'پروفیل باریک',value:'اسپشیال',matcher:/اسپشیال/},
              {label:'تایمینگ',value:'تسمه تایمینگ',matcher:/تایمینگ/},
              {label:'شیاری',value:'تسمه شیاری',matcher:/شیاری/},
              {label:'گرد پلی‌یورتان',value:'تسمه گرد پلی اورتان',matcher:/گرد/},
              {label:'CRC پنج‌ضلعی',value:'تسمه CRC پنج ضلعی',matcher:/CRC/},
            ].map((item,index) => {
              const image = rawData.products.find(p => item.matcher.test([p.subcategory,p.submenu,p.name].join(' ')) && p.images?.length)?.images?.[0];
              return <button type="button" key={item.value} aria-pressed={selectedSubcat === item.value}
                onClick={()=>selectSubcategory(item.value)} className={`flex h-20 items-center justify-between gap-1 overflow-hidden rounded-xl border px-3 text-xs font-extrabold transition-colors md:h-24 ${selectedSubcat===item.value ? 'border-[#E06518] bg-orange-50 text-[#E06518]' : 'border-slate-100 bg-[#f5f6f7] hover:border-orange-300'}`}>
                <span>{item.label}</span>
                {image ? <img src={image} alt="" loading="lazy" className="h-14 w-16 object-contain md:h-20 md:w-20"/> : <Layers size={25} className="text-slate-400"/>}
              </button>;
            })}
          </section>
          {isClassicBelt && <div className="flex flex-wrap items-center justify-center gap-2" dir="ltr">
            {['all',...beltProfiles].map(profile=><button type="button" key={profile} aria-pressed={selectedProfile===profile} onClick={()=>{setSelectedProfile(profile);setPage(1);}}
              className={`h-10 min-w-10 rounded-full px-3 text-xs font-bold ${selectedProfile===profile?'bg-[#E06518] text-white':'bg-[#f2f3f5] text-slate-700 hover:bg-orange-50'}`}>{profile==='all'?'همه':profile}</button>)}
          </div>}
        </>
      ) : (
        <section className="rounded-2xl bg-[#303337] p-8 text-white">
          <h1 className="text-3xl font-black">{category.name}</h1>
          <p className="mt-3 text-sm text-slate-200">{category.description}</p>
        </section>
      )}
      {!isBeltCategory && category.subcategories?.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <CategoryNavigation key={category.slug} nodes={category.children} categorySlug={category.slug} selected={selectedSubcat} onSelect={selectSubcategory}/>
        </div>
      )}
      {/* In-Category Search & Sorting Toolbar */}
      <div
        ref={productsSectionRef}
        id="category-products-section"
        className="bg-[#f7f8f9] rounded-xl border border-slate-100 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 scroll-mt-24"
      >
        {/* Search within category */}
        <div className="relative w-full md:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="جستجو در این دسته‌بندی..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#E06518] focus:bg-white transition-colors placeholder:text-slate-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md hover:bg-slate-300"
            >
              پاک کردن
            </button>
          )}
        </div>

        {/* Sorting options */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          <span className="text-slate-500 font-bold flex items-center gap-1.5 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#E06518]" />
            <span>مرتب‌سازی:</span>
          </span>

          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSortBy('default')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                sortBy === 'default'
                  ? 'bg-white text-[#E06518] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              پیشنهاد ویژه
            </button>


            <button
              onClick={() => setSortBy('code')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                sortBy === 'code'
                  ? 'bg-white text-[#E06518] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              کد پارت‌نامبر
            </button>
          </div>
        </div>
      </div>

      <div className="category-mobile-toolbar lg:hidden" role="group" aria-label="فیلتر و مرتب‌سازی">
        <button type="button" onClick={() => setMobileFiltersOpen(true)} aria-haspopup="dialog">
          <SlidersHorizontal size={18} /> فیلترها {hasActiveFilters && <span className="category-filter-active-dot"/>}
        </button>
        <button type="button" onClick={() => setSortBy(sortBy === 'code' ? 'default' : 'code')}>
          <ArrowUpDown size={18}/> {sortBy === 'code' ? 'مرتب بر اساس کد' : 'مرتب‌سازی'}
        </button>
        <span>{toPersianDigits(filteredProducts.length)} کالا</span>
      </div>
      {mobileFiltersOpen && <div className="category-filter-overlay lg:hidden" onMouseDown={() => setMobileFiltersOpen(false)}>
        <section className="category-filter-sheet" role="dialog" aria-modal="true" aria-label="فیلتر محصولات" onMouseDown={event => event.stopPropagation()}>
          <div className="category-filter-handle"/>
          <div className="category-filter-sheet-header">
            <strong>فیلتر محصولات</strong>
            <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="بستن فیلترها">✕</button>
          </div>
          <div className="category-filter-sheet-content" id="mobile-filter-content">
            <div className="category-mobile-filters">
              <label className="category-filter-label">کد یا نام محصول
                <input value={searchQuery} onChange={event => {setSearchQuery(event.target.value);setPage(1);}} placeholder="جستجوی کد کالا، مثلاً A-45"/>
              </label>
              {isClassicBelt && <fieldset>
                <legend>پروفیل تسمه</legend>
                <div className="category-filter-pills">
                  {['all', ...beltProfiles].map(profile => <button type="button" key={profile} aria-pressed={selectedProfile === profile}
                    onClick={() => {setSelectedProfile(profile);setPage(1);}}>{profile === 'all' ? 'همه' : profile}</button>)}
                </div>
                <legend>طول تسمه (میلی‌متر)</legend>
                <div className="category-filter-range">
                  <input type="number" min="0" aria-label="حداقل طول" placeholder="از" value={minLength} onChange={event=>{setMinLength(event.target.value);setPage(1);}}/>
                  <input type="number" min="0" aria-label="حداکثر طول" placeholder="تا" value={maxLength} onChange={event=>{setMaxLength(event.target.value);setPage(1);}}/>
                </div>
              </fieldset>}
              <fieldset><legend>برند</legend>
                {availableBrands.map(brand => <label className="category-filter-choice" key={brand}>
                  <span>{brand}</span>
                  <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={event=>{setSelectedBrands(previous=>event.target.checked?[...previous,brand]:previous.filter(value=>value!==brand));setPage(1);}}/>
                </label>)}
              </fieldset>
              <fieldset><legend>موجودی و استعلام</legend>
                <label className="category-filter-choice">فقط موجود در انبار <input type="checkbox" checked={inStockOnly} onChange={event=>{setInStockOnly(event.target.checked);if(event.target.checked)setInquiryOnlyFilter(false);setPage(1);}}/></label>
                <label className="category-filter-choice">فقط نیازمند استعلام <input type="checkbox" checked={inquiryOnlyFilter} onChange={event=>{setInquiryOnlyFilter(event.target.checked);if(event.target.checked)setInStockOnly(false);setPage(1);}}/></label>
              </fieldset>
            </div>
          </div>
          <div className="category-filter-sheet-footer">
            <button type="button" onClick={handleResetFilters}>پاک کردن</button>
            <button type="button" onClick={() => setMobileFiltersOpen(false)}>نمایش {toPersianDigits(filteredProducts.length)} کالا</button>
          </div>
        </section>
      </div>}
      {/* Main Content Area: Sidebar Filters + Products Grid */}
      <div className="category-showcase-shop grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar Filters Widget */}
        <div className="hidden space-y-4 lg:block">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4 lg:sticky lg:top-24">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs sm:text-sm font-black text-[#2B313A] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#E06518]" />
                فیلترهای پیشرفته
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>حذف فیلترها</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="category-product-code" className="block text-xs font-extrabold text-slate-800">کد یا نام محصول</label>
              <input id="category-product-code" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="مثلاً A-45" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#E06518] focus:outline-none"/>
            </div>
            {isClassicBelt && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-extrabold text-slate-800">محدوده طول ثبت‌شده (میلی‌متر)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="حداقل طول" type="number" min="0" placeholder="از" value={minLength}
                    onChange={e => { setMinLength(e.target.value); setPage(1); }} className="w-full min-w-0 rounded-lg border border-slate-200 p-2 text-xs"/>
                  <input aria-label="حداکثر طول" type="number" min="0" placeholder="تا" value={maxLength}
                    onChange={e => { setMaxLength(e.target.value); setPage(1); }} className="w-full min-w-0 rounded-lg border border-slate-200 p-2 text-xs"/>
                </div>
              </div>
            )}
            {availableBrands.length > 0 && (
              <fieldset className="space-y-3 border-t border-slate-100 pt-3">
                <legend className="text-xs font-extrabold text-slate-800">برند</legend>
                {availableBrands.map(brand => <label key={brand} className="flex cursor-pointer items-center justify-between gap-3 text-xs text-slate-700">
                  <span>{brand} <span className="text-slate-400">({toPersianDigits(rawData.products.filter(p=>p.brand===brand).length)})</span></span>
                  <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={e=>{setSelectedBrands(previous=>e.target.checked?[...previous,brand]:previous.filter(v=>v!==brand));setPage(1);}} className="h-4 w-4 accent-[#E06518]"/>
                </label>)}
              </fieldset>
            )}
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 text-xs font-bold">
              <span>فقط کالاهای دارای موجودی ثبت‌شده</span>
              <input type="checkbox" checked={inStockOnly} onChange={e => { setInStockOnly(e.target.checked); if (e.target.checked) setInquiryOnlyFilter(false); setPage(1); }} className="accent-[#E06518]"/>
            </label>
            {/* Status Toggles */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">


              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors border border-slate-100">
                <span className="text-xs font-bold text-[#2B313A]">فقط اقلام نیازمند استعلام قیمت</span>
                <input
                  type="checkbox"
                  checked={inquiryOnlyFilter}
                  onChange={e => {
                    setInquiryOnlyFilter(e.target.checked);
                    if (e.target.checked) setInStockOnly(false);
                    setPage(1);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-[#E06518] focus:ring-[#E06518] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Product Grid Column */}
        <div className="lg:col-span-3 space-y-6">
          <div aria-live="polite" className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
            <span>{toPersianDigits(filteredProducts.length)} محصول مطابق فیلترها</span>
            <span>{toPersianDigits(paginated.length)} محصول در این صفحه</span>
          </div>
          {paginated.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-orange-50 text-[#E06518] rounded-full flex items-center justify-center mx-auto">
                <Package className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-base text-[#2B313A]">هیچ کالا یا قطعه‌ای یافت نشد</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  با فیلترها یا عبارت جستجوی فعلی، محصولی پیدا نشد. لطفاً عبارت دیگری جستجو کنید یا فیلترها را حذف کنید.
                </p>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 bg-[#E06518] hover:bg-[#C95210] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>پاکسازی همه فیلترها</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="category-showcase-products grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginated.map(product => (
                  isBeltCategory ? (
                    <article key={product.code} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                      <Link to={`/product/${encodeURIComponent(product.code)}`} className="category-showcase-product-media flex h-52 items-center justify-center rounded-lg bg-[#fafafa]">
                        <ProductImage src={product.images?.[0]} alt={product.name} thumbnail loading="lazy" decoding="async"/>
                      </Link>
                      <div className="mt-3 flex items-center justify-between gap-2"><strong dir="ltr" className="text-base font-black text-slate-900">{product.code}</strong><span className="text-[11px] font-extrabold text-[#E06518]">{product.brand}</span></div>
                      <Link to={`/product/${encodeURIComponent(product.code)}`} className="mt-2 line-clamp-2 min-h-10 text-xs font-bold text-slate-800 hover:text-[#E06518]">{product.name}</Link>
                      <p className="mt-1 text-[11px] text-slate-500">{product.subcategory}</p>
                      <span className={`mt-2 text-[11px] font-bold ${product.stockKnown && product.stock > 0?'text-green-600':'text-slate-500'}`}>{product.stockKnown ? product.stock > 0 ? '● موجود در انبار' : 'موجودی تأیید نشده' : 'موجودی نیازمند استعلام'}</span>
                      <Link to={`/product/${encodeURIComponent(product.code)}`} className="mt-3 rounded-lg bg-[#E06518] py-2.5 text-center text-xs font-extrabold text-white hover:bg-[#bd5310]">استعلام قیمت</Link>
                    </article>
                  ) : <ProductCard key={product.code} product={product}/>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4 text-xs font-bold">
                  <button
                    onClick={() => {
                      setPage(prev => Math.max(1, prev - 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    صفحه قبلی
                  </button>

                  <div className="text-slate-600 font-mono">
                    صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
                  </div>

                  <button
                    onClick={() => {
                      setPage(prev => Math.min(totalPages, prev + 1));
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    disabled={page === totalPages}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    صفحه بعدی
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isBeltCategory && (
        <>
          <section className="category-showcase-guide rounded-2xl bg-[#fff8f3] p-6 md:p-9">
            <h2 className="text-base font-black text-slate-900">راهنمای انتخاب سریع تسمه کلاسیک</h2>
            <p className="mt-1 text-xs text-slate-500">در چهار مرحله مشخصات مورد نیاز را بررسی کنید.</p>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                ['۱','شناسایی کاربرد','نوع دستگاه و شرایط کاری'],
                ['۲','انتخاب پروفیل','انتخاب سری متناسب با دستگاه'],
                ['۳','بررسی سایز','کنترل طول و مشخصات فنی'],
                ['۴','استعلام و خرید','دریافت قیمت و موجودی واقعی'],
              ].map(([step,title,description])=><div key={step} className="rounded-xl border border-orange-100 bg-white p-4"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 font-black text-[#E06518]">{step}</span><h3 className="mt-2 text-xs font-black">{title}</h3><p className="mt-1 text-[11px] text-slate-500">{description}</p></div>)}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-black">کاربردها در صنایع مختلف</h2>
            <div className="category-showcase-industries grid grid-cols-2 gap-4 lg:grid-cols-4">
              {['کاشی و سرامیک','نساجی و پارچه','بسته‌بندی و کارتن‌سازی','غذایی و نوشیدنی'].map(name=><Link key={name} to="/industries" className="rounded-xl border border-slate-200 bg-white p-5 text-center text-xs font-black text-slate-700 hover:border-orange-400">{name}</Link>)}
            </div>
          </section>
          <div className="category-showcase-actions grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link to="/ai-visual-search" className="rounded-xl bg-orange-50 p-5 hover:bg-orange-100"><div className="flex items-center gap-3"><Camera className="text-[#E06518]"/><strong>شناسایی قطعه با تصویر</strong></div><p className="mt-2 text-xs text-slate-600">با ارسال تصویر، قطعه صنعتی خود را شناسایی کنید.</p></Link>
            <Link to="/ai-consult" className="rounded-xl bg-slate-100 p-5 hover:bg-slate-200"><div className="flex items-center gap-3"><MessageCircle className="text-[#E06518]"/><strong>مشاوره هوشمند</strong></div><p className="mt-2 text-xs text-slate-600">برای انتخاب تسمه مناسب راهنمایی بگیرید.</p></Link>
          </div>
        </>
      )}
    </div>
  );
};
