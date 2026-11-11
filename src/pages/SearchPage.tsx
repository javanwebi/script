import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchProducts } from '../data/mockGenerator';
import { ProductCard } from '../components/product/ProductCard';
import { DirectSkuProducts, useDirectSkus } from '../components/catalog/DirectSkuProducts';
import { Search, ChevronLeft } from 'lucide-react';
import { toPersianDigits } from '../utils/formatters';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const [localQuery, setLocalQuery] = useState(queryParam);

  const results = useMemo(() => searchProducts(queryParam, 48), [queryParam]);
  const directSkus = useDirectSkus();
  const directSkuResults = useMemo(() => {
    const normalize = (value: string) => value
      .toLocaleLowerCase('fa-IR')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[\u200c\s]+/g, ' ')
      .trim();
    const query = normalize(queryParam);
    return directSkus.filter(item => {
      if (!query) return true;
      const searchable = normalize([
        item.skuCode,
        item.name,
        item.categoryName,
        item.submenu,
        item.subcategory,
        item.brand,
        ...(item.technicalSpecs || []).flatMap(spec => [spec.key, spec.value]),
      ].filter(Boolean).join(' '));
      return searchable.includes(query);
    });
  }, [directSkus, queryParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchParams({ q: localQuery.trim() });
    }
  };

  return (
    <main className="space-y-6" dir="rtl">
      <nav className="flex items-center gap-2 text-xs text-[#777A7D]">
        <Link to="/" className="hover:text-[#E06518]">
          صفحه اصلی
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <Link to="/products" className="hover:text-[#E06518]">همه محصولات</Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="text-[#55565A] font-bold" aria-current="page">نتایج جستجو</span>
      </nav>

      {/* Search Header */}
      <div className="bg-white rounded-[12px] border border-[#CBD2D8] p-6 shadow-sm">
        <form onSubmit={handleSearch} className="max-w-2xl flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={localQuery}
              onChange={e => setLocalQuery(e.target.value)}
              placeholder="جستجو در کاتالوگ با کد فنی، نام، برند یا مشخصات..."
              className="w-full h-11 pr-10 pl-4 bg-slate-50 border border-[#CBD2D8] rounded-xl text-sm focus:outline-none focus:border-[#E06518] text-[#55565A]"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="submit"
            className="px-6 h-11 bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            جستجو
          </button>
        </form>

        <div className="mt-4 text-xs text-[#777A7D] flex items-center justify-between">
          <div>
            نتیجه جستجو برای: <strong className="text-[#55565A]">«{queryParam || 'همه محصولات'}»</strong>
          </div>
          <div className="font-mono">
            {toPersianDigits(results.length + directSkuResults.length)} کالا پیدا شد
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {results.length === 0 && directSkuResults.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#CBD2D8] p-12 text-center text-slate-500 space-y-3">
          <p className="text-base font-bold text-[#55565A]">کالایی مطابق با عبارت جستجو یافت نشد.</p>
          <p className="text-xs">
            کد فنی را بدون فاصله اضافی وارد کنید یا بخشی از نام، برند، دسته‌بندی و مشخصات فنی را جستجو کنید.
          </p>
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <section className="space-y-3" aria-label="خانواده‌های محصول در نتایج جستجو">
              <h2 className="text-sm font-black text-[#55565A]">خانواده‌های محصول</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map(product => (
                  <ProductCard key={product.code} product={product} />
                ))}
              </div>
            </section>
          )}
          {directSkuResults.length > 0 && (
            <DirectSkuProducts
              items={directSkuResults}
              categorySlug="all"
              title="کالاهای مستقیم در نتایج جستجو"
              description="کدهایی که مستقل از خانواده‌های محصول ثبت شده‌اند و با عبارت جستجوی شما تطبیق دارند."
            />
          )}
        </>
      )}
    </main>
  );
};
