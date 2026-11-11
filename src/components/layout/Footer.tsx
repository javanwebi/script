import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Headphones,
  ChevronLeft,
  ChevronDown,
  MessageCircle,
  ArrowUp,
  ShieldCheck,
  Award,
  BookOpen,
} from 'lucide-react';
import { STORE_ASSETS } from '../../assets/images';
import { SanatPishFooterLogo } from '../common/BrandIdentity';
import { CATEGORIES } from '../../data/categories';
const LazyAiConsultModal = React.lazy(() => import('../search/AiConsultModal').then(m => ({default:m.AiConsultModal})));

export const Footer: React.FC = () => {
  const [isConsultOpen, setIsConsultOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const currentPersianYear = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date());

  const toggleAccordion = (key: string) => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative w-full overflow-hidden text-[#2B313A] border-t border-[#CBD2D8]" dir="rtl">
      {/* Top subtle hairline orange accent bar matching header */}
      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#E06518] to-transparent opacity-85" />

      {/* ========================================================================= */}
      {/* TIER 1 (MAIN ZONE): Matching Header Main Body Canvas (#DEE2E5)            */}
      {/* ========================================================================= */}
      <div className="relative bg-[#DEE2E5] text-[#2B313A] pt-10 pb-9">
        {/* Subtle background industrial pattern and gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#DEE2E5] via-[#E2E6E9] to-[#D8DCE0] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#2b313a0f_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none opacity-40" />

        {/* Subtle conveyor graphic on far left */}
        <div className="absolute left-0 top-0 bottom-0 w-[22%] lg:w-[16%] pointer-events-none overflow-hidden z-0 hidden md:block opacity-10 mix-blend-multiply">
          <img fetchPriority="low" decoding="async" loading="lazy"
            src={STORE_ASSETS.footerConveyor}
            alt="نوار نقاله صنعتی"
            className="w-full h-full object-cover object-right"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#DEE2E5] via-[#DEE2E5]/60 to-transparent" />
        </div>

        {/* Main Footer Content Grid */}
        <div className="relative z-10 max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.55fr_0.9fr_0.95fr_0.95fr_1.1fr_1.35fr] gap-6 lg:gap-4 xl:gap-6 items-start">
            
            {/* 1. BRAND & NEWSLETTER COLUMN */}
            <div className="space-y-3.5 text-right lg:pl-3">
              <Link to="/" className="inline-flex flex-col items-start gap-1.5 group" aria-label="لوگوی صنعت پیش، بازگشت به فروشگاه">
                <SanatPishFooterLogo className="block w-[176px] h-[68px] sm:w-[200px] sm:h-[76px] object-contain object-right group-hover:scale-[1.02] transition-transform" />
                <span className="text-[11px] sm:text-xs font-bold text-[#C95210] leading-relaxed">
                  پیش به صنعت | بازرگانی اطلس از ۱۳۶۶
                </span>
              </Link>

              <h3 className="text-xs sm:text-[13px] font-bold text-[#2B313A] pt-0.5">
                تولید، ساخت و تأمین قطعات خطوط تولید صنایع کشور
              </h3>

              <p className="text-[11px] text-[#55565A] leading-relaxed text-justify max-w-sm font-normal">
                صنعت پیش، بازار آنلاین تخصصی قطعات و تجهیزات خطوط تولید است که با پشتوانه تجربه بازرگانی تسمه اطلس از سال ۱۳۶۶، جستجو، بررسی مشخصات، مشاوره و مسیر استعلام را در یک بستر یکپارچه فراهم می‌کند.
              </p>

              {/* Verified contact channels only; no generic placeholder social destinations. */}
              <div className="flex items-center gap-2 pt-0.5">
                <a
                  href="https://wa.me/989903427027"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 items-center gap-2 rounded-lg border border-[#CBD2D8] bg-white px-2.5 text-[10px] font-bold text-[#2B313A] shadow-2xs transition-colors hover:border-emerald-500 hover:bg-emerald-50/40 hover:text-emerald-700"
                  title="ارتباط در واتساپ"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  واتساپ
                </a>
                <a
                  href="mailto:info@sanatpish.com"
                  className="flex h-8 items-center gap-2 rounded-lg border border-[#CBD2D8] bg-white px-2.5 text-[10px] font-bold text-[#2B313A] shadow-2xs transition-colors hover:border-[#E06518] hover:bg-orange-50/40 hover:text-[#E06518]"
                  title="ارسال ایمیل به صنعت پیش"
                >
                  <Mail className="h-3.5 w-3.5" />
                  ایمیل
                </a>
              </div>

              <div className="border-t border-[#CBD2D8] pt-3 max-w-sm" />

              {/* Useful knowledge link instead of a local-only newsletter form. */}
              <div className="space-y-1.5 max-w-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#2B313A]">
                  <BookOpen className="h-3.5 w-3.5 text-[#E56B1E]" />
                  <span>دانشنامه و راهنماهای فنی</span>
                </div>
                <p className="text-[10px] leading-5 text-[#55565A]">
                  راهنماهای انتخاب، شناسایی و نگهداری قطعات را در دانشنامه صنعت پیش دنبال کنید.
                </p>
                <Link to="/knowledge" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#E56B1E] px-3 text-[10px] font-bold text-white shadow-xs transition-colors hover:bg-[#C95210]">
                  مشاهده راهنماها <ChevronLeft className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* 2. QUICK ACCESS COLUMN */}
            <div className="space-y-2 text-right lg:border-r lg:border-[#CBD2D8] lg:pr-4 xl:pr-5 border-b border-[#CBD2D8] pb-3 md:border-b-0 md:pb-0">
              <button
                type="button"
                onClick={() => toggleAccordion('quickAccess')}
                className="w-full flex items-center justify-between py-1.5 md:py-0 md:cursor-default cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
                  <h4 className="text-xs sm:text-[13px] font-bold text-[#2B313A] group-hover:text-[#E06518] md:group-hover:text-[#2B313A] transition-colors">
                    دسترسی سریع
                  </h4>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#777A7D] transition-transform duration-200 md:hidden ${
                    openAccordion === 'quickAccess' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              <ul className={`space-y-1.5 text-[11px] text-[#55565A] pt-1.5 md:pt-0 ${openAccordion === 'quickAccess' ? 'block' : 'hidden'} md:block animate-in fade-in`}>
                <li>
                  <Link to="/" className="hover:text-[#E06518] transition-colors block">
                    خانه
                  </Link>
                </li>
                <li>
                  <Link to="/products" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>کاتالوگ تمام محصولات</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/categories" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>همه دسته‌بندی‌ها</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/#industries" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>صنایع و کاربردها</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/brands" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>برندها</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsConsultOpen(true)}
                    className="w-full hover:text-[#E06518] transition-colors flex items-center justify-between group cursor-pointer text-right"
                  >
                    <span>خدمات صنعتی</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </button>
                </li>
                <li>
                  <Link to="/about" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>درباره اطلس</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>تماس با ما</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* 3. PRODUCTS COLUMN */}
            <div className="space-y-2 text-right lg:border-r lg:border-[#CBD2D8] lg:pr-4 xl:pr-5 border-b border-[#CBD2D8] pb-3 md:border-b-0 md:pb-0">
              <button
                type="button"
                onClick={() => toggleAccordion('products')}
                className="w-full flex items-center justify-between py-1.5 md:py-0 md:cursor-default cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
                  <h4 className="text-xs sm:text-[13px] font-bold text-[#2B313A] group-hover:text-[#E06518] md:group-hover:text-[#2B313A] transition-colors">
                    محصولات
                  </h4>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#777A7D] transition-transform duration-200 md:hidden ${
                    openAccordion === 'products' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              <ul className={`space-y-1.5 text-[11px] text-[#55565A] pt-1.5 md:pt-0 ${openAccordion === 'products' ? 'block' : 'hidden'} md:block animate-in fade-in`}>
                {CATEGORIES.slice(0, 4).map(category => (
                  <li key={category.slug}>
                    <Link to={`/category/${category.slug}`} className="hover:text-[#E06518] transition-colors flex items-center justify-between gap-2 group">
                      <span>{category.name}</span>
                      <ChevronLeft className="w-3 h-3 shrink-0 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. CUSTOMER SERVICES */}
            <div className="space-y-2 text-right lg:border-r lg:border-[#CBD2D8] lg:pr-4 xl:pr-5 border-b border-[#CBD2D8] pb-3 md:border-b-0 md:pb-0">
              <button
                type="button"
                onClick={() => toggleAccordion('services')}
                className="w-full flex items-center justify-between py-1.5 md:py-0 md:cursor-default cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
                  <h4 className="text-xs sm:text-[13px] font-bold text-[#2B313A] group-hover:text-[#E06518] md:group-hover:text-[#2B313A] transition-colors">
                    خدمات مشتریان
                  </h4>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#777A7D] transition-transform duration-200 md:hidden ${
                    openAccordion === 'services' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              <ul className={`space-y-1.5 text-[11px] text-[#55565A] pt-1.5 md:pt-0 ${openAccordion === 'services' ? 'block' : 'hidden'} md:block animate-in fade-in`}>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsConsultOpen(true)}
                    className="w-full hover:text-[#E06518] transition-colors flex items-center justify-between group cursor-pointer text-right"
                  >
                    <span>مشاوره فنی اطلس</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </button>
                </li>
                <li>
                  <Link to="/category/industrial-belts" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>انتخاب قطعات صنعتی</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/dealer" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>پنل عاملیت و نمایندگی</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/agency" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>تأمین سفارشی خطوط</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-[#E06518] transition-colors flex items-center justify-between group">
                    <span>پشتیبانی فنی مهندسی</span>
                    <ChevronLeft className="w-3 h-3 text-[#777A7D] group-hover:text-[#E06518] transition-colors" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* 5. CONTACT INFO COLUMN */}
            <div className="space-y-2.5 text-right lg:border-r lg:border-[#CBD2D8] lg:pr-4 xl:pr-5 border-b border-[#CBD2D8] pb-3 md:border-b-0 md:pb-0">
              <button
                type="button"
                onClick={() => toggleAccordion('contact')}
                className="w-full flex items-center justify-between py-1.5 md:py-0 md:cursor-default cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
                  <h4 className="text-xs sm:text-[13px] font-bold text-[#2B313A] group-hover:text-[#E06518] md:group-hover:text-[#2B313A] transition-colors">
                    اطلاعات تماس
                  </h4>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-[#777A7D] transition-transform duration-200 md:hidden ${
                    openAccordion === 'contact' ? 'rotate-180 text-[#E06518]' : ''
                  }`}
                />
              </button>

              <div className={`space-y-2.5 pt-1.5 md:pt-0 ${openAccordion === 'contact' ? 'block' : 'hidden'} md:block animate-in fade-in`}>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white border border-[#CBD2D8] text-[#E06518] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Phone className="w-3 h-3" />
                  </div>
                  <div className="space-y-0.5 text-[11px] text-[#2B313A] font-mono text-right" dir="ltr">
                    <div>
                      <a href="tel:03535254703" className="hover:text-[#E06518] transition-colors font-bold">
                        ۰۳۵-۳۵۲۵۴۷۰۳ (دفتر مرکزی یزد)
                      </a>
                    </div>
                    <div>
                      <a href="https://wa.me/989903427027" target="_blank" rel="noreferrer" className="hover:text-emerald-600 transition-colors">
                        ۰۹۹۰۳۴۲۷۰۲۷ (واتساپ)
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white border border-[#CBD2D8] text-[#E06518] flex items-center justify-center shrink-0 shadow-2xs">
                    <Mail className="w-3 h-3" />
                  </div>
                  <a
                    href="mailto:info@sanatpish.com"
                    className="text-[11px] text-[#2B313A] font-mono hover:text-[#E06518] transition-colors"
                    dir="ltr"
                  >
                    info@sanatpish.com
                  </a>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white border border-[#CBD2D8] text-[#E06518] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <div className="space-y-0.5 text-[11px] text-[#55565A]">
                    <p className="text-[#2B313A] font-medium leading-relaxed">
                      یزد، بلوار جمهوری، بعد از بیمارستان افشار، جنب بانک سپه، بازرگانی اطلس (صنعت پیش)
                    </p>
                    <p className="text-[10px] text-[#777A7D] font-mono" dir="ltr">
                      کد پستی: ۸۹۱۷۹۴۵۶۳۹
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-white border border-[#CBD2D8] text-[#E06518] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="space-y-0.5 text-[11px] text-[#55565A]">
                    <span className="font-bold text-[#2B313A] block">ساعات کاری</span>
                    <span className="text-[10.5px] text-[#777A7D] block">شنبه تا پنجشنبه ۸:۰۰ الی ۲۰:۰۰</span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConsultOpen(true)}
                    className="w-full h-8 rounded-xl border border-[#CBD2D8] bg-white hover:bg-orange-50/50 hover:border-[#E06518] text-[#2B313A] hover:text-[#E06518] flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer text-xs font-bold shadow-2xs group active:scale-95"
                  >
                    <Headphones className="w-3.5 h-3.5 text-[#E06518] group-hover:scale-110 transition-transform" />
                    <span>درخواست مشاوره مهندسی</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 6. TRUST BADGES & LICENSES */}
            <div className="space-y-3 text-right lg:border-r lg:border-[#CBD2D8] lg:pr-4 xl:pr-5">
              <Link to="/about" className="mb-2 flex items-center justify-between group">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E56B1E]" />
                  <h4 className="text-xs font-bold text-[#2B313A] transition-colors group-hover:text-[#E56B1E] sm:text-[13px]">
                    پشتوانه و رویکرد صنعت پیش
                  </h4>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-[#777A7D] transition-colors group-hover:text-[#E56B1E]" />
              </Link>

              <div className="grid grid-cols-3 gap-2">
                <div className="flex min-h-[96px] flex-col items-center justify-between rounded-xl border border-[#CBD2D8] bg-white p-2 text-center shadow-2xs transition-colors hover:border-[#E56B1E]">
                  <Award className="mt-1 h-6 w-6 text-[#E56B1E]" />
                  <div className="space-y-0.5">
                    <strong className="block text-[9px] text-[#2B313A]">پشتوانه اطلس</strong>
                    <span className="block text-[8px] leading-4 text-[#777A7D]">از سال ۱۳۶۶</span>
                  </div>
                </div>
                <div className="flex min-h-[96px] flex-col items-center justify-between rounded-xl border border-[#CBD2D8] bg-white p-2 text-center shadow-2xs transition-colors hover:border-[#E56B1E]">
                  <ShieldCheck className="mt-1 h-6 w-6 text-[#E56B1E]" />
                  <div className="space-y-0.5">
                    <strong className="block text-[9px] text-[#2B313A]">تخصص صنعتی</strong>
                    <span className="block text-[8px] leading-4 text-[#777A7D]">تمرکز بر قطعات خطوط تولید</span>
                  </div>
                </div>
                <div className="flex min-h-[96px] flex-col items-center justify-between rounded-xl border border-[#CBD2D8] bg-white p-2 text-center shadow-2xs transition-colors hover:border-[#E56B1E]">
                  <Headphones className="mt-1 h-6 w-6 text-[#E56B1E]" />
                  <div className="space-y-0.5">
                    <strong className="block text-[9px] text-[#2B313A]">پشتیبانی</strong>
                    <span className="block text-[8px] leading-4 text-[#777A7D]">ارتباط با کارشناسان</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-start gap-2.5 pt-2">
                <div className="w-1 h-8 bg-[#E06518] rounded-full shrink-0 shadow-2xs" />
                <div className="text-right">
                  <h5 className="text-xs font-bold text-[#2B313A] leading-snug">
                    صنعت پیش؛ پیش به صنعت
                  </h5>
                  <p className="text-[10px] text-[#777A7D] mt-0.5 font-normal">
                    بازرگانی تسمه اطلس از سال ۱۳۶۶
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIER 2 (BOTTOM ZONE): Matching Header Top & Nav Dark Slate (#2B313A)      */}
      {/* ========================================================================= */}
      <div className="relative z-10 border-t border-[#3F4550] bg-[#2B313A] text-slate-300 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <Link to="/" className="flex items-center gap-2" aria-label="بازگشت به صنعت پیش">
              <span className="rounded-md bg-white/95 px-1 py-0.5">
                <SanatPishFooterLogo className="w-[77px] h-8 object-contain" />
              </span>
              <span className="text-[9px] font-bold text-[#F28C45]">پیش به صنعت | اطلس ۱۳۶۶</span>
            </Link>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-300 text-[11px]">
              © {currentPersianYear} صنعت پیش (بازرگانی تسمه اطلس از سال ۱۳۶۶) | پیش به صنعت | تمامی حقوق محفوظ است.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400">
              <Link to="/products" className="hover:text-white transition-colors">
                کاتالوگ قطعات
              </Link>
              <span className="text-slate-600">|</span>
              <Link to="/knowledge" className="hover:text-white transition-colors">
                دانشنامه فنی
              </Link>
              <span className="text-slate-600">|</span>
              <Link to="/contact" className="hover:text-white transition-colors">
                تماس با ما
              </Link>
            </div>

            <button
              type="button"
              onClick={scrollToTop}
              className="w-7 h-7 rounded-lg border border-slate-600 bg-[#3F4550] text-slate-200 hover:text-white hover:border-[#E06518] hover:bg-[#E06518] flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
              title="بازگشت به بالا"
              aria-label="بازگشت به بالا"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isConsultOpen && <React.Suspense fallback={null}>
        <LazyAiConsultModal isOpen onClose={() => setIsConsultOpen(false)} />
      </React.Suspense>}
    </footer>
  );
};

export default Footer;
