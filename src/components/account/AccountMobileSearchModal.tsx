import React, { useState, useMemo } from 'react';
import { Search, X, QrCode, ArrowRight, Package, TrendingUp, ShoppingBag, Check } from 'lucide-react';
import { generateMockProducts } from '../../data/mockGenerator';
import { toPersianDigits, formatPrice } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { Product } from '../../types';

interface AccountMobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
}

export const AccountMobileSearchModal: React.FC<AccountMobileSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');
  const [addedCode, setAddedCode] = useState<string | null>(null);
  const { addToCart } = useCart();

  const allProducts = useMemo(() => generateMockProducts(), []);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) {
      return allProducts.slice(0, 8); // default fast movers
    }
    const q = query.toLowerCase().trim();
    return allProducts.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.categoryName || p.category || '').toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [query, allProducts]);

  if (!isOpen) return null;

  const handleAdd = (product: Product) => {
    addToCart(product, 1);
    setAddedCode(product.code);
    setTimeout(() => setAddedCode(null), 2000);
  };

  const quickTags = [
    'تسمه B-52',
    'بلبرینگ 6204',
    'پولی آلومینیومی',
    'فیتینگ هیدرولیک',
    'زنجیر غلطکی',
    'یاتاقان UCP',
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-md">
      <div className="flex-1 flex flex-col bg-[#131822] text-slate-200 rounded-t-3xl sm:rounded-3xl mt-12 sm:mt-auto sm:mb-auto sm:max-w-lg sm:mx-auto sm:h-[85vh] w-full overflow-hidden shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-8 duration-200">
        {/* Header with Search Bar */}
        <div className="bg-[#161B26]/95 backdrop-blur-xl p-4 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-[#FB923C] flex items-center justify-center font-bold">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white">استعلام سریع قطعه و بارکد</h3>
                <p className="text-[10px] text-slate-400">مخصوص استعلام آنی پشت دخل فروشگاه</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="کد فنی قطعه، شماره تسمه یا بلبرینگ (مثلا B-52)..."
              className="w-full pr-10 pl-10 py-3 bg-slate-900/80 focus:bg-slate-900 border border-white/15 focus:border-[#E06518] rounded-2xl text-xs font-bold text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute left-3.5 top-3 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Tags Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-[10px] text-slate-400 font-bold shrink-0">جستجوهای متداول:</span>
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(tag)}
                className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-orange-500/20 hover:text-[#FB923C] text-slate-300 text-[10px] font-bold border border-white/10 shrink-0 transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          <div className="text-[11px] font-bold text-slate-400 px-1 flex items-center justify-between">
            <span>
              {query.trim() ? `نتایج جستجو (${toPersianDigits(filteredProducts.length)} مورد)` : 'پرفروش‌ترین قطعات آماده ارسال از انبار یزد:'}
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
              انبار مرکزی: موجود
            </span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center space-y-2 bg-[#161B26]/60 rounded-2xl border border-white/10">
              <Package className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs font-bold text-slate-300">قطعه‌ای با این کد یافت نشد.</p>
              <p className="text-[11px] text-slate-500">می‌توانید از طریق پیام فنی استعلام کد سفارشی را ثبت کنید.</p>
            </div>
          ) : (
            filteredProducts.map(prod => {
              const wholesalePrice = prod.prices?.wholesale || prod.prices?.base || 0;
              const msrpPrice = prod.prices?.retail || Math.round(wholesalePrice * 1.35 / 1000) * 1000;
              const margin = Math.max(0, msrpPrice - wholesalePrice);
              const isAdded = addedCode === prod.code;

              return (
                <div
                  key={prod.code}
                  className="p-3 bg-[#161B26]/90 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-orange-500/30 shadow-sm space-y-2 text-right transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white truncate">{prod.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-200 font-bold shrink-0 border border-white/10">
                          {prod.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        {prod.categoryName || prod.category || prod.subcategory} • برند: {prod.brand || 'اطلس فورزا'}
                      </p>
                    </div>

                    <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full shrink-0">
                      موجود انبار یزد
                    </span>
                  </div>

                  {/* Dual Pricing for Countertop */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2 rounded-xl text-center border border-white/10">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-semibold">قیمت خرید همکار:</span>
                      <span className="text-xs font-black text-white font-mono">
                        {formatPrice(wholesalePrice)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-[#FB923C] block font-semibold">قیمت مصرف‌کننده (MSRP):</span>
                      <span className="text-xs font-black text-[#FB923C] font-mono">
                        {formatPrice(msrpPrice)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-emerald-400 block font-semibold">سود شما در هر عدد:</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        {formatPrice(margin)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAdd(prod)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#E06518] hover:bg-[#C95210] text-white shadow-2xs'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>افزوده شد!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>افزودن به سبد مغازه</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#161B26]/95 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            تحویل سریع باربری وطن به مغازه شما (۲۴ ساعته)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
