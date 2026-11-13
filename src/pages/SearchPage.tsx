import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  searchProducts,
  subscribeCatalogChanges,
} from '../data/mockGenerator';
import { getManagedCategories } from '../data/categories';
import { ProductCard } from '../components/product/ProductCard';
import { ProductImage } from '../components/product/ProductImage';
import { useDirectSkus } from '../components/catalog/DirectSkuProducts';
import {
  Search,
  ChevronLeft,
  SlidersHorizontal,
  X,
  ArrowUpLeft,
  Camera,
  Sparkles,
  Layers,
  LayoutGrid,
  List,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw,
  Package,
  Filter,
} from 'lucide-react';
import { toPersianDigits } from '../utils/formatters';

const POPULAR_TERMS = [
  'تسمه تایمینگ',
  'بلبرینگ',
  'پولی چدنی',
  'رولیک سرامیکی',
  'زنجیر صنعتی',
  'کوپلینگ',
  'AT-E001',
  'کاسه نمد',
];

type SortMode = 'relevance' | 'code_asc' | 'name_asc' | 'stock_desc';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || 'all';
  const brandParam = searchParams.get('brand') || 'all';

  const [localQuery, setLocalQuery] = useState(queryParam);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedBrand, setSelectedBrand] = useState<string>(brandParam);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyWithImage, setOnlyWithImage] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>('relevance');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [catalogVersion, setCatalogVersion] = useState(0);

  const directSkus = useDirectSkus();

  useEffect(() => {
    setLocalQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setSelectedCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    setSelectedBrand(brandParam);
  }, [brandParam]);

  useEffect(() => {
    return subscribeCatalogChanges(() => {
      setCatalogVersion(v => v + 1);
    });
  }, []);

  const categories = useMemo(() => {
    void catalogVersion;
    return getManagedCategories();
  }, [catalogVersion]);

  const rawResults = useMemo(() => {
    void catalogVersion;
    return searchProducts(queryParam, 240);
  }, [queryParam, catalogVersion]);

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rawResults) {
      const brand = (item.brand || '').trim();
      if (!brand) continue;
      counts.set(brand, (counts.get(brand) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([brand, count]) => ({ brand, count }));
  }, [rawResults]);

  const filteredResults = useMemo(() => {
    const list = rawResults.filter(product => {
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }
      if (selectedBrand !== 'all' && product.brand !== selectedBrand) {
        return false;
      }
      if (onlyInStock && !(product.stockKnown === true && product.stock > 0 && !product.inquiryOnly)) {
        return false;
      }
      if (onlyWithImage && !product.hasCatalogueImage) {
        return false;
      }
      return true;
    });

    if (sortBy === 'code_asc') {
      return [...list].sort((a, b) => a.code.localeCompare(b.code, 'en'));
    }
    if (sortBy === 'name_asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    }
    if (sortBy === 'stock_desc') {
      return [...list].sort((a, b) => {
        const aStock = a.stockKnown && !a.inquiryOnly ? a.stock : -1;
        const bStock = b.stockKnown && !b.inquiryOnly ? b.stock : -1;
        return bStock - aStock;
      });
    }
    return list;
  }, [rawResults, selectedCategory, selectedBrand, onlyInStock, onlyWithImage, sortBy]);

  const matchingDirectSkus = useMemo(() => {
    const q = queryParam.trim().toLowerCase();
    if (!q) return [];
    return directSkus
      .filter(item => {
        if (selectedCategory !== 'all' && item.categorySlug !== selectedCategory) {
          return false;
        }
        if (selectedBrand !== 'all' && item.brand !== selectedBrand) {
          return false;
        }
        if (onlyWithImage && !item.imageUrl) {
          return false;
        }
        const specText = (item.technicalSpecs || [])
          .map(s => `${s.key} ${s.value}`)
          .join(' ');
        const haystack = [
          item.skuCode,
          item.name,
          item.categoryName,
          item.submenu,
          item.subcategory,
          item.brand,
          specText,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 24);
  }, [directSkus, queryParam, selectedCategory, selectedBrand, onlyWithImage]);

  const updateQueryParam = (nextQuery: string, nextCat = selectedCategory, nextBrand = selectedBrand) => {
    const params: Record<string, string> = {};
    if (nextQuery.trim()) params.q = nextQuery.trim();
    if (nextCat !== 'all') params.category = nextCat;
    if (nextBrand !== 'all') params.brand = nextBrand;
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateQueryParam(localQuery);
  };

  const handleQuickTerm = (term: string) => {
    setLocalQuery(term);
    updateQueryParam(term);
  };

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSelectedBrand('all');
    setOnlyInStock(false);
    setOnlyWithImage(false);
    setSortBy('relevance');
    const params: Record<string, string> = {};
    if (queryParam.trim()) params.q = queryParam.trim();
    setSearchParams(params);
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    selectedBrand !== 'all' ||
    onlyInStock ||
    onlyWithImage ||
    sortBy !== 'relevance';

  const totalCombinedCount = filteredResults.length + matchingDirectSkus.length;

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return categories.find(c => c.slug === selectedCategory)?.name || selectedCategory;
  }, [categories, selectedCategory]);

  return (
    <div className="space-y-6 bg-white pb-12" dir="rtl">
      {/* Breadcrumb */}
      <nav
        aria-label="مسیر راهنما"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#CBD2D8]/80 bg-white/90 px-4 py-2.5 text-xs text-[#777A7D] shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Link to="/" className="font-semibold text-[#55565A] transition-colors hover:text-[#E06518]">
            صفحه اصلی
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
          <Link to="/products" className="font-semibold text-[#55565A] transition-colors hover:text-[#E06518]">
            کاتالوگ قطعات
          </Link>
          <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-bold text-[#23262B]">جستجوی فنی و مهندسی</span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <Link
            to="/categories"
            className="inline-flex items-center gap-1 font-bold text-[#55565A] transition-colors hover:text-[#E06518]"
          >
            <Layers className="h-3.5 w-3.5 text-[#E06518]" />
            مرور دسته‌بندی‌ها
          </Link>
          <span className="text-slate-300">|</span>
          <Link
            to="/identify-part"
            className="inline-flex items-center gap-1 font-bold text-[#E06518] transition-colors hover:text-[#C95210]"
          >
            <Camera className="h-3.5 w-3.5" />
            شناسایی قطعه با تصویر
          </Link>
        </div>
      </nav>

      {/* Industrial Search Command Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-[#23262B] shadow-sm md:p-8">
        <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1 text-[11px] font-extrabold text-[#c85612]">
              <Search className="h-3.5 w-3.5 text-[#E56B1E]" />
              موتور جستجوی فنی کاتالوگ صنعت پیش
            </div>

            <h1 className="text-xl font-black tracking-tight text-[#23262B] md:text-2xl">
              {queryParam ? (
                <>
                  نتایج جستجوی فنی برای{' '}
                  <span className="text-[#E56B1E]">«{queryParam}»</span>
                </>
              ) : (
                'جستجوی دقیق قطعات صنعتی بر اساس کد فنی، استاندارد، سایز یا برند'
              )}
            </h1>

            <form onSubmit={handleSearch} className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={localQuery}
                  onChange={e => setLocalQuery(e.target.value)}
                  placeholder="کد فنی (مانند AT-E045 یا 1800001001)، نام قطعه، استاندارد یا برند..."
                  aria-label="عبارت جستجوی فنی"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] pr-11 pl-10 text-sm font-medium text-[#23262B] placeholder:text-slate-400 focus:border-[#E56B1E] focus:bg-white focus:outline-none"
                />
                {localQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalQuery('');
                      updateQueryParam('');
                    }}
                    aria-label="پاک کردن عبارت جستجو"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-7 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#C95210] cursor-pointer"
              >
                <Search className="h-4 w-4" />
                جستجوی کاتالوگ
              </button>
            </form>

            {/* Quick Suggested Search Terms */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-[#55565A] ml-1">
                جستجوهای پرتکرار صنعتی:
              </span>
              {POPULAR_TERMS.map(term => {
                const isActive = queryParam.trim() === term;
                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleQuickTerm(term)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'border-[#E56B1E] bg-[#E56B1E] text-white'
                        : 'border-slate-200 bg-[#F8FAFC] text-[#55565A] hover:border-[#E56B1E] hover:text-[#E56B1E]'
                    }`}
                  >
                    {term}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Metrics Card */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 lg:col-span-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-bold text-slate-500">کل نتایج منطبق</div>
              <div className="mt-1 font-mono text-2xl font-black text-[#E56B1E]">
                {toPersianDigits(totalCombinedCount)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">خانواده و ردیف کالایی</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-bold text-slate-500">خانواده‌های محصول</div>
              <div className="mt-1 font-mono text-2xl font-black text-[#23262B]">
                {toPersianDigits(filteredResults.length)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">در کاتالوگ اصلی</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-bold text-slate-500">ردیف‌های مستقیم SKU</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-emerald-700">
                {toPersianDigits(matchingDirectSkus.length)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-bold text-slate-500">برندهای مرتبط</div>
              <div className="mt-1 font-mono text-lg font-extrabold text-[#55565A]">
                {toPersianDigits(availableBrands.length)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Sort Control Bar */}
      <section className="rounded-2xl border border-[#CBD2D8] bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#23262B]">
              <SlidersHorizontal className="h-4 w-4 text-[#E06518]" />
              پالایش نتایج:
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={e => {
                const val = e.target.value;
                setSelectedCategory(val);
                updateQueryParam(localQuery, val, selectedBrand);
              }}
              aria-label="فیلتر بر اساس دسته‌بندی"
              className="h-9 rounded-lg border border-[#CBD2D8] bg-[#F8FAFC] px-3 text-xs font-bold text-[#23262B] focus:border-[#E06518] focus:outline-none"
            >
              <option value="all">همه گروه‌های صنعتی ({toPersianDigits(categories.length)})</option>
              {categories.map(cat => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Brand Select */}
            <select
              value={selectedBrand}
              onChange={e => {
                const val = e.target.value;
                setSelectedBrand(val);
                updateQueryParam(localQuery, selectedCategory, val);
              }}
              aria-label="فیلتر بر اساس برند"
              className="h-9 rounded-lg border border-[#CBD2D8] bg-[#F8FAFC] px-3 text-xs font-bold text-[#23262B] focus:border-[#E06518] focus:outline-none"
            >
              <option value="all">همه برندها ({toPersianDigits(availableBrands.length)})</option>
              {availableBrands.map(item => (
                <option key={item.brand} value={item.brand}>
                  {item.brand} ({toPersianDigits(item.count)})
                </option>
              ))}
            </select>

            {/* Quick Toggles */}
            <button
              type="button"
              onClick={() => setOnlyInStock(prev => !prev)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors cursor-pointer ${
                onlyInStock
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-[#CBD2D8] bg-white text-[#55565A] hover:border-slate-400'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              فقط موجودی قطعی
            </button>

            <button
              type="button"
              onClick={() => setOnlyWithImage(prev => !prev)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors cursor-pointer ${
                onlyWithImage
                  ? 'border-[#E06518] bg-[#FFF5EE] text-[#C95210]'
                  : 'border-[#CBD2D8] bg-white text-[#55565A] hover:border-slate-400'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              دارای تصویر کاتالوگ
            </button>
          </div>

          {/* Sort & View Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-bold text-[#777A7D]" htmlFor="search-sort-select">
              مرتب‌سازی:
            </label>
            <select
              id="search-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortMode)}
              className="h-9 rounded-lg border border-[#CBD2D8] bg-[#F8FAFC] px-3 text-xs font-bold text-[#23262B] focus:border-[#E06518] focus:outline-none"
            >
              <option value="relevance">مرتبط‌ترین نتیجه</option>
              <option value="code_asc">کد فنی (صعودی)</option>
              <option value="name_asc">نام قطعه (الفبایی)</option>
              <option value="stock_desc">بیشترین موجودی</option>
            </select>

            <div className="inline-flex rounded-lg border border-[#CBD2D8] bg-[#F8FAFC] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-label="نمایش شبکه‌ای"
                className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#23262B] text-white'
                    : 'text-[#55565A] hover:text-[#23262B]'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="نمایش فهرستی"
                className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#23262B] text-white'
                    : 'text-[#55565A] hover:text-[#23262B]'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 font-bold text-[#777A7D]">
                <Filter className="h-3.5 w-3.5 text-[#E06518]" />
                فیلترهای فعال:
              </span>

              {selectedCategoryName && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    updateQueryParam(localQuery, 'all', selectedBrand);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-[#23262B] hover:border-red-300 hover:bg-red-50 cursor-pointer"
                >
                  دسته: {selectedCategoryName}
                  <X className="h-3 w-3 text-slate-500" />
                </button>
              )}

              {selectedBrand !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBrand('all');
                    updateQueryParam(localQuery, selectedCategory, 'all');
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-[#23262B] hover:border-red-300 hover:bg-red-50 cursor-pointer"
                >
                  برند: {selectedBrand}
                  <X className="h-3 w-3 text-slate-500" />
                </button>
              )}

              {onlyInStock && (
                <button
                  type="button"
                  onClick={() => setOnlyInStock(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 cursor-pointer"
                >
                  فقط موجودی قطعی
                  <X className="h-3 w-3" />
                </button>
              )}

              {onlyWithImage && (
                <button
                  type="button"
                  onClick={() => setOnlyWithImage(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-[#E06518]/40 bg-[#FFF5EE] px-2.5 py-1 text-[11px] font-bold text-[#C95210] cursor-pointer"
                >
                  دارای تصویر کاتالوگ
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#E06518] hover:text-[#C95210] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              حذف همه فیلترها
            </button>
          </div>
        )}
      </section>

      {/* Main Results Area */}
      {totalCombinedCount === 0 ? (
        <div className="rounded-2xl border border-[#CBD2D8] bg-white p-8 md:p-12 shadow-xs">
          <div className="mx-auto max-w-2xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF5EE] text-[#E06518] border border-[#E06518]/25">
              <Search className="h-7 w-7" />
            </div>

            <h2 className="text-lg font-black text-[#23262B]">
              کالایی مطابق با عبارت «{queryParam || 'فیلترهای انتخابی'}» یافت نشد
            </h2>

            <p className="text-xs leading-6 text-[#55565A]">
              پیشنهاد می‌کنیم املای کد فنی (مانند{' '}
              <span className="font-mono font-bold text-[#23262B]">AT-E001</span> یا{' '}
              <span className="font-mono font-bold text-[#23262B]">AT-E045</span>) را بررسی کنید، فیلترهای محدودکننده را بردارید یا از دستیار مهندسی و شناسایی تصویری قطعه کمک بگیرید.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E06518] px-5 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-[#C95210] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  بازنشانی فیلترهای جستجو
                </button>
              )}

              <Link
                to="/identify-part"
                className="inline-flex items-center gap-2 rounded-xl border border-[#CBD2D8] bg-[#F8FAFC] px-4 py-2.5 text-xs font-extrabold text-[#23262B] transition-colors hover:border-[#E06518] hover:text-[#E06518]"
              >
                <Camera className="h-4 w-4 text-[#E06518]" />
                شناسایی قطعه با عکس
              </Link>

              <Link
                to="/ai-consult"
                className="inline-flex items-center gap-2 rounded-xl border border-[#CBD2D8] bg-[#F8FAFC] px-4 py-2.5 text-xs font-extrabold text-[#23262B] transition-colors hover:border-[#E06518] hover:text-[#E06518]"
              >
                <Sparkles className="h-4 w-4 text-[#E06518]" />
                مشاوره فنی AI FORZA
              </Link>
            </div>
          </div>

          {/* Suggested Categories */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="mb-3 text-center text-xs font-extrabold text-[#55565A]">
              دسته‌بندی‌های اصلی کاتالوگ صنعت پیش:
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {categories.slice(0, 12).map(cat => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-bold text-[#23262B] transition-all hover:border-[#E06518] hover:bg-[#FFF5EE] hover:text-[#E06518]"
                >
                  <span className="truncate">{cat.name}</span>
                  <ArrowUpLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Family / Catalogue Products */}
          {filteredResults.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#CBD2D8] pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#E06518]" />
                  <h2 className="text-base font-black text-[#23262B]">
                    خانواده‌ها و قطعات کاتالوگ اصلی
                  </h2>
                </div>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-[#55565A]">
                  {toPersianDigits(filteredResults.length)} مورد
                </span>
              </div>

              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                    : 'grid grid-cols-1 gap-3 md:grid-cols-2'
                }
              >
                {filteredResults.map(product => (
                  <ProductCard key={product.code} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* Direct SKU Results */}
          {matchingDirectSkus.length > 0 && (
            <section className="space-y-4 rounded-2xl border border-[#CBD2D8] bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-[#23262B]">
                    ردیف‌های مستقیم کالایی (SKU) منطبق با جستجو
                  </h2>
                  <p className="text-xs text-[#777A7D]">
                    قطعات و سایزهای تفکیک‌شده از بانک جامع کالاهای صنعتی
                  </p>
                </div>
                <span className="rounded-lg bg-[#FFF5EE] border border-[#E06518]/30 px-3 py-1 font-mono text-xs font-extrabold text-[#C95210]">
                  {toPersianDigits(matchingDirectSkus.length)} ردیف کالا
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matchingDirectSkus.map(sku => (
                  <Link
                    key={sku.skuCode}
                    to={`/direct-product/${encodeURIComponent(sku.skuCode)}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 transition-all hover:border-[#E06518] hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                      {sku.imageUrl ? (
                        <ProductImage
                          src={sku.imageUrl}
                          alt={sku.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#E06518]">
                          {sku.skuCode}
                        </span>
                        {sku.brand && (
                          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-[#55565A]">
                            {sku.brand}
                          </span>
                        )}
                      </div>
                      <h3 className="truncate text-xs font-extrabold text-[#23262B] group-hover:text-[#E06518]">
                        {sku.name}
                      </h3>
                      <div className="flex items-center justify-between text-[11px] text-[#777A7D]">
                        <span className="truncate">
                          {sku.categoryName}
                          {sku.subcategory || sku.submenu ? ` / ${sku.subcategory || sku.submenu}` : ''}
                        </span>
                        <ArrowUpLeft className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#E06518]" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};


