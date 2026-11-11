import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchProducts } from '../data/mockGenerator';
import { ProductCard } from '../components/product/ProductCard';
import { Search, ChevronLeft } from 'lucide-react';
import { toPersianDigits } from '../utils/formatters';

const MAX_SEARCH_RESULTS = 48;

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const [localQuery, setLocalQuery] = useState(queryParam);
  useEffect(() => setLocalQuery(queryParam), [queryParam]);

  const results = useMemo(() => {
    return searchProducts(queryParam, MAX_SEARCH_RESULTS);
  }, [queryParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchParams({ q: localQuery.trim() });
    }
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-[#777A7D]">
        <Link to="/" className="hover:text-[#E06518]">
          صفحه اصلی
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="text-[#55565A] font-bold">نتایج جستجوی قطعات</span>
      </nav>

      {/* Search Header */}
      <div className="bg-white rounded-[12px] border border-[#CBD2D8] p-6 shadow-sm">
        <form onSubmit={handleSearch} className="max-w-2xl flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              aria-label="جست‌وجو در کاتالوگ قطعات"
              value={localQuery}
              onChange={e => setLocalQuery(e.target.value)}
              placeholder="نام قطعه، کد فنی، برند یا مشخصات فنی را جستجو کنید..."
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
          <div className="font-mono text-left" aria-live="polite">
            {toPersianDigits(results.length)} نتیجه نمایش‌داده‌شده
            {results.length === MAX_SEARCH_RESULTS && <span className="mr-2 text-slate-400">· حداکثر نتایج این صفحه</span>}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {results.length === 0 ? (
        <div className="bg-white rounded-[12px] border border-[#CBD2D8] p-12 text-center text-slate-500 space-y-3">
          <p className="text-base font-bold text-[#55565A]">کالایی مطابق با عبارت جستجو یافت نشد.</p>
          <p className="text-xs">
            نام قطعه، کد فنی، برند یا یکی از مشخصات ثبت‌شده را وارد کنید؛ برای نتیجه دقیق‌تر می‌توانید عبارت جستجو را محدودتر کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map(product => (
            <ProductCard key={product.code} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};
