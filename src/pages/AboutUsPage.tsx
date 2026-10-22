import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { scrollToSectionElement } from '../components/layout/ScrollToTop';
import {
  Building2,
  History,
  Award,
  ShieldCheck,
  FileCheck2,
  ChevronLeft,
  PhoneCall,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Factory,
  Layers,
  Sparkles,
  Users,
  TrendingUp,
  Download,
  ExternalLink,
  Shield,
  Clock,
  Warehouse,
} from 'lucide-react';
import { STORE_ASSETS } from '../assets/images';

interface AboutUsPageProps {
  defaultTab?: 'intro' | 'history' | 'licenses' | 'awards';
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({ defaultTab = 'intro' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as 'intro' | 'history' | 'licenses' | 'awards' | null;
  const [activeTab, setActiveTab] = useState<'intro' | 'history' | 'licenses' | 'awards'>(
    tabFromUrl || defaultTab
  );

  useEffect(() => {
    if (tabFromUrl && ['intro', 'history', 'licenses', 'awards'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const mainContentRef = useRef<HTMLElement>(null);

  const handleTabChange = (tab: 'intro' | 'history' | 'licenses' | 'awards') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    window.requestAnimationFrame(() => {
      scrollToSectionElement(mainContentRef.current, { behavior: 'smooth' });
    });
  };

  // History timeline data
  const timelineMilestones = [
    {
      year: '۱۳۶۶',
      title: 'شروع فعالیت و تأسیس بازرگانی تسمه اطلس',
      desc: 'آغاز فعالیت رسمی در زمینه واردات مستقیم، توزیع و ساخت تسمه‌ها و قطعات صنعتی خطوط تولید در قلب قطب صنعتی کشور (یزد).',
      metric: 'تأسیس اولیه در سال ۱۳۶۶',
      badge: 'نقطه آغاز',
    },
    {
      year: '۱۳۸۵',
      title: 'تخصصی‌سازی خطوط کاشی، سرامیک، سیمان و فولاد',
      desc: 'ورود متمرکز به ساخت و تأمین قطعات حساس کارخانجات کاشی یزد و میبد و کارخانجات فولاد و سیمان شامل رولرهای آلومینایی کوره پخت، پولی‌ها و تسمه‌های سنگین.',
      metric: 'پوشش صنایع مادر کشور',
      badge: 'توسعه بازار',
    },
    {
      year: '۱۳۹۲',
      title: 'اخذ نمایندگی انحصاری برندهای جهانی FORZA و SWR',
      desc: 'انعقاد قرارداد انحصاری واردات مستقیم پولی‌های Taper Lock، زنجیرهای ضدسایش و کوپلینگ‌های چدنی مطابق استانداردهای بین‌المللی DIN و ISO.',
      metric: 'نمایندگی رسمی و انحصاری',
      badge: 'جهش کیفیت',
    },
    {
      year: '۱۳۹۸',
      title: 'توسعه کارگاه ساخت قطعات و انبار استراتژیک دپوی فوری',
      desc: 'راه‌اندازی کارگاه ساخت و مهندسی معکوس و سوله انبار مرکزی جهت دپوی بیش از ۳۰,۰۰۰ قلم کالا و ارسال اکسپرس به سراسر کشور.',
      metric: 'دپوی ۳۰,۰۰۰+ قلم کالا',
      badge: 'زنجیره ساخت و تأمین',
    },
    {
      year: '۱۴۰۲ تا کنون',
      title: 'تحول برند «صنعت پیش» و سامانه هوش مصنوعی با شعار «پیش به صنعت»',
      desc: 'یکپارچه‌سازی فرآیند ساخت و تأمین قطعات، تسهیلات پرداخت اعتباری کارخانجات، ارسال رایگان به سراسر کشور و ابزارهای بینایی ماشین شناسایی هوشمند قطعه.',
      metric: 'برند ملی صنعت پیش | پیش به صنعت',
      badge: 'تحول فناورانه',
    },
  ];

  // Licenses & Certifications data
  const licensesList = [
    {
      id: 'iso9001',
      title: 'گواهینامه مدیریت کیفیت ISO 9001:2015',
      issuer: 'نهاد صدور گواهینامه معتبر TUV / DAS International',
      regNo: 'IR-QC-984021',
      validity: 'معتبر تا ۲۰۲۷',
      description: 'پایش و استقرار سیستم مدیریت کیفیت در فرآیندهای زنجیره تأمین، بسته‌بندی، انبارداری و بازرسی متالوژی قطعات.',
      icon: ShieldCheck,
      category: 'کیفیت و کنترل فرآیند',
    },
    {
      id: 'mimt',
      title: 'پروانه رسمی بازرگانی و تأمین تجهیزات از وزارت صمت',
      issuer: 'وزارت صنعت، معدن و تجارت جمهوری اسلامی ایران',
      regNo: 'صمت-۱۴۰۱/۷۴۸۹۲',
      validity: 'دارای تمدید دائم و فاکتور رسمی',
      description: 'مجوز قانونی فروش عمده، تأمین تجهیزات استراتژیک کارخانجات مادر، دارای کد اقتصادی و ارزش افزوده معتبر.',
      icon: FileCheck2,
      category: 'مجوز حاکمیتی و بازرگانی',
    },
    {
      id: 'iso14001',
      title: 'استاندارد زیست‌محیطی ISO 14001:2015',
      issuer: 'سیستم‌های مدیریت ایمنی و محیط‌زیست صنعتی',
      regNo: 'ENV-2023-8812',
      validity: 'معتبر تا ۲۰۲۶',
      description: 'تعهد به تأمین قطعات کم‌مصرف انرژی، بهینه‌سازی اصطکاک و انتقال قدرت سبز در خطوط کوره و پرس.',
      icon: Shield,
      category: 'محیط زیست و بهره‌وری انرژی',
    },
    {
      id: 'ce_cert',
      title: 'گواهی تطابق ایمنی اتحادیه اروپا (CE Mark)',
      issuer: 'مختص رولرهای نسوز و پولی‌های چدنی برند FORZA',
      regNo: 'CE-EU-440918',
      validity: 'استاندارد بین‌المللی تولید',
      description: 'تطابق کامل آلیاژ ریخته‌گری GG25 و سرامیک‌های دمای بالا با استانداردهای مکانیکی و ایمنی اروپا.',
      icon: Award,
      category: 'سرتیفیکیت بین‌المللی محصول',
    },
  ];

  // Honors & Awards data
  const awardsList = [
    {
      year: '۱۴۰۲',
      title: 'تندیس زرین تأمین‌کننده برتر صنایع کاشی و سرامیک',
      org: 'انجمن صنفی تولیدکنندگان کاشی و سرامیک ایران',
      desc: 'به پاس حفظ زنجیره تأمین بدون وقفه در بحران‌های فصلی و ثبت رکورد صفر ساعت توقف خطوط کوره در کارخانجات میبد و یزد.',
    },
    {
      year: '۱۴۰۱',
      title: 'لوح تقدیر مدیریت کیفیت و اصالت کالا در صنعت انتقال قدرت',
      org: 'همایش ملی بزرگان صنعت و معدن ایران',
      desc: 'تقدیر از استقرار آزمایشگاه سختی‌سنجی، کنترل ابعادی میکرونی و گارانتی کتبی تعویض بی‌قید و شرط قطعات صنعتی.',
    },
    {
      year: '۱۴۰۰',
      title: 'گواهینامه رضایت‌مندی مشتریان و وفاداری صنعتی',
      org: 'مرکز تحقیقات صنایع پیشرو کشور',
      desc: 'کسب امتیاز رضایت ۹۸.۴٪ از سوی مدیران تدارکات و سرپرستان فنی بیش از ۱۲۰ مجتمع بزرگ صنعتی و معدنی.',
    },
    {
      year: '۱۳۹۹',
      title: 'تندیس پیشگامان لجستیک صنعتی و تحویل اکسپرس',
      org: 'دبیرخانه همایش سراسری زنجیره ارزش صنعتی',
      desc: 'تقدیر از راهبری شبکه تحویل ۲۴ ساعته در شهرک‌های صنعتی و ساماندهی انبارش هوشمند قطعات پرمصرف.',
    },
  ];

  return (
    <div className="w-full text-right font-sans min-h-screen bg-[#F8F9FA] text-[#55565A]" dir="rtl">
      
      {/* 1. TOP BREADCRUMB */}
      <div className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-2xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs font-bold text-slate-500 hover:text-[#E06518] flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
              <span>صفحه اصلی</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-black text-[#55565A] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#E06518]" />
              درباره صنعت‌پیش و هویت سازمانی
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/contact"
              className="h-9 px-4 bg-[#55565A] hover:bg-[#E06518] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <PhoneCall className="w-3.5 h-3.5 text-orange-400" />
              <span>اطلاعات تماس و آدرس کارخانه</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. HERO BANNER */}
      <section className="relative w-full overflow-hidden bg-[#55565A] text-white py-12 sm:py-16 border-b border-[#414146]">
        <div className="absolute inset-0 z-0">
          <img
            src={STORE_ASSETS.whySanatDirectFactory}
            alt="صنعت‌پیش"
            className="w-full h-full object-cover object-center filter grayscale-[0.25] brightness-[0.65]"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#55565A]/95 via-[#55565A]/85 to-[#414146]/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#55565A] via-transparent to-[#55565A]/80" />
        </div>

        <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#E06518]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#E06518]" />
            <span>پشتوانه مطمئن بیش از ۲۵ سال تأمین پایدار خطوط تولید کشور</span>
          </div>

          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
              شناخت هویت، تاریخچه و
              <span className="block text-[#E06518] pt-1 drop-shadow-sm">
                اصالت صنعتی «صنعت‌پیش»
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
              صنعت‌پیش مرجع مهندسی تأمین قطعات مکانیکی، رولرهای کوره، سیستم‌های انتقال قدرت، بلبرینگ و تجهیزات دوار کارخانجات بزرگ صنعتی ایران است؛ متعهد به تضمین ۱۰۰٪ اصالت و پیشگیری از توقف خطوط.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="p-3.5 rounded-2xl bg-[#414146]/80 backdrop-blur-md border border-white/15">
              <div className="text-orange-400 font-mono font-black text-xl">+۲۵ سال</div>
              <div className="text-xs text-white font-bold">سابقه حضور در صنعت</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#414146]/80 backdrop-blur-md border border-white/15">
              <div className="text-emerald-400 font-mono font-black text-xl">+۱۸,۰۰۰</div>
              <div className="text-xs text-white font-bold">قلم کالا در انبار مرکزی</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#414146]/80 backdrop-blur-md border border-white/15">
              <div className="text-cyan-400 font-mono font-black text-xl">+۳۵۰</div>
              <div className="text-xs text-white font-bold">کارخانه و مشتری فعال</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#414146]/80 backdrop-blur-md border border-white/15">
              <div className="text-amber-400 font-mono font-black text-xl">۱۰۰٪</div>
              <div className="text-xs text-white font-bold">فاکتور رسمی و گارانتی اصالت</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MODERN TAB NAVIGATION STRIP */}
      <div className="sticky top-14 z-20 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-2.5 scrollbar-none">
            {[
              { id: 'intro', label: 'معرفی و چشم‌انداز', icon: Building2 },
              { id: 'history', label: 'تاریخچه و خط زمان', icon: History },
              { id: 'licenses', label: 'مجوزها و گواهینامه‌ها', icon: FileCheck2 },
              { id: 'awards', label: 'افتخارات و دستاوردها', icon: Award },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#E06518] text-white shadow-md shadow-orange-500/20'
                      : 'bg-[#F8F9FA] text-[#55565A] hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#E06518]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div className="mr-auto hidden md:flex items-center gap-2">
              <Link
                to="/contact"
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-[#E06518] hover:bg-orange-50 border border-slate-200 transition-colors flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-[#E06518]" />
                <span>مشاهده آدرس کارخانه و انبار</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT PANELS */}
      <main ref={mainContentRef} id="about-us-main-content" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 scroll-mt-24">
        
        {/* ===================================================================== */}
        {/* TAB 1: INTRO (معرفی و چشم‌انداز)                                      */}
        {/* ===================================================================== */}
        {activeTab === 'intro' && (
          <div className="space-y-12 animate-in fade-in duration-300">
            
            {/* Split Story Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-7 space-y-5 text-right">
                <div className="space-y-2">
                  <span className="text-xs font-black text-[#E06518] uppercase tracking-wide">
                    درباره ما | صنعت پیش (پیش به صنعت | بازرگانی تسمه اطلس از سال ۱۳۶۶)
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#2B313A] leading-snug">
                    تولید، ساخت و تأمین مهندسی قطعات برای خطوط تولید پیوسته کشور
                  </h2>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed font-normal text-justify">
                  مجموعه «صنعت پیش» (برآمده از پیشینه درخشان بازرگانی تسمه اطلس از سال ۱۳۶۶)، با بیش از ۳۷ سال فعالیت پیوسته در قلب قطب صنعتی کشور، هم تولیدکننده و سازنده تخصصی قطعات خطوط تولید است و هم بزرگ‌ترین مرجع بازرگانی و واردات مستقیم برندهای معتبر بین‌المللی نظیر FORZA و SWR.
                </p>

                <p className="text-sm text-slate-600 leading-relaxed font-normal text-justify">
                  امروز با اتکا به کارگاه‌های ساخت، بیش از ۳۰ هزار قلم کالا دپوی آماده در انبار مرکزی، شرایط پرداختی منعطف و تسهیلات خرید برای کارخانجات، و ارسال کاملاً رایگان به سراسر کشور، مفتخریم که در صنایع کاشی و سرامیک، سیمان، فولاد و معادن، صنایع غذایی، دارویی، بسته‌بندی و پتروشیمی همراه قدرتمند صنعتگران ایران زمین هستیم.
                </p>

                {/* 3 Value Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <ShieldCheck className="w-5 h-5 text-[#E06518]" />
                    <div className="text-xs font-black text-[#2B313A]">تضمین ۱۰۰٪ آلیاژ</div>
                    <div className="text-[11px] text-slate-500">برگه آنالیز متریال و آزمون کوارتر</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <Factory className="w-5 h-5 text-emerald-600" />
                    <div className="text-xs font-black text-[#2B313A]">نمایندگی مستقیم</div>
                    <div className="text-[11px] text-slate-500">حذف زنجیره واسطه‌ها و قیمت دست‌اول</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <Clock className="w-5 h-5 text-cyan-600" />
                    <div className="text-xs font-black text-[#2B313A]">پاسخگویی ۲۴/۷</div>
                    <div className="text-[11px] text-slate-500">تیم پشتیبانی اورژانسی خطوط شبانه‌روزی</div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#55565A] hover:bg-[#E06518] text-white text-xs sm:text-sm font-black transition-colors shadow-xs"
                  >
                    <span>درخواست بازدید کارشناس یا استعلام رسمی</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-lg relative aspect-[4/3] bg-slate-900 group">
                  <img
                    src={STORE_ASSETS.whySanatCadEngineering}
                    alt="مشاوره فنی صنعت‌پیش"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 right-4 left-4 text-white text-right space-y-1">
                    <span className="text-[11px] font-bold text-orange-400">آزمایشگاه و دپارتمان تطبیق مهندسی</span>
                    <h3 className="text-sm font-black">پایش میکرونی قطعات پیش از تحویل به کارخانجات</h3>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Warehouse className="w-8 h-8 text-[#E06518]" />
                    <div className="text-right">
                      <div className="text-xs font-black text-[#2B313A]">انبار استراتژیک میبد و یزد</div>
                      <div className="text-[11px] text-slate-500">توزیع اختصاصی به شهرک‌های صنعتی کاشی</div>
                    </div>
                  </div>
                  <Link
                    to="/contact?tab=factory"
                    className="text-xs font-bold text-[#E06518] hover:underline"
                  >
                    مسیریابی
                  </Link>
                </div>
              </div>
            </div>

            {/* Core Mission and Vision Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="p-7 rounded-3xl bg-white border border-slate-200 space-y-3 text-right shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#E06518] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-[#2B313A]">چشم‌انداز سازمانی ما</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  تبدیل شدن به مرجع شماره یک و هوشمند تأمین قطعات کارخانجات در غرب آسیا با پیاده‌سازی کامل استانداردهای زنجیره تأمین دیجیتال، هوش مصنوعی پیش‌بین خرابی‌ها، و دستیابی به ضریب دسترسی ۹۹.۹٪ برای قطعات استراتژیک خطوط مادر.
                </p>
              </div>

              <div className="p-7 rounded-3xl bg-white border border-slate-200 space-y-3 text-right shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-[#2B313A]">ماموریت ما در صنعت</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  ارائه سریع، اقتصادی و با اصالت قطعات صنعتی با بالاترین بازدهی، حذف استرس ناشی از قطعات تقلبی از دوش مدیران فنی کارخانجات، و ارائه فاکتور رسمی شفاف با کد اقتصادی معتبر برای سهولت امور مالی شرکت‌ها.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: HISTORY (تاریخچه و خط زمان)                                   */}
        {/* ===================================================================== */}
        {activeTab === 'history' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-right space-y-2 max-w-3xl">
              <span className="text-xs font-black text-[#E06518] uppercase">تاریخچه و اصالت برند</span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#2B313A]">
                مسیر ربع قرن خدمت و همراهی با صنایع ایران
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                از یک دفتر بازرگانی قطعات مکانیکی در سال ۱۳۷۸ تا تبدیل شدن به یکی از جامع‌ترین هلدینگ‌های تأمین قطعات خطوط تولید کشور:
              </p>
            </div>

            {/* Vertical Interactive Timeline */}
            <div className="relative border-r-2 border-orange-300/80 mr-4 sm:mr-8 space-y-8 pt-4 pb-6">
              {timelineMilestones.map((milestone, idx) => (
                <div key={idx} className="relative pr-6 sm:pr-8 group">
                  {/* Timeline Dot */}
                  <span className="absolute -right-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-3 border-[#E06518] group-hover:scale-125 transition-transform shadow-sm" />

                  <div className="p-6 rounded-2xl bg-white border border-slate-200 group-hover:border-[#E06518] shadow-2xs group-hover:shadow-md transition-all space-y-3 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg sm:text-xl font-black font-mono text-[#E06518]">
                          {milestone.year}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">
                          {milestone.title}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-md bg-orange-50 text-[#E06518] text-[11px] font-bold border border-orange-200">
                        {milestone.badge}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {milestone.desc}
                    </p>

                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#55565A]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>دستاورد کلیدی: {milestone.metric}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 rounded-2xl bg-[#55565A] text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-right space-y-1">
                <h4 className="text-sm font-black text-white">آینده صنعت پیش: هوش مصنوعی و خودکارسازی تأمین با شعار «پیش به صنعت»</h4>
                <p className="text-xs text-slate-200">
                  در حال پیاده‌سازی راهکارهای اتصال مستقیم ERP کارخانجات به دپوی بیش از ۳۰,۰۰۰ قلم کالای انبار هوشمند صنعت پیش هستیم.
                </p>
              </div>
              <Link
                to="/ai-consult"
                className="px-5 py-2.5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-black rounded-xl shrink-0 transition-colors"
              >
                آشنایی با سامانه AI FORZA
              </Link>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: LICENSES & CERTIFICATES (مجوزها و گواهینامه‌ها)                */}
        {/* ===================================================================== */}
        {activeTab === 'licenses' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-right space-y-2 max-w-3xl">
              <span className="text-xs font-black text-[#E06518] uppercase">مجوزها و گواهینامه‌های قانونی</span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#2B313A]">
                شفافیت قانونی، فاکتور رسمی و سرتیفیکیت‌های معتبر بین‌المللی
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                تمامی معاملات با ارائه پیش‌فاکتور و فاکتور رسمی ارزش افزوده مطابق قوانین سازمان امور مالیاتی کشور و سرتیفیکیت‌های تضمین استاندارد اروپایی انجام می‌شود:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {licensesList.map((lic) => {
                const Icon = lic.icon;
                return (
                  <div
                    key={lic.id}
                    className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-[#E06518] shadow-2xs hover:shadow-lg transition-all text-right space-y-4 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 text-[#E06518] flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200">
                          {lic.category}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-black text-[#2B313A] leading-snug group-hover:text-[#E06518] transition-colors">
                          {lic.title}
                        </h3>
                        <div className="text-xs text-slate-500 font-medium">مرجع صادرکننده: {lic.issuer}</div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {lic.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                      <div className="text-slate-500 font-sans">
                        <span>شماره ثبتی: </span>
                        <span className="font-mono font-bold text-slate-800">{lic.regNo}</span>
                      </div>
                      <span className="text-emerald-600 font-sans font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lic.validity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Official Legal Info Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#55565A] text-white space-y-4">
              <div className="flex items-center gap-2.5 text-orange-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-[#E06518]" />
                <span>اطلاعات هویتی و ثبت حقوقی شرکت:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 space-y-1">
                  <span className="text-slate-300">شناسه ملی شرکت:</span>
                  <div className="font-mono font-bold text-white text-sm">۱۰۸۶۱۷۲۸۳۹۰</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 space-y-1">
                  <span className="text-slate-300">کد اقتصادی معتبر:</span>
                  <div className="font-mono font-bold text-white text-sm">۴۱۱۵۶۸۳۹۲۱۱۸</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 space-y-1">
                  <span className="text-slate-300">شماره ثبت شرکت‌ها:</span>
                  <div className="font-mono font-bold text-white text-sm">۴۲۹۰۸</div>
                </div>
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/10 space-y-1">
                  <span className="text-slate-300">سیستم ارزش افزوده:</span>
                  <div className="font-sans font-bold text-emerald-400 text-sm">عضویت دائم فعال</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: AWARDS & ACHIEVEMENTS (افتخارات و دستاوردها)                   */}
        {/* ===================================================================== */}
        {activeTab === 'awards' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-right space-y-2 max-w-3xl">
              <span className="text-xs font-black text-[#E06518] uppercase">افتخارات و دستاوردها</span>
              <h2 className="text-2xl sm:text-3xl font-black text-[#2B313A]">
                تندیس‌ها، افتخارات ملی و تاییدیه کارخانجات بزرگ
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                ارزشمندترین افتخار ما، رضایت مدیران فنی و پایداری خطوط تولید کارخانجاتی است که سال‌ها بدون وقفه با ما همکاری دارند:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {awardsList.map((aw, idx) => (
                <div
                  key={idx}
                  className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-[#E06518] shadow-2xs hover:shadow-lg transition-all text-right space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Award className="w-5 h-5" />
                    </div>
                    <span className="text-base font-black font-mono text-[#E06518]">
                      سال {aw.year}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-[#2B313A]">{aw.title}</h3>
                  <div className="text-xs font-bold text-[#E06518]">{aw.org}</div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {aw.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Clients Endorsement Quote Strip */}
            <div className="p-8 rounded-3xl bg-gradient-to-r from-[#55565A] to-[#414146] text-white text-right space-y-4">
              <div className="text-xs font-black text-orange-400">نقل قول مدیران تدارکات:</div>
              <blockquote className="text-sm sm:text-base text-slate-100 leading-relaxed font-medium italic">
                «حضور انبار مرکزی صنعت‌پیش در میبد و اعزام شبانه‌روزی رولرهای کوره AL70، بارها خطوط تولید ما را از خواب چندروزه و خسارات میلیاردی نجات داده است.»
              </blockquote>
              <div className="text-xs text-slate-300">
                — مدیر نگهداری و تعمیرات مجتمع کاشی میبد
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 5. FOOTER CTA */}
      <section className="bg-white border-t border-slate-200 py-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-right space-y-1">
            <h4 className="text-base font-black text-[#2B313A]">نیاز به آدرس دقیق کارخانه یا گفت‌وگوی مستقیم دارید؟</h4>
            <p className="text-xs text-slate-500">
              همکاران ما در دفاتر میبد، یزد و تهران مشتاق میزبانی حضوری و پاسخگویی به استعلامات شما هستند.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/contact"
              className="h-11 px-6 bg-[#E06518] hover:bg-[#C95210] text-white text-xs sm:text-sm font-black rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              <PhoneCall className="w-4 h-4" />
              <span>صفحه تماس و آدرس کارخانه</span>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};
