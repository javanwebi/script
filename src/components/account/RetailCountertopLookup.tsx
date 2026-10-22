import { ProductImage } from '../product/ProductImage';
import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  EyeOff,
  ShoppingBag,
  TrendingUp,
  Percent,
  CheckCircle2,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Clock,
  ExternalLink,
  Plus
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { generateMockProducts } from '../../data/mockGenerator';
import { Product } from '../../types';
import { toPersianDigits, formatPrice } from '../../utils/formatters';

export const RetailCountertopLookup: React.FC = () => {
  const { addToCart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [customerMode, setCustomerMode] = useState(false); // When true: Hides wholesale price, only shows MSRP
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartSuccessFeedback, setCartSuccessFeedback] = useState<string | null>(null);

  // All mock products for fast countertop lookup
  const allProducts = useMemo(() => generateMockProducts(), []);

  // Filtered products based on search (part code, brand, name)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allProducts
      .filter(p =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [allProducts, searchQuery]);

  const activeProduct = selectedProduct || searchResults[0] || allProducts[0];

  // Calculate Retail Margins
  const purchasePrice = activeProduct.prices.wholesale || activeProduct.prices.retail * 0.82;
  const msrpSellingPrice = activeProduct.prices.retail;
  const profitPerItem = msrpSellingPrice - purchasePrice;
  const marginPercent = Math.round((profitPerItem / msrpSellingPrice) * 100);

  const handleAddToCart = () => {
    addToCart(activeProduct, quantity);
    setCartSuccessFeedback(`تعداد ${toPersianDigits(quantity)} ${activeProduct.unit} از «${activeProduct.name}» به سبد سفارش فروشگاه افزوده شد.`);
    setTimeout(() => setCartSuccessFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner - Light Glassmorphic Card */}
      <div className="relative rounded-3xl overflow-hidden border border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-white/85 backdrop-blur-md p-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#E06518] to-orange-400 text-white shadow-md shadow-orange-500/20">
                <Search className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                میز کار استعلام سریع قطعه پشت دخل مغازه (Countertop POS Lookup)
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              هنگام مراجعه مشتری به مغازه، با جستجوی شماره فنی، ابعاد یا برند، موجودی انبار مرکزی، قیمت خرید همکار شما و قیمت مصوب مصرف‌کننده را فوراً بررسی کنید.
            </p>
          </div>

          {/* Toggle: Customer-Facing Presentation Mode */}
          <div className="bg-white/90 border border-slate-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-4 shrink-0 shadow-sm backdrop-blur-sm">
            <div className="text-right">
              <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                {customerMode ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-500" />}
                <span>حالت چرخش مانیتور به سمت مشتری</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {customerMode ? 'قیمت خرید همکار مخفی شد (امن برای مشتری)' : 'قیمت خرید همکار و حاشیه سود نمایان است'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCustomerMode(!customerMode)}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                customerMode
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{customerMode ? 'فعال' : 'غیرفعال'}</span>
            </button>
          </div>
        </div>
      </div>

      {cartSuccessFeedback && (
        <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 font-bold shadow-sm backdrop-blur-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{cartSuccessFeedback}</span>
        </div>
      )}

      {/* Search Input Bar - Light Glass */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] space-y-2.5">
        <label className="block text-xs font-bold text-slate-700 mb-1">
          جستجوی فوری شماره فنی، کد کاتالوگ یا نام قطعه:
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="مثلاً: A-45 ، SPB-2240 ، 6205 ، FORZA-8M-1200 یا پولی..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/90 focus:border-[#E06518] focus:bg-white rounded-2xl text-slate-800 placeholder-slate-400 text-sm font-mono focus:outline-none transition-all shadow-inner"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
          <span className="font-bold text-slate-700">کدهای پرتقاضای بازار ابزار:</span>
          {['A-45', 'B-68', 'SPB-2000', '6205-2RS', 'FORZA-8M-1200', 'پولی دو شیار'].map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setSearchQuery(tag)}
              className="px-2.5 py-1 rounded-xl bg-white hover:bg-orange-50 hover:text-[#E06518] hover:border-orange-300 text-slate-600 border border-slate-200 font-mono transition-all cursor-pointer shadow-2xs"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main Display Grid: Left/Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Search Results Mini-List (4 Cols) */}
        <div className="lg:col-span-4 bg-white/80 backdrop-blur-md rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#E06518]" />
              <span>نتایج سریع ({toPersianDigits(searchResults.length > 0 ? searchResults.length : allProducts.slice(0, 6).length)} کالا)</span>
            </span>
            <span className="text-[10px] text-slate-400">کلیک جهت انتخاب</span>
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {(searchResults.length > 0 ? searchResults : allProducts.slice(0, 6)).map(prod => {
              const isSelected = activeProduct?.code === prod.code;
              return (
                <div
                  key={prod.code}
                  onClick={() => setSelectedProduct(prod)}
                  className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-orange-50/70 border-orange-300 text-slate-800 shadow-sm ring-2 ring-orange-400/20'
                      : 'bg-white/70 border-slate-200/70 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[#E06518]">{prod.code}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                        {prod.brand}
                      </span>
                    </div>
                    <div className="truncate text-slate-700 text-[11px] font-medium">{prod.name}</div>
                  </div>

                  <div className="text-left shrink-0 font-mono font-bold text-xs">
                    {customerMode ? (
                      <span className="text-slate-800 font-bold">{formatPrice(prod.prices.retail)}</span>
                    ) : (
                      <div>
                        <span className="text-emerald-700 block text-[11px] font-bold">
                          {formatPrice(prod.prices.wholesale || prod.prices.retail * 0.82)}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          {formatPrice(prod.prices.retail)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Product Detailed Countertop Card (8 Cols) */}
        {activeProduct && (
          <div className="lg:col-span-8 bg-white/90 backdrop-blur-md rounded-3xl border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start gap-5 border-b border-slate-100 pb-5">
              {/* Product Thumbnail in White Glossy Tile */}
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/80 p-2 flex items-center justify-center shrink-0 relative overflow-hidden group shadow-sm">
                {activeProduct.images[0] ? (
                  <ProductImage
                    src={activeProduct.images[0]}
                    alt={activeProduct.name}
                    className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <Layers className="w-12 h-12 text-slate-300" />
                )}
                <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-white/80 backdrop-blur-xs text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 font-bold">
                  {activeProduct.brand}
                </span>
              </div>

              {/* Product Details */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-base font-black text-[#E06518] bg-orange-50 px-2.5 py-1 rounded-xl border border-orange-200">
                    {activeProduct.code}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                    برند: {activeProduct.brand}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>موجود در انبار مرکزی یزد ({toPersianDigits(activeProduct.stock)} {activeProduct.unit})</span>
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-slate-800 leading-relaxed">
                  {activeProduct.name}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  دسته‌بندی: {activeProduct.categoryName} | زیرگروه: {activeProduct.subcategory}
                </p>

                {/* Technical Specs Tags */}
                {activeProduct.technicalSpecs && activeProduct.technicalSpecs.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                    {activeProduct.technicalSpecs.map(spec => (
                      <span key={spec.key} className="px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                        <strong className="text-slate-500 ml-1">{spec.key}:</strong> {spec.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Price & Margin Calculation Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Customer MSRP Price (Always visible) */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[11px] text-slate-500 font-bold block">
                  قیمت مصوب مصرف‌کننده (MSRP):
                </span>
                <div className="text-xl font-black text-slate-800 font-mono">
                  {formatPrice(msrpSellingPrice)}
                </div>
                <span className="text-[10px] text-slate-400 block">فروش به مشتری نهایی مغازه</span>
              </div>

              {/* Wholesale Cost for Retailer (Hidden in Customer Mode) */}
              <div className={`p-4 rounded-2xl border space-y-1 transition-all ${
                customerMode ? 'bg-slate-100/60 border-slate-200 filter blur-xs select-none' : 'bg-emerald-50/70 border-emerald-200'
              }`}>
                <span className="text-[11px] text-emerald-800 font-bold block">
                  قیمت خرید همکاری شما (پخش):
                </span>
                <div className="text-xl font-black text-emerald-700 font-mono">
                  {customerMode ? '---,--- تومان' : formatPrice(purchasePrice)}
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold block">
                  {customerMode ? 'مخفی در حالت مشتری' : 'با اعمال تخفیف کرید مغازه‌دار'}
                </span>
              </div>

              {/* Retail Margin / Profit per item (Hidden in Customer Mode) */}
              <div className={`p-4 rounded-2xl border space-y-1 transition-all ${
                customerMode ? 'bg-slate-100/60 border-slate-200 filter blur-xs select-none' : 'bg-orange-50/70 border-orange-200'
              }`}>
                <span className="text-[11px] text-[#E06518] font-bold block">
                  سود ناخالص فروشگاه شما:
                </span>
                <div className="text-xl font-black text-[#E06518] font-mono">
                  {customerMode ? '---,---' : `+${formatPrice(profitPerItem)}`}
                </div>
                <span className="text-[10px] text-orange-600 font-bold block">
                  {customerMode ? 'مخفی' : `حاشیه سود: ${toPersianDigits(marginPercent)}٪ برای مغازه`}
                </span>
              </div>
            </div>

            {/* Quick Order Action Toolbar */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-600 shrink-0">تعداد سفارش:</span>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 cursor-pointer font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 text-center text-sm font-mono font-bold bg-transparent text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3.5 py-2 text-slate-600 hover:bg-slate-200 cursor-pointer font-bold"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-slate-500 font-medium">{activeProduct.unit}</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="px-6 py-3 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 transition-all cursor-pointer w-full sm:w-auto"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>ثبت سفارش برای قفسه مغازه ({toPersianDigits(quantity)} {activeProduct.unit})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
