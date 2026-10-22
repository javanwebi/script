import { matchesProductSearch } from '../data/userProducts';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { scrollToSectionElement } from '../components/layout/ScrollToTop';
import { CATEGORIES, findCatalogCategory, matchesCatalogCategory } from '../data/categories';
import { CategoryNavigation } from '../components/catalog/CategoryNavigation';
import { getProductsByCategory } from '../data/mockGenerator';
import { ProductCard } from '../components/product/ProductCard';
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
  Check
} from 'lucide-react';

export const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const category = findCatalogCategory(slug || '') || CATEGORIES[0];
  const [searchParams, setSearchParams] = useSearchParams();
  const subParam = searchParams.get('sub') || 'all';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubcat, setSelectedSubcat] = useState<string>(subParam);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [inquiryOnlyFilter, setInquiryOnlyFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc' | 'code'>('default');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const productsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedSubcat(subParam);
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
  }, [rawData, category.slug, searchQuery, selectedSubcat, selectedBrand, inStockOnly, inquiryOnlyFilter, sortBy]);

  const paginated = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;

  const handleResetFilters = () => {
    setSearchQuery('');
    selectSubcategory('all');
    setSelectedBrand('all');
    setInStockOnly(false);
    setInquiryOnlyFilter(false);
    setSortBy('default');
    setPage(1);
  };

  const hasActiveFilters = searchQuery !== '' || selectedSubcat !== 'all' || selectedBrand !== 'all' || inStockOnly || inquiryOnlyFilter;

  return (
    <div className="space-y-6 text-right pb-12" dir="rtl">
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

      {/* Hero Category Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#484344] via-[#3A3637] to-[#484344] text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-slate-700/60">
        <div className="absolute top-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-slate-500/10 rounded-full blur-2xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>دسته‌بندی تخصصی قطعات صنعتی</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight">
              {category.name}
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm max-w-3xl leading-relaxed">
              {category.description}
            </p>

            {/* Quick Stats Badges */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-white border border-white/10 text-xs font-bold backdrop-blur-sm">
                <Boxes className="w-3.5 h-3.5 text-orange-400" />
                <span>{toPersianDigits(filteredProducts.length)} قلم کالا</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-white border border-white/10 text-xs font-bold backdrop-blur-sm">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
                <span>{toPersianDigits(category.subcategories?.length || 0)} زیرگروه تخصصی</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-white border border-white/10 text-xs font-bold backdrop-blur-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>گارانتی اصالت و سلامت فنی</span>
              </span>
            </div>
          </div>

          {/* Category Image Box Showcase */}
          {category.image && (
            <div className="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 rounded-2xl bg-white/95 p-3.5 border-2 border-white/20 shadow-2xl shrink-0 self-center md:self-auto flex items-center justify-center backdrop-blur-md">
              <img
                src={category.image}
                alt={category.name}
                className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
        </div>
      </div>

      {/* Subcategories Megamenu Selection Showcase */}
      {category.subcategories && category.subcategories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#E06518]" />
              <h2 className="text-sm sm:text-base font-extrabold text-[#484344]">
                زیرگروه‌های تخصصی {category.name}
              </h2>
            </div>
            {selectedSubcat !== 'all' && (
              <button
                onClick={() => {
                  selectSubcategory('all');
                  setPage(1);
                }}
                className="text-xs font-bold text-[#E06518] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>نمایش همه زیرگروه‌ها</span>
              </button>
            )}
          </div>

          <button type="button" onClick={() => selectSubcategory('all')} className="mb-3 px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-[#484344] hover:text-[#E06518]">همه محصولات این دسته</button>
          <CategoryNavigation key={category.slug} nodes={category.children} categorySlug={category.slug} selected={selectedSubcat} onSelect={selectSubcategory} />
        </div>
      )}


      {/* In-Category Search & Sorting Toolbar */}
      <div
        ref={productsSectionRef}
        id="category-products-section"
        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 scroll-mt-24"
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

      {/* Main Content Area: Sidebar Filters + Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters Widget */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4 sticky top-24">
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

            {/* Brand Filter */}
            {availableBrands.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-[#2B313A]">
                  برند تولیدکننده:
                </label>
                <select
                  value={selectedBrand}
                  onChange={e => {
                    setSelectedBrand(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-[#E06518] font-medium"
                >
                  <option value="all">همه برندها ({toPersianDigits(availableBrands.length)})</option>
                  {availableBrands.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginated.map(product => (
                  <ProductCard key={product.code} product={product} />
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
    </div>
  );
};
