import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calculator,
  Wrench,
  Truck,
  ShieldCheck,
  Lock,
  Unlock,
  ArrowLeft,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  FileCheck2,
  Cpu,
  Layers,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CustomPartRequestModal } from './CustomPartRequestModal';

export const ServicesAndCapabilitiesSection: React.FC = () => {
  const { currentUser, openAuthModal } = useAuth();
  const [isCustomPartModalOpen, setIsCustomPartModalOpen] = useState(false);

  const services = [
    {
      id: 'quote',
      number: '۰۱',
      title: 'استعلام قیمت آنلاین و فاکتور رسمی معتبر',
      category: 'قیمت‌گذاری شفاف و B2B',
      desc: 'استعلام آنلاین قیمت‌ها و صدور آنی پیش‌فاکتور رسمی شرکتی با شناسه ملی، کد اقتصادی و ارزش افزوده جهت امور مالیاتی کارخانجات.',
      metric: 'صدور فاکتور رسمی',
      metricSub: 'با اعمال تخفیف پلکانی تیراژ',
      icon: Calculator,
      badge: 'نیازمند ورود به حساب',
      actionType: 'auth',
    },
    {
      id: 'custom-mfg',
      number: '۰۲',
      title: 'ساخت قطعات سفارشی و مهندسی معکوس',
      category: 'کارگاه ساخت و CNC',
      desc: 'هر کالایی که در کاتالوگ سایت نبود را بسازید! ساخت انواع پولی‌های خاص، رولر کوره، زنجیر، دنده و کوپلینگ طبق نقشه یا نمونه فرسوده.',
      metric: 'تضمین انطباق آلیاژ',
      metricSub: 'مطابق استانداردهای DIN / ISO',
      icon: Wrench,
      badge: 'خدمت اختصاصی صنعت‌پیش',
      actionType: 'customModal',
    },
    {
      id: 'fast-dispatch',
      number: '۰۳',
      title: 'تأمین و دپوی فوری ۲۴ ساعته از سوله میبد',
      category: 'لجستیک و زنجیره تأمین',
      desc: 'ارسال اورژانسی قطعات حیاتی به خطوط تولید کاشی، فولاد، سیمان و نساجی سراسر کشور جهت به صفر رساندن زمان توقف خط.',
      metric: 'ارسال زیر ۲۴ ساعت',
      metricSub: 'دپوی مرکزی جاده سنتو میبد',
      icon: Truck,
      badge: 'بدون خواب خط تولید',
      actionType: 'contact',
    },
    {
      id: 'engineering-consult',
      number: '۰۴',
      title: 'مشاوره مهندسی مکانیک و نقشه‌خوانی رایگان',
      category: 'پشتیبانی فنی کارخانجات',
      desc: 'همراهی مهندسین مکانیک و متالوژی مقیم: تحلیل نقشه‌های ساخت، معادل‌یابی قطعات تحریمی اروپایی با برندهای استاندارد FORZA و SWR.',
      metric: 'پایش و پیشگیری از خرابی',
      metricSub: 'مشاوره فنی رایگان',
      icon: ShieldCheck,
      badge: 'پارتنرشیپ صنعتی',
      actionType: 'consult',
    },
  ];

  const handleAction = (type: string) => {
    if (type === 'auth') {
      if (!currentUser) {
        openAuthModal('/products', 'login');
      }
    } else if (type === 'customModal') {
      setIsCustomPartModalOpen(true);
    }
  };

  return (
    <>
      <section className="relative w-full py-12 sm:py-16 bg-[#F8F9FA] text-[#55565A] border-y border-slate-200/90 overflow-hidden" dir="rtl">
        {/* Subtle Engineered Ambient Matrix Grid Background */}
        <div className="absolute inset-0 bg-[radial-gradient(#55565a0d_1.2px,transparent_1.2px)] [background-size:24px_24px] pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-500/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-slate-400/[0.08] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
          
          {/* ========================================================================= */}
          {/* SECTION HEADER                                                            */}
          {/* ========================================================================= */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200/90">
            <div className="space-y-2 text-right max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[11px] font-black text-[#E06518]">
                <Layers className="w-3.5 h-3.5 text-[#E06518]" />
                <span>خدمات و قابلیت‌های جامع هایپر صنعت‌پیش | همیار صنایع مادر</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#2B313A] tracking-tight flex flex-wrap items-center gap-x-2">
                <span>تمام خدمات و امکانات صنعتی،</span>
                <span className="text-[#E06518] relative inline-block">
                  ساده و در دسترس
                  <span className="absolute -bottom-0.5 inset-x-0 h-1 bg-[#E06518]/25 rounded-full" />
                </span>
                <span>برای کارخانجات</span>
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-600 font-normal leading-relaxed">
                آشنایی شفاف با جریان خدمات؛ از استعلام قیمت‌های دست‌اول و صدور فاکتور رسمی تا ساخت قطعات سفارشی ناموجود در سایت و تحویل ۲۴ ساعته:
              </p>
            </div>

            {/* Quick Action Button for Custom Manufacturing */}
            <div className="shrink-0 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsCustomPartModalOpen(true)}
                className="h-11 px-5 rounded-xl bg-[#2B313A] hover:bg-[#E06518] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer group active:scale-95"
              >
                <Wrench className="w-4 h-4 text-orange-400 group-hover:text-white transition-colors" />
                <span>سفارش ساخت قطعه سفارشی</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 1. PRICE & QUOTE GATEWAY NOTICE BANNER (استعلام قیمت نیازمند ورود به حساب) */}
          {/* ========================================================================= */}
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs relative overflow-hidden group">
            {/* Ambient Corner Accent */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/[0.03] group-hover:bg-orange-500/[0.07] rounded-full blur-2xl transition-all pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#E06518] to-transparent" />

            <div className="flex flex-col md:flex-row items-center justify-between gap-5 text-right">
              
              {/* Right Side: Informative explanation */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${currentUser ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-orange-50 text-[#E06518] border border-orange-200'}`}>
                    {currentUser ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </span>
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#2B313A]">
                    {currentUser ? (
                      <span className="text-emerald-700">پنل استعلام قیمت برای شما فعال است (کاربر همکار)</span>
                    ) : (
                      <span>راهنمای استعلام قیمت: برای مشاهده و استعلام قیمت، نیاز به ورود به حساب کاربری دارید</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-normal pr-10">
                  {currentUser ? (
                    `خوش آمدید جناب ${currentUser.name || 'همکار گرامی'}. شما می‌توانید با کلیک روی دکمه استعلام هر محصول، استعلام قیمت لحظه‌ای با فاکتور رسمی را با احتساب تخفیف شرکتی ثبت فرمایید.`
                  ) : (
                    'به‌منظور حفظ محرمانگی نرخ‌های B2B، تخفیفات پلکانی تیراژ و نوسانات متالوژی، قیمت‌های دست‌اول و کلید استعلام فاکتور رسمی پس از ورود به حساب کاربری برای شما در دسترس قرار می‌گیرد.'
                  )}
                </p>
              </div>

              {/* Left Side: Direct Action Button */}
              <div className="shrink-0 w-full md:w-auto">
                {currentUser ? (
                  <Link
                    to="/products"
                    className="w-full md:w-auto h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    <span>مشاهده کاتالوگ و ثبت استعلام کالاها</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuthModal('/products', 'login')}
                    className="w-full md:w-auto h-11 px-5 rounded-xl bg-gradient-to-r from-[#C95210] to-[#E06518] hover:from-[#C2410C] hover:to-[#C95210] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>ورود به حساب کاربری و فعال‌سازی قیمت‌ها</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. HERO FEATURE: CUSTOM MANUFACTURING (هر قطعه‌ای که در سایت نبود)        */}
          {/* ========================================================================= */}
          <div className="rounded-2xl sm:rounded-3xl bg-[#2B313A] text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
            {/* Background Engineering Matrix & Light Flare */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-10 w-80 h-80 bg-slate-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
              
              {/* Content Description */}
              <div className="space-y-3 text-right max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 border border-white/15 text-[11px] font-bold text-orange-300">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>کارگاه تراشکاری CNC، ریخته‌گری دقیق و مهندسی معکوس</span>
                </div>

                <h3 className="text-lg sm:text-2xl font-black text-white leading-tight">
                  قطعه مورد نظر شما در کاتالوگ سایت نیست؟
                  <span className="text-[#E06518] pr-2 inline-block">دقیقاً بر اساس نقشه یا نمونه شما می‌سازیم!</span>
                </h3>

                <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal">
                  صنعت‌پیش مجهز به خطوط ساخت تخصصی قطعات خطوط تولید است. اگر قطعه‌ای دارید که به علت تحریم وارد نمی‌شود، از رده تولید خارج شده، یا مشخصات ابعادی اختصاصی دارد، کافی است نقشه، عکس یا نمونه معیوب آن را ارسال کنید تا با آلیاژ استاندارد برای خط تولید شما ساخته و تحویل شود.
                </p>

                {/* 3 Quick Manufacturing Highlights */}
                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    پذیرش فایل نقشه یا عکس قطعه فرسوده
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    تضمین ۱۰۰٪ انطباق متالوژی و سختی‌سنجی
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ساخت از نمونه تکی تا تیراژ انبوه
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setIsCustomPartModalOpen(true)}
                  className="h-12 px-6 bg-gradient-to-r from-[#C95210] to-[#E06518] hover:from-[#C2410C] hover:to-[#C95210] text-white font-black text-xs sm:text-sm rounded-xl shadow-[0_6px_20px_rgba(224,101,24,0.35)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 group"
                >
                  <Wrench className="w-4 h-4 text-white" />
                  <span>ثبت سفارش ساخت قطعه سفارشی</span>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </button>

                <a
                  href="tel:03538739900"
                  className="h-11 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center justify-center gap-2 transition-colors"
                  dir="ltr"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-orange-400" />
                  <span>تماس با واحد ساخت: ۰۳۵-۳۸۷۳۹۹۰۰</span>
                </a>
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. 4 CORE INDUSTRIAL SERVICES CARDS (کارت‌های مینیمال خاکستری و نارنجی)     */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-stretch">
            {services.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="group rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-[#E06518] bg-white p-5 sm:p-6 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between text-right relative overflow-hidden hover:-translate-y-1"
                >
                  {/* Subtle Top Accent */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-transparent group-hover:bg-[#E06518] transition-colors" />

                  <div className="space-y-4">
                    {/* Card Top: Number & Category */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 group-hover:bg-orange-50 text-slate-700 group-hover:text-[#E06518] border border-slate-200/80 group-hover:border-orange-200 flex items-center justify-center font-mono font-black text-xs transition-colors">
                        {item.number}
                      </div>

                      <span className="px-2.5 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold">
                        {item.badge}
                      </span>
                    </div>

                    {/* Service Title */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-[#E06518] block">{item.category}</span>
                      <h3 className="text-sm sm:text-base font-black text-[#2B313A] group-hover:text-[#E06518] transition-colors leading-snug">
                        {item.title}
                      </h3>
                    </div>

                    {/* Service Description */}
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {item.desc}
                    </p>

                    {/* Metric Box */}
                    <div className="p-3 rounded-xl bg-[#F8F9FA] group-hover:bg-orange-50/40 border border-slate-100 transition-colors space-y-0.5 text-center">
                      <span className="block text-xs font-black text-[#2B313A]">{item.metric}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{item.metricSub}</span>
                    </div>
                  </div>

                  {/* Card Action Link */}
                  <div className="pt-4 mt-auto">
                    {item.actionType === 'customModal' ? (
                      <button
                        type="button"
                        onClick={() => setIsCustomPartModalOpen(true)}
                        className="w-full h-10 rounded-xl bg-slate-100 group-hover:bg-[#E06518] text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-[#E06518] font-bold text-xs flex items-center justify-between px-3.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <span>ثبت درخواست ساخت</span>
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                      </button>
                    ) : item.actionType === 'auth' ? (
                      <button
                        type="button"
                        onClick={() => handleAction('auth')}
                        className="w-full h-10 rounded-xl bg-slate-100 group-hover:bg-[#E06518] text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-[#E06518] font-bold text-xs flex items-center justify-between px-3.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <span>{currentUser ? 'ثبت استعلام کالاها' : 'ورود و دریافت استعلام'}</span>
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                      </button>
                    ) : (
                      <Link
                        to={item.actionType === 'contact' ? '/contact' : '/contact'}
                        className="w-full h-10 rounded-xl bg-slate-100 group-hover:bg-[#E06518] text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-[#E06518] font-bold text-xs flex items-center justify-between px-3.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <span>هماهنگی و مشاوره</span>
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* 4. 3-STEP FRICTIONLESS FLOW (چگونه از خدمات صنعت‌پیش استفاده کنید؟)         */}
          {/* ========================================================================= */}
          <div className="pt-4 border-t border-slate-200/90 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <span className="font-extrabold text-[#2B313A] shrink-0">
              مراحل دریافت خدمت در هایپر صنعت‌پیش:
            </span>

            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-slate-700 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#E06518] text-white flex items-center justify-center text-[10px] font-bold font-mono">۱</span>
                <span>انتخاب قطعه یا بارگذاری نقشه قطعه سفارشی</span>
              </div>
              <span className="text-slate-300">←</span>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#2B313A] text-white flex items-center justify-center text-[10px] font-bold font-mono">۲</span>
                <span>ورود به حساب و دریافت استعلام رسمی</span>
              </div>
              <span className="text-slate-300">←</span>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold font-mono">۳</span>
                <span>تأیید، بارگیری ۲۴ ساعته و ارسال به کارخانه</span>
              </div>
            </div>

            <div className="shrink-0 text-slate-500 text-[11px]">
              پشتیبانی ۲۴ ساعته: <span className="font-mono font-bold text-[#E06518]">۰۳۵-۳۸۷۳۹۹۰۰</span>
            </div>
          </div>

        </div>
      </section>

      {/* CUSTOM PART REQUEST MODAL */}
      <CustomPartRequestModal
        isOpen={isCustomPartModalOpen}
        onClose={() => setIsCustomPartModalOpen(false)}
      />
    </>
  );
};
