import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Send,
  Building,
  Image,
  Award,
  ShieldCheck,
  Tag,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';
import { STORE_ASSETS } from '../../assets/images';

interface MerchandisingItem {
  id: string;
  title: string;
  type: 'stand' | 'sign' | 'poster' | 'hologram' | 'catalogue';
  cost: string; // 'رایگان برای فروشگاه‌های همکار'
  description: string;
  image: string;
  deliveryTime: string;
}

const MERCHANDISING_ITEMS: MerchandisingItem[] = [
  {
    id: 'merch-stand-forza',
    title: 'استند ایستاده فلزی ۴ ردیفه تسمه‌های صنعتی FORZA (ویژه جلوی مغازه)',
    type: 'stand',
    cost: 'رایگان (با سفارش ۵ کارتن تسمه)',
    description: 'رنگ الکترواستاتیک ضدخش مشکی و نارنجی، شاخک‌های فولادی جهت آویز بیش از ۱۰۰ حلقه تسمه پرمصرف همراه با تابلوی بالاسری برجسته.',
    image: STORE_ASSETS.forzaSwrDualBanner,
    deliveryTime: 'ارسال با اولین محموله باربری'
  },
  {
    id: 'merch-lightbox-sign',
    title: 'تابلوی لایت‌باکس LED برند SWR آلمان با درج نام فروشگاه شما',
    type: 'sign',
    cost: 'رایگان (فروشگاه‌های فعال با سابقه خرید)',
    description: 'ابعاد ۱۲۰×۶۰ سانتی‌متر با نورپردازی فوق‌کم‌مصرف SMD؛ درج نام فروشگاه شما به عنوان «عاملیت رسمی توزیع قطعات صنعتی».',
    image: STORE_ASSETS.brandsFullbleedBg,
    deliveryTime: 'ساخت و تحویل طی ۷ روز کاری'
  },
  {
    id: 'merch-poster-guide',
    title: 'پوستر بزرگ لمینت دیواری جدول تبدیل گام و مشخصات تسمه‌ها و یاتاقان‌ها',
    type: 'poster',
    cost: 'کاملاً رایگان',
    description: 'ابعاد ۱۰۰×۷۰ سانتی‌متر ضد آب و روغنی جهت نصب پشت دخل؛ شامل جدول استانداردهای ISO، مقایسه گام دندانه و زاویه شیار پولی.',
    image: STORE_ASSETS.whySanatCadEngineering,
    deliveryTime: 'ارسال فوری با تیپاکس'
  },
  {
    id: 'merch-hologram-labels',
    title: 'پک ۵۰۰ عددی برچسب هولوگرام لیزری سه بعدی اصالت بازرگانی اطلس',
    type: 'hologram',
    cost: 'کاملاً رایگان',
    description: 'برچسب‌های پلمب گارانتی طلایی اطلس جهت چسباندن روی جعبه قطعات تحویلی به مشتریان نهایی با کد QR استعلام اصالت.',
    image: STORE_ASSETS.whySanatQc,
    deliveryTime: 'تحویل با فاکتور جاری'
  }
];

export const RetailPosMerchandising: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<MerchandisingItem | null>(null);
  const [shopName, setShopName] = useState('ابزار و قطعات صنعتی پارس');
  const [notes, setNotes] = useState('لطفاً به همراه فاکتور سفارش بعدی ارسال فرمایید.');
  const [requestSent, setRequestSent] = useState(false);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setRequestSent(true);
    setTimeout(() => {
      setRequestSent(false);
      setSelectedItem(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 text-right">
      {/* Visual Light Frosted Header */}
      <div className="relative rounded-3xl overflow-hidden border border-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-white/85 backdrop-blur-md p-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-[#E06518] to-orange-400 text-white shadow-md shadow-orange-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                تجهیز فروشگاه و اقلام تبلیغاتی رایگان (Retail POS Merchandising)
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              جهت ارتقای دکوراسیون و افزایش فروش مغازه خود، استندهای ایستاده فلزی، تابلوهای لایت‌باکس برند SWR و FORZA و پوسترهای مشخصات فنی را به صورت رایگان دریافت فرمایید.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-[#E06518] px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 shadow-2xs">
            <Award className="w-4 h-4 text-[#E06518]" />
            <span>پشتیبانی بازاریابی ۱۰۰٪ کارخانه‌ای</span>
          </div>
        </div>
      </div>

      {requestSent && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 font-bold shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>درخواست تجهیز فروشگاه با موفقیت ثبت شد و توسط واحد امور همکاران پیگیری خواهد شد.</span>
        </div>
      )}

      {/* Merchandising Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {MERCHANDISING_ITEMS.map(item => (
          <div
            key={item.id}
            className="bg-white/85 backdrop-blur-md rounded-3xl border border-white/80 hover:border-orange-300 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_35px_rgba(224,101,24,0.08)] transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="relative h-40 rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-inner">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                <span className="absolute top-3 right-3 bg-emerald-700 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-md">
                  {item.cost}
                </span>
                <span className="absolute bottom-2 right-3 text-[11px] font-bold text-white drop-shadow">
                  زمان تحویل: {item.deliveryTime}
                </span>
              </div>

              <h3 className="text-sm font-black text-slate-800 leading-snug">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="w-full py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-orange-500/20"
              >
                <Send className="w-4 h-4" />
                <span>ثبت درخواست ارسال برای این فروشگاه</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Request Merchandising Item */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-xl text-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-800">
                درخواست «{selectedItem.title}»
              </h3>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">نام فروشگاه یا تابلوی سردر مغازه:</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#E06518]"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">توضیحات و ابعاد درخواستی مغازه:</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#E06518]"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
                اقلام درخواستی پس از تأیید واحد بازاریابی، همراه با سفارش بعدی به آدرس فروشگاه ارسال می‌گردد.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E06518] hover:bg-[#C95210] text-white font-bold rounded-xl cursor-pointer"
                >
                  ارسال درخواست به کارخانه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
