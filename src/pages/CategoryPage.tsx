import '../category-showcase.css';
import { STORE_ASSETS } from '../assets/images';
import { matchesProductSearch, categorySlugFor } from '../data/userProducts';
import { BeltCategoryExperience } from './BeltCategoryExperience';
import { ExcelMenuCategoryPage } from './ExcelMenuCategoryPage';
import { PulleyCatalogPage } from './PulleyCatalogPage';
import { subscribeCatalogChanges } from '../data/mockGenerator';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Navigate, useLocation, useParams, Link, useSearchParams } from 'react-router-dom';
import { scrollToSectionElement } from '../components/layout/ScrollToTop';
import { CATEGORIES, findCatalogCategory, matchesCatalogCategory, resolveCategorySlug } from '../data/categories';
import { CategoryNavigation } from '../components/catalog/CategoryNavigation';
import { toDirectSkuProduct, useDirectSkus } from '../components/catalog/DirectSkuProducts';
import { getProductDisplayBrands, productHasDisplayBrand, resolveDisplayBrand } from '../utils/catalogBrands';
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
  const location = useLocation();
  // Keep original legacy category pages unchanged; approved Excel categories get their
  // own real family listing instead of linking several menu categories to one old page.
  if (/^excel-v2-[0-9]+-[0-9]+$/.test(slug || '')) {
    return <ExcelMenuCategoryPage />;
  }
  const canonicalBeltSlug = categorySlugFor('تسمه و انتقال نیرو');
  if (resolveCategorySlug(slug || '') === canonicalBeltSlug) {
    if (slug !== canonicalBeltSlug) {
      return <Navigate to={`/category/${canonicalBeltSlug}${location.search}${location.hash}`} replace />;
    }
    return <BeltCategoryExperience />;
  }
  const canonicalPulleySlug = categorySlugFor('پولی و انتقال نیرو');
  if (resolveCategorySlug(slug || '') === canonicalPulleySlug) {
    if (slug !== canonicalPulleySlug) {
      return <Navigate to={`/category/${canonicalPulleySlug}${location.search}${location.hash}`} replace />;
    }
    return <PulleyCategoryRoute />;
  }
  return <LegacyCategoryPage />;
};

/** Use the same DB-hydrated catalogue as the rest of the storefront. */
const PulleyCategoryRoute: React.FC = () => {
  const [, refresh] = useState(0);
  useEffect(() => subscribeCatalogChanges(() => refresh(value => value + 1)), []);
  const pulleySlug = categorySlugFor('پولی و انتقال نیرو');
  const products = getProductsByCategory(pulleySlug, 5000, 0).products;
  const directSkus = useDirectSkus(pulleySlug, 'excel-v2-4-');
  const familyCodes = new Set(products.map(product => product.code.trim().toLowerCase()));
  const directSkuProducts = directSkus
    .filter(item => item.categorySlug === categorySlugFor('پولی و انتقال نیرو') || /^excel-v2-4-[0-9]+$/.test(item.categorySlug))
    .map(toDirectSkuProduct)
    .filter(product => !familyCodes.has(product.code.trim().toLowerCase()));
  const directSkuCodes = new Set(directSkuProducts.map(product => product.code));
  return <PulleyCatalogPage products={[...products, ...directSkuProducts]} directSkuCodes={directSkuCodes} />;
};

const LegacyCategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const category = findCatalogCategory(slug || '') || CATEGORIES[0];
  const directSkuRecords = useDirectSkus(category.slug);
  const [catalogRevision, setCatalogRevision] = useState(0);
  useEffect(() => subscribeCatalogChanges(() => setCatalogRevision(value => value + 1)), []);
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
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  useEffect(() => {
    if (!mobileFiltersOpen && !compareModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
        setCompareModalOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileFiltersOpen, compareModalOpen]);

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
    void catalogRevision;
    return getProductsByCategory(category.slug, 1000, 0);
  }, [category.slug, catalogRevision]);

  const directSkuProducts = useMemo(() => {
    const familyCodes = new Set(rawData.products.map(product => product.code.trim().toLowerCase()));
    return directSkuRecords
      .filter(item => item.categorySlug === category.slug)
      .map(toDirectSkuProduct)
      .filter(product => !familyCodes.has(product.code.trim().toLowerCase()));
  }, [directSkuRecords, category.slug, rawData.products]);
  const directSkuCodes = useMemo(
    () => new Set(directSkuProducts.map(product => product.code)),
    [directSkuProducts],
  );
  const categoryProducts = useMemo(
    () => [...rawData.products, ...directSkuProducts],
    [rawData.products, directSkuProducts],
  );

  // Derive brand facets from the currently selected subcategory, not the whole category.
  const brandFacetProducts = useMemo(
    () => selectedSubcat === 'all'
      ? categoryProducts
      : categoryProducts.filter(product => matchesCatalogCategory(product, category.slug, selectedSubcat)),
    [categoryProducts, category.slug, selectedSubcat],
  );
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    brandFacetProducts.forEach(product =>
      getProductDisplayBrands(product).forEach(brand => brands.add(brand)),
    );
    return Array.from(brands).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [brandFacetProducts]);

  // Visual subcategory cards with representative image and item count
  const visualSubcategories = useMemo(() => {
    const nodes = (category.children || []).filter(node => node.hidden !== true);
    return nodes.slice(0, 8).map(node => {
      const value = node.value || node.name;
      const matching = categoryProducts.filter(p => matchesCatalogCategory(p, category.slug, value));
      const sampleImage = matching.find(p => p.images?.length)?.images?.[0] || category.image;
      return {
        name: node.name,
        value,
        count: matching.length,
        image: sampleImage,
      };
    });
  }, [category, categoryProducts]);

  const toggleCompareProduct = (code: string) => {
    setCompareCodes(prev => {
      if (prev.includes(code)) return prev.filter(item => item !== code);
      if (prev.length >= 4) return [...prev.slice(1), code];
      return [...prev, code];
    });
  };

  const comparedProducts = useMemo(
    () => compareCodes
      .map(code => categoryProducts.find(p => p.code === code))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [compareCodes, categoryProducts],
  );

  const comparedSpecKeys = useMemo(() => {
    const keys: string[] = [];
    for (const p of comparedProducts) {
      for (const spec of p.technicalSpecs || []) {
        if (spec.key && !keys.includes(spec.key)) keys.push(spec.key);
      }
    }
    return keys.slice(0, 10);
  }, [comparedProducts]);

  // Filter and sort
  const filteredProducts = useMemo(() => {
    let list = [...categoryProducts];

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
    if (selectedBrands.length) list = list.filter(p => selectedBrands.some(brand => productHasDisplayBrand(p, brand)));
    if (selectedBrand !== 'all') {
      list = list.filter(p => productHasDisplayBrand(p, selectedBrand));
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
  }, [categoryProducts, category.slug, searchQuery, selectedSubcat, selectedBrand, selectedBrands, inStockOnly, inquiryOnlyFilter, sortBy, selectedProfile, minLength, maxLength, isClassicBelt]);

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
            <img src={STORE_ASSETS.forzaSubBelt} alt="تسمه‌های صنعتی و انتقال نیرو" className="category-showcase-hero-image absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#202225] via-[#202225]/95 to-[#202225]/20"/>
            <div className="absolute left-[27%] top-0 h-full w-[12%] -skew-x-[25deg] bg-[#E06518]/75"/>
            <div className="relative z-10 flex min-h-[360px] flex-col justify-center gap-5 p-7 md:min-h-[440px] md:p-14">
              <div className="category-hero-eyebrow">صنعت پیش <span> / </span> راهکارهای انتقال قدرت</div><h1 className="text-3xl font-black md:text-5xl">تسمه و انتقال نیرو</h1>
              <h2 className="text-xl font-bold md:text-3xl">{isClassicBelt ? 'تسمه‌های کلاسیک V' : selectedSubcat === 'all' ? 'انواع تسمه‌های صنعتی' : selectedSubcat}</h2>
              <p className="max-w-[450px] text-xs leading-7 text-slate-200 md:text-sm">انتخاب سریع و دقیق تسمه مناسب خط تولید شما بر اساس خانواده، کد و مشخصات ثبت‌شده در کاتالوگ صنعت پیش.</p>
              <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-bold md:gap-7">
                <span className="flex items-center gap-2"><ShieldCheck className="text-[#E06518]"/> انتخاب از کاتالوگ واقعی</span>
                <span className="flex items-center gap-2"><Truck className="text-[#E06518]"/> استعلام تأمین و موجودی</span>
                <span className="flex items-center gap-2"><Headphones className="text-[#E06518]"/> مشاوره تخصصی</span>
              </div>
              <div className="category-hero-actions"><button type="button" onClick={()=>scrollToSectionElement(productsSectionRef.current,{behavior:'smooth'})}>مشاهده محصولات <ChevronLeft size={17}/></button><Link to="/ai-consult">راهنمای انتخاب تخصصی <Headphones size={16}/></Link></div>
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
            ].map((item) => {
              const image = categoryProducts.find(p => item.matcher.test([p.subcategory,p.submenu,p.name].join(' ')) && p.images?.length)?.images?.[0];
              return <button type="button" key={item.value} aria-pressed={selectedSubcat === item.value}
                onClick={()=>selectSubcategory(item.value)} className={`flex h-20 items-center justify-between gap-1 overflow-hidden rounded-xl border px-3 text-xs font-extrabold transition-colors md:h-24 ${selectedSubcat===item.value ? 'border-[#E06518] bg-orange-50 text-[#E06518]' : 'border-slate-100 bg-[#f5f6f7] hover:border-orange-300'}`}>
                <span>{item.label}</span>
                {image ? <img src={image} alt="" loading="lazy" className="h-14 w-16 object-contain md:h-20 md:w-20"/> : <Layers size={25} className="text-slate-400"/>}
              </button>;
            })}
          </section>
          <section className="category-brand-ribbon" aria-label="برندهای موجود در کاتالوگ">
            <strong>برندهای موجود در کاتالوگ</strong>
            <div>{availableBrands.slice(0,9).map(brand => <button key={brand} type="button" onClick={()=>{setSelectedBrands([brand]);setPage(1);scrollToSectionElement(productsSectionRef.current,{behavior:'smooth'});}}>{brand}</button>)}</div>
            <button type="button" onClick={()=>{setSelectedBrands([]);setPage(1);}}>همه برندها</button>
          </section>
          {isClassicBelt && <div className="flex flex-wrap items-center justify-center gap-2" dir="ltr">
            {['all',...beltProfiles].map(profile=><button type="button" key={profile} aria-pressed={selectedProfile===profile} onClick={()=>{setSelectedProfile(profile);setPage(1);}}
              className={`h-10 min-w-10 rounded-full px-3 text-xs font-bold ${selectedProfile===profile?'bg-[#E06518] text-white':'bg-[#f2f3f5] text-slate-700 hover:bg-orange-50'}`}>{profile==='all'?'همه':profile}</button>)}
          </div>}
        </>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-10 text-[#23262B] shadow-sm">
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-[11px] font-extrabold text-[#c85612]">
                  <Layers className="w-3.5 h-3.5 text-[#E56B1E]" />
                  <span>کاتالوگ تخصصی صنعت پیش</span>
                  {category.nameEn && <span dir="ltr" className="text-slate-500">· {category.nameEn}</span>}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#23262B]">{category.name}</h1>
                <p className="text-xs sm:text-sm text-[#55565A] leading-7">
                  {category.description || 'بررسی مشخصات فنی، زیرشاخه‌های تخصصی، برندهای معتبر و استعلام مستقیم از کاتالوگ صنعت پیش.'}
                </p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-[11px] font-bold text-slate-700">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#E56B1E]" /> تنوع سایز و کد فنی</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[#E56B1E]" /> تضمین اصالت و استاندارد</span>
                  <span className="flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5 text-[#E56B1E]" /> مشاوره فنی تخصصی</span>
                  <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-[#E56B1E]" /> تأمین مستقیم خطوط تولید</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => scrollToSectionElement(productsSectionRef.current, { behavior: 'smooth' })}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#E56B1E] hover:bg-[#c95612] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors"
                  >
                    مشاهده فهرست کالاها
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <Link
                    to="/ai-consult"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] hover:border-[#E56B1E] hover:text-[#E56B1E] px-4 py-2.5 text-xs font-extrabold text-[#55565A] transition-colors"
                  >
                    مشاوره فنی FORZA
                    <Sparkles className="w-3.5 h-3.5 text-[#E56B1E]" />
                  </Link>
                  <Link
                    to="/identify-part"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:border-[#E56B1E] hover:text-[#E56B1E] px-3.5 py-2.5 text-xs font-bold text-[#55565A] transition-colors"
                  >
                    شناسایی با تصویر
                    <Camera className="w-3.5 h-3.5 text-[#E56B1E]" />
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-4 self-start lg:self-center">
                <div className="grid grid-cols-3 gap-2.5 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5">
                  <div className="px-2.5 text-center border-l border-slate-200">
                    <div className="text-lg md:text-xl font-black text-[#E56B1E]">{toPersianDigits(categoryProducts.length)}</div>
                    <div className="text-[10px] font-bold text-slate-500">کالا / خانواده</div>
                  </div>
                  <div className="px-2.5 text-center border-l border-slate-200">
                    <div className="text-lg md:text-xl font-black text-[#23262B]">{toPersianDigits(visualSubcategories.length)}</div>
                    <div className="text-[10px] font-bold text-slate-500">زیرگروه</div>
                  </div>
                  <div className="px-2.5 text-center">
                    <div className="text-lg md:text-xl font-black text-emerald-700">{toPersianDigits(availableBrands.length)}</div>
                    <div className="text-[10px] font-bold text-slate-500">برند ثبت‌شده</div>
                  </div>
                </div>
                {category.image && (
                  <img
                    src={category.image}
                    alt={category.name}
                    className="hidden sm:block w-28 h-28 md:w-36 md:h-32 rounded-2xl object-contain border border-slate-200 bg-[#F8FAFC] p-3 shrink-0 shadow-xs"
                  />
                )}
              </div>
            </div>
          </section>

          {visualSubcategories.length > 0 && (
            <section className="space-y-3" aria-label="زیرگروه‌های تصویری">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <span className="text-[11px] font-black text-[#E06518]">انتخاب سریع زیرشاخه</span>
                  <h2 className="text-sm sm:text-base font-black text-slate-800">زیرگروه‌های تخصصی {category.name}</h2>
                </div>
                {selectedSubcat !== 'all' && (
                  <button
                    type="button"
                    onClick={() => selectSubcategory('all')}
                    className="text-xs font-extrabold text-[#E06518] hover:underline"
                  >
                    نمایش همه زیرگروه‌ها
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visualSubcategories.map(sub => {
                  const active = selectedSubcat === sub.value || selectedSubcat === sub.name;
                  return (
                    <button
                      type="button"
                      key={sub.value}
                      aria-pressed={active}
                      onClick={() => selectSubcategory(active ? 'all' : sub.value)}
                      className={`group flex items-center justify-between gap-3 rounded-2xl border p-3 text-right transition-all ${
                        active
                          ? 'border-[#E06518] bg-orange-50/90 text-[#E06518] shadow-xs'
                          : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-xs font-black text-slate-800 group-hover:text-[#E06518]">
                          {sub.name}
                        </strong>
                        <span className="mt-1 inline-block text-[10px] font-bold text-slate-500">
                          {sub.count > 0 ? `${toPersianDigits(sub.count)} کالا در کاتالوگ` : 'مشاهده زیرگروه'}
                        </span>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-1">
                        {sub.image ? (
                          <img src={sub.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                        ) : (
                          <Layers className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {availableBrands.length > 0 && (
            <section className="category-brand-ribbon" aria-label="برندهای موجود در کاتالوگ">
              <strong>فیلتر سریع برندهای این دسته</strong>
              <div>
                {availableBrands.slice(0, 10).map(brand => (
                  <button
                    key={brand}
                    type="button"
                    aria-pressed={selectedBrands.includes(brand)}
                    onClick={() => {
                      setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [brand]);
                      setPage(1);
                      scrollToSectionElement(productsSectionRef.current, { behavior: 'smooth' });
                    }}
                  >
                    {brand}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setSelectedBrands([]); setSelectedBrand('all'); setPage(1); }}>
                همه برندها
              </button>
            </section>
          )}
        </>
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
                  <span>{brand} <span className="text-slate-400">({toPersianDigits(brandFacetProducts.filter(p=>productHasDisplayBrand(p,brand)).length)})</span></span>
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
          <div className="category-product-headline"><div><strong>انتخاب قطعات {category.name}</strong><p>اطلاعات فنی و تصاویر برگرفته از کاتالوگ صنعت پیش</p></div><span>{toPersianDigits(filteredProducts.length)} کالای مرتبط</span></div>
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
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-2 bg-[#E06518] hover:bg-[#C95210] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>پاکسازی همه فیلترها</span>
                  </button>
                )}
                <Link
                  to="/ai-consult"
                  className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E06518]" />
                  <span>استعلام فنی از مهندسان</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="category-showcase-products grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginated.map(product => {
                  const isCompared = compareCodes.includes(product.code);
                  return isBeltCategory ? (
                    <article key={product.code} className="category-premium-card flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                      <Link to={directSkuCodes.has(product.code) ? `/direct-product/${encodeURIComponent(product.code)}` : `/product/${encodeURIComponent(product.code)}`} className="category-showcase-product-media flex h-52 items-center justify-center rounded-lg bg-[#fafafa]">
                        <ProductImage src={product.images?.[0]} alt={product.name} disableFallback={directSkuCodes.has(product.code)} thumbnail loading="lazy" decoding="async"/>
                      </Link>
                      <div className="category-sku-head"><strong dir="ltr">{product.code}</strong>{(resolveDisplayBrand(product.brand, product.name) || getProductDisplayBrands(product)[0]) && <span dir="ltr">{resolveDisplayBrand(product.brand, product.name) || getProductDisplayBrands(product)[0]}</span>}</div>
                      <Link to={directSkuCodes.has(product.code) ? `/direct-product/${encodeURIComponent(product.code)}` : `/product/${encodeURIComponent(product.code)}`} className="category-sku-title">{product.name}</Link>
                      <p className="category-sku-family"><Layers size={13}/>{product.subcategory}</p>
                      <dl className="category-sku-specs">
                        {(product.technicalSpecs || []).filter(spec => spec.key && spec.value).slice(0,2).map(spec=><div key={spec.key}><dt>{spec.key}</dt><dd>{spec.value}</dd></div>)}
                        {!product.technicalSpecs?.length && <div><dt>دسته</dt><dd>{product.subcategory}</dd></div>}
                      </dl>
                      <div className="category-sku-status"><span className={product.stockKnown && product.stock > 0 ? 'available' : 'unconfirmed'}></span>{product.stockKnown && product.stock > 0 ? 'موجودی ثبت‌شده' : 'استعلام موجودی و قیمت'}</div>
                      <div className="category-sku-actions">
                        <Link to={directSkuCodes.has(product.code) ? `/direct-product/${encodeURIComponent(product.code)}` : `/product/${encodeURIComponent(product.code)}`} className="category-sku-cta">جزئیات و استعلام <ChevronLeft size={17}/></Link>
                        <button
                          type="button"
                          aria-pressed={isCompared}
                          onClick={() => toggleCompareProduct(product.code)}
                          title="افزودن به مقایسه فنی"
                          className={`category-sku-secondary ${isCompared ? 'border-[#E06518] bg-orange-50 text-[#E06518]' : ''}`}
                        >
                          {isCompared ? <Check size={16} /> : <Ruler size={16} />}
                        </button>
                      </div>
                    </article>
                  ) : (
                    <div key={product.code} className="relative flex flex-col">
                      <ProductCard product={product} detailPath={directSkuCodes.has(product.code) ? `/direct-product/${encodeURIComponent(product.code)}` : undefined} disableSiteFallback={directSkuCodes.has(product.code)}/>
                      <button
                        type="button"
                        aria-pressed={isCompared}
                        onClick={() => toggleCompareProduct(product.code)}
                        className={`mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-xl border py-1.5 px-3 text-[11px] font-bold transition-colors ${
                          isCompared
                            ? 'border-[#E06518] bg-orange-50 text-[#E06518]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-[#E06518]'
                        }`}
                      >
                        {isCompared ? <Check className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>{isCompared ? 'انتخاب‌شده برای مقایسه' : 'افزودن به مقایسه فنی'}</span>
                      </button>
                    </div>
                  );
                })}
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

      {/* Floating Compare Dock */}
      {comparedProducts.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-4xl rounded-2xl border border-orange-200 bg-[#23272c]/95 p-3.5 text-white shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#E06518] px-2.5 py-1 text-xs font-black">
              {toPersianDigits(comparedProducts.length)} کالا برای مقایسه
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {comparedProducts.map(item => (
                <span key={item.code} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold">
                  <span dir="ltr">{item.code}</span>
                  <button
                    type="button"
                    onClick={() => toggleCompareProduct(item.code)}
                    aria-label={`حذف ${item.code} از مقایسه`}
                    className="text-slate-300 hover:text-white"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompareCodes([])}
              className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10"
            >
              پاک کردن
            </button>
            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="rounded-xl bg-[#E06518] hover:bg-[#c95512] px-4 py-1.5 text-xs font-black text-white shadow-sm"
            >
              مشاهده جدول مقایسه فنی
            </button>
          </div>
        </div>
      )}

      {/* Technical Comparison Modal */}
      {compareModalOpen && comparedProducts.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onMouseDown={() => setCompareModalOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="جدول مقایسه فنی محصولات"
            onMouseDown={e => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-[#E06518]">مقایسه مشخصات کاتالوگ</span>
                <h3 className="text-base font-black text-slate-800">مقایسه فنی کالاهای انتخاب‌شده ({toPersianDigits(comparedProducts.length)})</h3>
              </div>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                بستن ✕
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="p-3 font-black text-slate-600 w-40">مشخصه</th>
                    {comparedProducts.map(item => (
                      <th key={item.code} className="p-3 font-black text-slate-800">
                        <div className="flex flex-col gap-1.5">
                          <span dir="ltr" className="text-[#E06518] font-mono text-xs">{item.code}</span>
                          <Link to={`/product/${encodeURIComponent(item.code)}`} className="hover:underline line-clamp-2">
                            {item.name}
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-bold text-slate-500">برند سازنده</td>
                    {comparedProducts.map(item => (
                      <td key={item.code} className="p-3 font-bold text-slate-800">{item.brand || '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-500">زیرگروه</td>
                    {comparedProducts.map(item => (
                      <td key={item.code} className="p-3 text-slate-700">{item.subcategory || '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-500">وضعیت تأمین</td>
                    {comparedProducts.map(item => (
                      <td key={item.code} className="p-3 font-bold">
                        {item.stockKnown && item.stock > 0 && !item.inquiryOnly ? (
                          <span className="text-emerald-700">موجودی ثبت‌شده ({toPersianDigits(item.stock)})</span>
                        ) : (
                          <span className="text-amber-700">استعلام موجودی و قیمت</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {comparedSpecKeys.map(specKey => (
                    <tr key={specKey}>
                      <td className="p-3 font-bold text-slate-500">{specKey}</td>
                      {comparedProducts.map(item => {
                        const found = (item.technicalSpecs || []).find(s => s.key === specKey);
                        return (
                          <td key={item.code} className="p-3 text-slate-700 font-medium">
                            {found?.value || '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

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
              {[
                {name:'کاشی و سرامیک',image:STORE_ASSETS.industries.ceramic,path:'/industries/ceramic',description:'انتقال نیرو در خطوط تولید'},
                {name:'نساجی و پارچه',image:STORE_ASSETS.industries.textile,path:'/industries/textile',description:'تجهیزات بافندگی و ریسندگی'},
                {name:'بسته‌بندی و کارتن‌سازی',image:STORE_ASSETS.industries.manufacturing,path:'/industries/packaging',description:'ماشین‌آلات بسته‌بندی'},
                {name:'غذایی و نوشیدنی',image:STORE_ASSETS.industries.foodBottles,path:'/industries/food',description:'خطوط تولید مواد غذایی'},
              ].map(item=><Link key={item.name} to={item.path} className="category-industry-tile">
                <img src={item.image} loading="lazy" alt={item.name}/><div><strong>{item.name}</strong><small>{item.description}</small><ChevronLeft size={22}/></div>
              </Link>)}
            </div>
          </section>
          <div className="category-showcase-actions grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link to="/identify-part" className="category-action-scan rounded-xl bg-orange-50 p-5 hover:bg-orange-100"><img src={STORE_ASSETS.aiSearchMobile} alt="" loading="lazy"/><div className="flex items-center gap-3"><Camera className="text-[#E06518]"/><strong>شناسایی قطعه با تصویر</strong></div><p className="mt-2 text-xs text-slate-600">با ارسال تصویر، قطعه صنعتی خود را شناسایی کنید.</p></Link>
            <Link to="/ai-consult" className="category-action-consult rounded-xl bg-slate-100 p-5 hover:bg-slate-200"><img src={STORE_ASSETS.aiConsultRobot} alt="" loading="lazy"/><div className="flex items-center gap-3"><MessageCircle className="text-[#E06518]"/><strong>مشاوره هوشمند</strong></div><p className="mt-2 text-xs text-slate-600">برای انتخاب تسمه مناسب راهنمایی بگیرید.</p></Link>
          </div>
        </>
      )}
    </div>
  );
};
