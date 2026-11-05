import { ProductImage } from '../product/ProductImage';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Heart,
  ShoppingCart,
  ArrowLeft,
  Check,
  Phone,
  Calculator,
  Wrench,
  Send,
} from 'lucide-react';
import { USER_PRODUCTS } from '../../data/userProducts';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { Modal } from '../ui/Modal';
import { Product } from '../../types';
import type { HomePreviewProduct } from '../../utils/homeCatalogPreview';
import {selectHomePreviewProducts} from '../../utils/homeCatalogPreview';
import {homeProducts} from '../../services/homeFirstPaint';

export const HighUtilityProductsSection: React.FC = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const [catalogRevision,setCatalogRevision]=useState(0);
  const [previews,setPreviews]=useState<HomePreviewProduct[]>([]);
  const [previewResolved,setPreviewResolved]=useState(false);
  useEffect(()=>{
    let alive=true;
    const onHydrated=()=>queueMicrotask(()=>{
      if(alive)setCatalogRevision(n=>n+1);
    });
    window.addEventListener('sanat-durable-hydrated',onHydrated);
    // The request already started before the main App bundle loaded.
    // The preview is read-only; cart/prices still require /api/runtime.
    void homeProducts().then(products=>{
      if(!alive)return;
      // Keep the first public preview as the visual source of truth, even
      // after the much larger private runtime catalogue finishes hydrating.
      if(products.length)setPreviews(current=>current.length?current:products);
      setPreviewResolved(true);
    });
    return()=>{alive=false;window.removeEventListener('sanat-durable-hydrated',onHydrated);};
  },[]);

  // A single compact card design is used before and after runtime hydration.
  // The public preview fixes order, image and card dimensions; /api/runtime
  // only supplies optional quote/cart/wishlist actions without swapping markup.
  const displayProducts = useMemo(() =>
    previews.length ? previews :
      (previewResolved ? selectHomePreviewProducts(USER_PRODUCTS) : []),
    [previews,previewResolved,catalogRevision]);
  const hydratedProductsByCode = useMemo(() =>
    new Map(USER_PRODUCTS.map(product=>[product.code.toLowerCase(),product])),
    [catalogRevision]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerPhone, setCustomerPhone] = useState('');
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [quickAddedCode, setQuickAddedCode] = useState<string | null>(null);
  const [expandedActionsCode, setExpandedActionsCode] = useState<string | null>(null);

  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrolled = Math.abs(el.scrollLeft) > 10;
    setCanScrollRight(scrolled);
  };

  const handleScrollLeft = () => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollBy({ left: -320, behavior: 'smooth' });
      setCanScrollRight(true);
    }
  };

  const handleScrollRight = () => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollBy({ left: 320, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim() || !selectedProduct) return;

    setInquirySubmitted(true);
    setTimeout(() => {
      setInquirySubmitted(false);
      setSelectedProduct(null);
      setCustomerPhone('');
      setQuantity(1);
    }, 2000);
  };

  const handleQuickInquiry = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart(product, 1);
    setQuickAddedCode(product.code);
    setTimeout(() => setQuickAddedCode(null), 1800);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5" dir="rtl">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[#CBD2D8] pb-3.5">
        {/* Right Title */}
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-[#55565A] tracking-tight">
            محصولات کاربردی
          </h2>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E06518] bg-[#F8F9FA] px-2.5 py-0.5 rounded-md border border-slate-200">
            <Wrench className="w-3.5 h-3.5 text-[#E06518]" />
            <span>قطعات مصرفی و خطوط تولید مداوم</span>
          </span>
        </div>

        {/* Left Link */}
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#E06518] hover:text-[#C95210] transition-colors group"
        >
          <span>مشاهده تمامی قطعات فنی</span>
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Carousel Container */}
      <div className="relative group/carousel">
        {/* Navigation Arrow: Right */}
        <button
          type="button"
          onClick={handleScrollRight}
          className={`absolute -right-2 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm text-[#55565A] hover:text-white hover:bg-[#E06518] hover:border-[#E06518] flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95 ${
            canScrollRight ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-75 pointer-events-none'
          }`}
          aria-label="محصولات قبلی"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Navigation Arrow: Left */}
        <button
          type="button"
          onClick={handleScrollLeft}
          className="absolute -left-2 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#CBD2D8] shadow-sm text-[#55565A] hover:text-white hover:bg-[#E06518] hover:border-[#E06518] flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
          aria-label="محصولات بعدی"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scrollable Products Row */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {displayProducts.length===0 && Array.from({length:6},(_,i)=>(
            <div key={i} className="w-48 sm:w-60 shrink-0 rounded-2xl border border-slate-200 p-4 animate-pulse" aria-hidden="true">
              <div className="aspect-square rounded-xl bg-slate-100" />
              <div className="h-3 bg-slate-100 rounded mt-4" />
              <div className="h-3 bg-slate-100 rounded mt-2 w-2/3" />
            </div>
          ))}
          {displayProducts.map(product=>{
            const fullProduct=hydratedProductsByCode.get(product.code.toLowerCase());
            const actionsOpen=expandedActionsCode===product.code;
            const isFav=fullProduct ? isInWishlist(fullProduct.code) : false;
            const isJustAdded=quickAddedCode===product.code;
            const detailUrl=`/product/${encodeURIComponent(product.code)}`;
            return (
              <div key={product.code}
                className="w-48 sm:w-60 shrink-0 bg-white rounded-2xl border border-[#CBD2D8] p-3 sm:p-4 flex flex-col text-right gap-3 hover:border-[#E06518] relative snap-start">
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-600">
                  <span className="truncate">{product.brand}</span>
                  <span dir="ltr" className="shrink-0">{product.code}</span>
                </div>
                <Link to={detailUrl} aria-label={`مشاهده مشخصات ${product.name}`}
                  className="aspect-square rounded-xl bg-[#F8F9FA] border border-slate-100 p-2 block">
                  <ProductImage src={product.images[0]} thumbnail decoding="async"
                    alt={product.name} loading="lazy" className="w-full h-full object-contain" />
                </Link>
                <div className="flex flex-col gap-1 min-h-[3.5rem]">
                  <Link to={detailUrl} className="text-xs sm:text-sm font-bold line-clamp-2 text-[#55565A] hover:text-[#E06518]">
                    {product.name}
                  </Link>
                  <span className="text-[10px] text-slate-500 line-clamp-1">{product.categoryName}</span>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <Link to={detailUrl} className="text-xs text-[#E06518] hover:text-[#C95210]">
                    مشاهده مشخصات <ArrowLeft className="w-3 h-3 inline" />
                  </Link>
                  {fullProduct && (
                    <button type="button" onClick={()=>setExpandedActionsCode(current=>current===product.code?null:product.code)}
                      aria-expanded={actionsOpen} aria-label={`عملیات بیشتر برای ${product.name}`}
                      className="p-1 rounded-md text-[#777A7D] hover:text-[#E06518] hover:bg-[#F8F9FA]">
                      <ChevronDown className={`w-4 h-4 transition-transform ${actionsOpen?'rotate-180':''}`} />
                    </button>
                  )}
                </div>
                {fullProduct && actionsOpen && (
                  <div className="absolute bottom-11 right-2 left-2 z-30 rounded-xl bg-white border border-[#CBD2D8] shadow-lg p-2 flex flex-col gap-2">
                    <button type="button"
                      onClick={()=>{setSelectedProduct(fullProduct);setExpandedActionsCode(null);}}
                      className="flex items-center justify-center gap-2 rounded-lg p-2 bg-[#F8F9FA] text-[#55565A] text-xs font-bold hover:bg-orange-50">
                      <Calculator className="w-4 h-4 text-[#E06518]" />
                      استعلام قیمت رسمی
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={()=>toggleWishlist(fullProduct.code)}
                        aria-label={isFav?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها'}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 p-2 text-xs">
                        <Heart className={`w-4 h-4 ${isFav?'text-[#E06518] fill-[#E06518]':''}`} />
                        علاقه‌مندی
                      </button>
                      <button type="button" onClick={event=>handleQuickInquiry(fullProduct,event)}
                        aria-label="افزودن به لیست استعلام"
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 p-2 text-xs">
                        {isJustAdded?<Check className="w-4 h-4 text-[#E06518]"/>:<ShoppingCart className="w-4 h-4"/>}
                        لیست استعلام
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Inquiry Modal */}
      {selectedProduct && (
        <Modal
          isOpen={Boolean(selectedProduct)}
          onClose={() => {
            setSelectedProduct(null);
            setInquirySubmitted(false);
          }}
          title={`استعلام سریع: ${selectedProduct.name}`}
        >
          {inquirySubmitted ? (
            <div className="text-center py-8 space-y-3" dir="rtl">
              <div className="w-12 h-12 rounded-full bg-[#DEE2E5] border border-[#CBD2D8] text-[#E06518] mx-auto flex items-center justify-center">
                <Check className="w-6 h-6 text-[#E06518]" />
              </div>
              <h4 className="font-bold text-base text-[#55565A]">درخواست استعلام ثبت شد</h4>
              <p className="text-xs text-[#777A7D]">
                کارشناسان واحد فروش و مهندسی صنعت پیش در کوتاه‌ترین زمان با شما تماس خواهند گرفت.
              </p>
            </div>
          ) : (
            <form onSubmit={handleInquirySubmit} className="space-y-4" dir="rtl">
              <div className="flex items-center gap-3 p-3 bg-[#DEE2E5] rounded-xl border border-[#CBD2D8]">
                <ProductImage
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="w-14 h-14 object-contain bg-white rounded-lg p-1 border border-[#CBD2D8]"
                />
                <div>
                  <div className="font-bold text-xs text-[#55565A]">{selectedProduct.name}</div>
                  <div className="text-[11px] text-[#777A7D] font-mono">کد: {selectedProduct.code}</div>
                  <div className="text-[11px] text-[#E06518] font-semibold">{selectedProduct.categoryName}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#55565A] mb-1">
                  تعداد مورد نیاز:
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-10 px-3 text-xs bg-[#FFFFFF] border border-[#CBD2D8] text-[#55565A] rounded-xl focus:outline-none focus:border-[#E06518]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#55565A] mb-1">
                  شماره موبایل جهت دریافت پیش‌فاکتور:
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#777A7D] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    required
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full h-10 pr-9 pl-3 text-xs bg-[#FFFFFF] border border-[#CBD2D8] text-[#55565A] rounded-xl focus:outline-none focus:border-[#E06518] font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 h-10 bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ارسال فوری استعلام</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="h-10 px-4 border border-[#CBD2D8] text-[#55565A] hover:bg-[#DEE2E5] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
};
