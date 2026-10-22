import React, { useState } from 'react';
import {
  Package,
  ShoppingBag,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Truck,
  ArrowRight
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { toPersianDigits, formatPrice } from '../../utils/formatters';
import { STORE_ASSETS } from '../../assets/images';

interface ShelfPackItem {
  id: string;
  title: string;
  category: string;
  itemsCount: number;
  description: string;
  wholesalePriceToman: number;
  estimatedRetailMSRPToman: number;
  profitToman: number;
  marginPercent: number;
  settlementTerms: string;
  image: string;
  badge: string;
  stockStatus: string;
}

const SHELF_PACKS: ShelfPackItem[] = [
  {
    id: 'pack-belts-top20',
    title: 'کارتن جور ۲۰ عددی تسمه‌های V-Belt پرفروش بازار ابزار (FORZA)',
    category: 'تسمه‌های پرمصرف مغازه‌ای',
    itemsCount: 20,
    description: 'شامل پرتقاضاترین سایزهای صنعتی و کارگاهی: A-42, A-48, A-54, B-56, B-64, B-72, C-80 در بسته‌بندی ضد رطوبت روغنی.',
    wholesalePriceToman: 9800000,
    estimatedRetailMSRPToman: 12900000,
    profitToman: 3100000,
    marginPercent: 24,
    settlementTerms: 'چک صیادی ۴۵ روزه بدون بهره',
    image: STORE_ASSETS.forzaSubBelt,
    badge: 'پرفروش‌ترین پک مغازه',
    stockStatus: 'موجود در انبار یزد - ارسال فوری با باربری'
  },
  {
    id: 'pack-bearings-box',
    title: 'پک ۳۰ عددی بلبرینگ‌های دور بالا سری ۶۲۰۰ و ۶۳۰۰ با کاسه‌نمد 2RS',
    category: 'بلبرینگ و یاتاقان',
    itemsCount: 30,
    description: 'سایزهای پرفروش تعمیرکاران و صنایع: 6202, 6204, 6205, 6206, 6304, 6305 با اصالت ۱۰۰٪ و هولوگرام لیزری بازرگانی اطلس.',
    wholesalePriceToman: 14500000,
    estimatedRetailMSRPToman: 19600000,
    profitToman: 5100000,
    marginPercent: 26,
    settlementTerms: 'تسویه اعتباری ۶۰ روزه',
    image: STORE_ASSETS.forzaSubBearing,
    badge: 'سودآوری بالا',
    stockStatus: 'آماده بارگیری در انبار مرکزی'
  },
  {
    id: 'pack-timing-pulleys',
    title: 'بسته جور تسمه‌های تایمینگ دندانه‌دار مداربسته FORZA سری 8M و 5M',
    category: 'تسمه تایم صنعتی',
    itemsCount: 15,
    description: 'ویژه دستگاه‌های چاپ، بسته‌بندی، خطوط کاشی و صنایع دارویی؛ پلی‌اورتان تقویت‌شده با کابل فولادی مقاوم در برابر روغن.',
    wholesalePriceToman: 11200000,
    estimatedRetailMSRPToman: 15800000,
    profitToman: 4600000,
    marginPercent: 29,
    settlementTerms: 'تسویه چکی ۳۰ روزه',
    image: STORE_ASSETS.heroPulley,
    badge: 'ویژه خرده‌فروشی تخصصی',
    stockStatus: 'موجودی انبار: ۲۴ کارتن'
  },
  {
    id: 'pack-couplings-fittings',
    title: 'پک استارتر کوپلینگ‌های انعطاف‌پذیر روتکس و اتصالات صنعتی SWR',
    category: 'کوپلینگ و اتصالات',
    itemsCount: 12,
    description: 'کوپلینگ‌های HRC و Rotex با اسپایدرهای ضد سایش همراه با بوش‌های کونیک؛ اقلام مصرفی پرتکرار خطوط کارخانجات محلی.',
    wholesalePriceToman: 8400000,
    estimatedRetailMSRPToman: 11200000,
    profitToman: 2800000,
    marginPercent: 25,
    settlementTerms: 'چک صیادی ۴۵ روزه',
    image: STORE_ASSETS.forzaSubCoupling,
    badge: 'تخفیف همکاری تناژی',
    stockStatus: 'ارسال با باربری وطن'
  }
];

export const RetailFastMovingPacks: React.FC = () => {
  const { addToCart } = useCart();
  const [orderedPackFeedback, setOrderedPackFeedback] = useState<string | null>(null);

  const handleOrderPack = (pack: ShelfPackItem) => {
    addToCart(
      {
        code: pack.id,
        name: pack.title,
        brand: 'بازرگانی اطلس',
        categorySlug: 'industrial-belts',
        categoryName: pack.category,
        subcategory: 'بسته‌های عمده مغازه‌داری',
        technicalSpecs: [{ key: 'محتویات', value: `${pack.itemsCount} قلم جور` }],
        prices: {
          base: pack.wholesalePriceToman,
          retail: pack.estimatedRetailMSRPToman,
          wholesale: pack.wholesalePriceToman,
          dealer: pack.wholesalePriceToman * 0.95
        },
        stock: 50,
        inquiryOnly: false,
        images: [pack.image],
        tags: ['پک عمده خرده‌فروشی', pack.badge],
        unit: 'کارتن'
      },
      1
    );

    setOrderedPackFeedback(`«${pack.title}» با موفقیت به سبد خرید فروشگاه شما افزوده شد.`);
    setTimeout(() => setOrderedPackFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Light Frosted Header */}
      <div className="relative rounded-3xl overflow-hidden border border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-white/85 backdrop-blur-md p-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#E06518] to-orange-400 text-white shadow-md shadow-orange-500/20">
                <Package className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                بسته‌های جور و پرفروش قفسه مغازه (Fast-Moving Retail Packs)
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              کارتن‌های جوربندی‌شده از پرتقاضاترین اقلام مصرفی بازار؛ با حاشیه سود ۲۴٪ الی ۳۰٪ تضمین‌شده و شرایط تسویه چکی ۴۵ تا ۶۰ روزه با صیاد.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/90 border border-slate-200/80 p-3.5 rounded-2xl shrink-0 shadow-xs backdrop-blur-sm">
            <Truck className="w-6 h-6 text-[#E06518]" />
            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">ارسال بسته‌های عمده مغازه‌داران:</span>
              <span className="text-xs font-bold text-slate-800">تحویل رایگان در انبار باربری شهر شما</span>
            </div>
          </div>
        </div>
      </div>

      {orderedPackFeedback && (
        <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 font-bold shadow-sm backdrop-blur-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{orderedPackFeedback}</span>
        </div>
      )}

      {/* Grid of Shelf Packs - Light Frosted Glass */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SHELF_PACKS.map(pack => (
          <div
            key={pack.id}
            className="bg-white/85 backdrop-blur-md rounded-3xl border border-white/80 hover:border-orange-300 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_35px_rgba(224,101,24,0.08)] transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              {/* Top Image + Badges */}
              <div className="relative h-44 rounded-2xl overflow-hidden border border-slate-200/70 bg-slate-50 shadow-inner">
                <img
                  src={pack.image}
                  alt={pack.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="bg-[#E06518] text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-md">
                    {pack.badge}
                  </span>
                  <span className="bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-bold px-2 py-1 rounded-xl border border-slate-200/60 shadow-xs">
                    {toPersianDigits(pack.itemsCount)} قلم کالا
                  </span>
                </div>

                <div className="absolute bottom-3 right-3 left-3 text-white">
                  <span className="text-[10px] text-orange-200 font-bold block">{pack.category}</span>
                  <h3 className="text-sm font-black text-white leading-snug line-clamp-1">{pack.title}</h3>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                {pack.description}
              </p>

              {/* Financial Profit & Margin Metric Bar */}
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 grid grid-cols-3 gap-2 text-center">
                <div className="space-y-0.5 border-l border-slate-200 pl-2">
                  <span className="text-[10px] text-slate-500 block">قیمت خرید همکار:</span>
                  <span className="text-xs font-black text-emerald-700 font-mono">
                    {formatPrice(pack.wholesalePriceToman)}
                  </span>
                </div>

                <div className="space-y-0.5 border-l border-slate-200 px-2">
                  <span className="text-[10px] text-slate-500 block">فروش پیشنهادی:</span>
                  <span className="text-xs font-black text-slate-800 font-mono">
                    {formatPrice(pack.estimatedRetailMSRPToman)}
                  </span>
                </div>

                <div className="space-y-0.5 pr-2">
                  <span className="text-[10px] text-[#E06518] font-bold block">سود ناخالص پک:</span>
                  <span className="text-xs font-black text-[#E06518] font-mono">
                    +{formatPrice(pack.profitToman)} ({toPersianDigits(pack.marginPercent)}٪)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>شرایط تسویه: {pack.settlementTerms}</span>
                </span>
                <span className="text-slate-400 text-[10px]">{pack.stockStatus}</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleOrderPack(pack)}
                className="w-full py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shadow-orange-500/20"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>سفارش یک کارتن از این پک برای قفسه مغازه</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
