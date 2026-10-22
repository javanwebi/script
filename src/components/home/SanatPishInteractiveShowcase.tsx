import React, { useState } from 'react';
import { PartIdentificationLink as Link } from '../search/PartIdentificationProvider';
import {
  Factory,
  ShieldCheck,
  Warehouse,
  Truck,
  Sparkles,
  Phone,
  MessageCircle,
  MapPin,
  ArrowLeft,
  ChevronLeft,
  Clock,
  Layers,
  Award,
  CheckCircle2,
  FileText,
  Percent,
  Cpu,
} from 'lucide-react';
import { STORE_ASSETS } from '../../assets/images';

export interface ShowcasePillar {
  id: number;
  menuNum: string;
  menuTitle: string;
  menuSubtitle: string;
  tag: string;
  badgeText: string;
  headline: string;
  subheadline: string;
  narrative: string;
  bulletPoints: {
    title: string;
    desc: string;
  }[];
  image: string;
  metrics: {
    value: string;
    label: string;
  }[];
  ctaText: string;
  ctaAction?: 'consult' | 'visualSearch' | 'products' | 'contact' | 'call';
  ctaLink?: string;
}

interface SanatPishInteractiveShowcaseProps {
  onOpenConsult?: () => void;
  onOpenVisualSearch?: () => void;
}

export const SanatPishInteractiveShowcase: React.FC<SanatPishInteractiveShowcaseProps> = ({
  onOpenConsult,
  onOpenVisualSearch,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const pillars: ShowcasePillar[] = [
    {
      id: 0,
      menuNum: '۰۱',
      menuTitle: 'تولید و ساخت سفارشی قطعات',
      menuSubtitle: 'کارگاه تراشکاری، قالب‌سازی و مهندسی معکوس',
      tag: 'تولید داخلی و مهندسی معکوس',
      badgeText: 'تولیدکننده تخصصی قطعات خطوط',
      headline: 'تولید و ماشین‌کاری قطعات خطوط تولید کارخانجات',
      subheadline: 'رفع فوری وابستگی‌های تحریمی و ساخت با دقت میکرومتری',
      narrative:
        'صنعت پیش تنها یک بازرگانی ساده نیست؛ ما خود سازنده و تولیدکننده قطعات صنعتی هستیم. با تکیه بر کارگاه‌های مجهز ماشین‌کاری CNC، قالب‌سازی و اسکن سه‌بعدی اپتیکال، قطعات کمیاب یا مستهلک خطوط تولید کارخانجات را با آلیاژ فابریک مهندسی معکوس کرده و با بالاترین استانداردهای متالوژی تولید می‌کنیم تا توقف خطوط صنعتی کشور به صفر برسد.',
      bulletPoints: [
        {
          title: 'ساخت قطعات تحریمی و نایاب',
          desc: 'تولید انواع پولی‌های چندشیاره خاص، شفت‌ها، دنده‌ها و اتصالات سنگین بر اساس نمونه یا نقشه CAD.',
        },
        {
          title: 'کنترل کیفیت و تست متالوژی (QC)',
          desc: 'انجام آزمون‌های سختی‌سنجی، بالانس دینامیکی و ارتعاش‌سنجی قطعات پیش از تحویل به کارخانه.',
        },
        {
          title: 'گارانتی کتبی تعویض و اصالت متریال',
          desc: 'تضمین صددرصدی تطابق کارکرد قطعه در دمای کاری، سایش و تنش‌های مکانیکی خط تولید.',
        },
      ],
      image: STORE_ASSETS.whySanatCadEngineering || STORE_ASSETS.reverseEngineeringLab,
      metrics: [
        { value: '۱۰۰٪', label: 'تطابق با استاندارد DIN' },
        { value: '۰ ساعت', label: 'توقف ناخواسته خط تولید' },
      ],
      ctaText: 'استعلام ساخت یا ارسال نقشه قطعه',
      ctaAction: 'consult',
    },
    {
      id: 1,
      menuNum: '۰۲',
      menuTitle: 'کیفیت سطح یک و واردات مستقیم',
      menuSubtitle: 'نمایندگی رسمی برندهای FORZA و SWR و اطلس',
      tag: 'واردات بدون واسطه',
      badgeText: 'اصالت تضمین‌شده قطعات اروپایی و آسیایی',
      headline: 'تأمین دست‌اول از مبدأ با شناسنامه متالوژی معتبر',
      subheadline: 'حذف دلالان و کاهش مستقیم ۲۰ تا ۳۵ درصدی هزینه‌های تدارکات',
      narrative:
        'با حذف واسطه‌ها و شبکه‌های فرعی، صنعت پیش محصولات اورجینال را مستقیم از خطوط معتبر وارد می‌نماید. محصولات انحصاری FORZA و SWR در کنار تولیدات باکیفیت اطلس، دارای برگه آنالیز شیمیایی و گواهی بازرسی فابریک هستند تا مدیران خرید و سرپرستان فنی با اطمینان کامل روی خطوط نصب کنند.',
      bulletPoints: [
        {
          title: 'نمایندگی انحصاری برندهای معتبر',
          desc: 'پوشش کامل انواع پولی‌های تیپرلاک، بلبرینگ‌ها، یاتاقان‌ها و زنجیرهای استاندارد DIN و ISO.',
        },
        {
          title: 'برگه آنالیز متریال و سرتیفیکیت رسمی',
          desc: 'ارائه مدارک متالوژی، شماره ردیابی (Batch Number) و صدور فاکتور رسمی شرکتی با کد اقتصادی.',
        },
        {
          title: 'همکاری مستقیم با سازندگان جهانی',
          desc: 'قابلیت ثبت سفارش تأمین قطعات خاص و تحویل در سریع‌ترین زمان ممکن از گمرکات رسمی.',
        },
      ],
      image: STORE_ASSETS.forzaSwrDualBanner || STORE_ASSETS.brandsFullbleedBg,
      metrics: [
        { value: '۲۵٪-', label: 'صرفه‌جویی در بهای تمام‌شده' },
        { value: 'ISO 9001', label: 'سیستم پایش مدیریت کیفیت' },
      ],
      ctaText: 'مشاهده کاتالوگ قطعات FORZA و SWR',
      ctaLink: '/category/swr-forza-exclusive',
    },
    {
      id: 2,
      menuNum: '۰۳',
      menuTitle: 'انبارداری وسیع و ۳۰,۰۰۰ قلم کالا',
      menuSubtitle: 'دپوی استراتژیک و تحویل فوری به کارخانجات',
      tag: 'دپوی مرکزی قطعات خطوط تولید',
      badgeText: 'بیش از ۳۰ هزار قلم کالا آماده تحویل',
      headline: 'بزرگ‌ترین انبار قطعات مصرفی و یدکی صنایع در مرکز کشور',
      subheadline: 'توقف خط تولید، هرگز! ارسال در کمتر از ۲۴ ساعت کاری',
      narrative:
        'مجموعه بازرگانی تسمه اطلس از سال ۱۳۶۶ تا امروز با سرمایه‌گذاری پیوسته در سوله انبار مرکزی یزد و میبد، بزرگ‌ترین سبد قطعات آماده تحویل را گرد آورده است. بیش از ۳۰,۰۰۰ پارت‌نامبر شامل تسمه‌های صنعتی، رولرهای کوره، پولی، بلبرینگ و زنجیر همیشه در انبار دپو شده تا هیچ خط تولیدی منتظر قطعه نماند.',
      bulletPoints: [
        {
          title: 'موجودی تضمین‌شده قطعات پرمصرف',
          desc: 'دپوی انبوه انواع تسمه‌های تایمینگ، شیاردار، وی‌بلت، برزنت و نوار نقاله‌های صنایع سنگین.',
        },
        {
          title: 'سیستم مکانیزه انبارداری و کدینگ',
          desc: 'ردیابی سریع کد فنی، ابعاد میلیمتری و تطبیق معادل‌های فنی قطعات مستهلک در چند ثانیه.',
        },
        {
          title: 'آماده‌سازی و بسته‌بندی در همان روز',
          desc: 'سفارشات ثبت‌شده تا پیش از ظهر، در همان روز کاری پس از بازرسی نهایی بارگیری می‌شوند.',
        },
      ],
      image: STORE_ASSETS.partsWarehouseVault || STORE_ASSETS.heroBanner,
      metrics: [
        { value: '+۳۰,۰۰۰', label: 'قلم کالای موجود در انبار' },
        { value: '< ۲۴h', label: 'میانگین زمان تحویل سفارش' },
      ],
      ctaText: 'مشاهده کاتالوگ جامع قطعات موجود',
      ctaLink: '/products',
    },
    {
      id: 3,
      menuNum: '۰۴',
      menuTitle: 'ارسال رایگان سراسری و شرایط پرداختی',
      menuSubtitle: 'تسهیلات خرید و ارج نهادن به اعتماد مشتریان',
      tag: 'تسهیلات خرید B2B',
      badgeText: 'ارسال رایگان به کلیه شهرک‌های صنعتی ایران',
      headline: 'همکاری پایدار، قیمت رقابتی و شرایط پرداخت منعطف',
      subheadline: 'افتخار ما ارج نهادن به اعتماد صاحبان صنایع و مدیران کارخانجات است',
      narrative:
        'برای حمایت واقعی از تولیدکنندگان کشور و جبران کمبود نقدینگی، صنعت پیش تسهیلات ویژه پرداختی، امکان خرید اعتباری و پرداخت مدت‌دار بر مبنای قراردادهای دوره‌ای را فراهم کرده است. علاوه بر قیمت‌های دست‌اول رقابتی، کلیه سفارشات با ارسال کاملاً رایگان با باربری‌های مطمئن راهی اقصی نقاط کشور می‌گردند.',
      bulletPoints: [
        {
          title: 'ارسال رایگان به سراسر کشور',
          desc: 'حمل مطمئن و بدون هزینه باربری به کلیه استان‌ها و شهرک‌های صنعتی بدون محدودیت حجم سفارش.',
        },
        {
          title: 'قیمت رقابتی و شرایط پرداختی تسهیل‌شده',
          desc: 'امکان عقد قراردادهای تأمین سالانه، پرداخت اعتباری مرحله‌ای و تخفیف‌های تیراژ بالا برای کارخانجات.',
        },
        {
          title: 'شفافیت مالی و فاکتور رسمی',
          desc: 'صدور فاکتور رسمی مطابق قوانین مالیاتی همراه با شناسه ملی و کد اقتصادی معتبر شرکتی.',
        },
      ],
      image: STORE_ASSETS.whySanatExpressDelivery || STORE_ASSETS.heroSteelCoils,
      metrics: [
        { value: '۱۰۰٪', label: 'ارسال رایگان سراسر ایران' },
        { value: 'منعطف', label: 'شرایط تسویه و تسهیلات خرید' },
      ],
      ctaText: 'درخواست شرایط همکاری و پیش‌فاکتور',
      ctaAction: 'consult',
    },
    {
      id: 4,
      menuNum: '۰۵',
      menuTitle: 'مشاوره هوشمند با شعار «پیش به صنعت»',
      menuSubtitle: 'شناسایی قطعه با هوش مصنوعی و ربات مهندس مشاور',
      tag: 'فناوری هوش مصنوعی صنعتی',
      badgeText: 'پیش به صنعت | هوش مصنوعی خطوط تولید',
      headline: 'شناسایی هوشمند قطعه مستهلک و تطبیق مشخصات فنی',
      subheadline: 'با عکس گرفتن از قطعه یا پلاک دستگاه، معادل دقیق را در انبار پیدا کنید',
      narrative:
        'دیگر نیازی به باز کردن کامل ماشین‌آلات یا سردرگمی در پارت‌نامبرهای ناخوانا نیست! با فناوری هوش مصنوعی صنعت پیش و شعار «پیش به صنعت»، کافیست از قطعه کهنه، تسمه خورده‌شده یا پلاک تجهیزات عکاسی کنید؛ سامانه بینایی ماشین ابعاد و مشخصات را تخمین زده و بهترین قطعه استاندارد آماده تحویل را به شما پیشنهاد می‌دهد.',
      bulletPoints: [
        {
          title: 'شناسایی تصویری قطعات خط تولید',
          desc: 'تطبیق تصاویر پولی، تسمه، رولر و اتصالات با الگوریتم‌های هوش مصنوعی و پایگاه داده ۳۰,۰۰۰ کالا.',
        },
        {
          title: 'مشاور فنی هوشمند (AI Engineer)',
          desc: 'محاسبه طول نامی تسمه، نسبت دور پولی و پیشنهاد مشخصات بهینه بر اساس توان الکتروموتور و گشتاور.',
        },
        {
          title: 'مشاوره رایگان تلفنی و حضوری',
          desc: 'تأیید نهایی توسط مهندسین مکانیک و متالوژی مقیم پیش از ارسال و صدور فاکتور.',
        },
      ],
      image: STORE_ASSETS.aiConsultRobot || STORE_ASSETS.aiSearchMobile,
      metrics: [
        { value: 'پیش به صنعت', label: 'شعار همراهی ما با صنعتگران' },
        { value: '< ۵ ثانیه', label: 'شناسایی هوشمند مشخصات قطعه' },
      ],
      ctaText: 'شروع شناسایی قطعه با هوش مصنوعی',
      ctaLink: '/identify-part',
      ctaAction: 'visualSearch',
    },
    {
      id: 5,
      menuNum: '۰۶',
      menuTitle: 'پوشش صنایع گوناگون کشور',
      menuSubtitle: 'کاشی و سرامیک، سیمان، فولاد، غذایی، دارویی و پتروشیمی',
      tag: 'تخصصی برای هر صنعت',
      badgeText: 'تأمین تخصصی خطوط تولید مادر',
      headline: 'همراه قدرتمند صنایع استراتژیک ایران از سال ۱۳۶۶',
      subheadline: 'پوشش جامع زنجیره تأمین خطوط تولید پیوسته و کارخانجات سنگین',
      narrative:
        'مشتریان ما طیف وسیعی از صنایع حیاتی کشور را تشکیل می‌دهند؛ از مجتمع‌های بزرگ کاشی و سرامیک میبد و یزد، کارخانجات سیمان، نورد فولاد و صنایع معدنی گرفته تا خطوط بهداشتی مواد غذایی، صنایع دارویی، بسته‌بندی و پتروشیمی. برای هر صنعت، قطعه متناسب با شرایط دما، رطوبت، اسیدیته و سایش تأمین می‌گردد.',
      bulletPoints: [
        {
          title: 'صنایع کاشی، سرامیک و لعاب',
          desc: 'رولرهای آلومینایی کوره پخت، تسمه‌های پلی‌اورتان و حرارتی، پولی‌های مخصوص خط سورت و بسته‌بندی.',
        },
        {
          title: 'فولاد، سیمان و صنایع معدنی',
          desc: 'تسمه‌های ضدسایش لاستیکی و منجیددار، زنجیرهای باربر سنگین و یاتاقان‌های مقاوم در برابر گردوغبار.',
        },
        {
          title: 'صنایع غذایی، دارویی و پتروشیمی',
          desc: 'تسمه‌های بهداشتی دارای گرید FDA، استیل ضدزنگ و کوپلینگ‌های مقاوم در برابر ارتعاشات مداوم.',
        },
      ],
      image: STORE_ASSETS.industries.ceramic || STORE_ASSETS.industries.bgPlant,
      metrics: [
        { value: '+۴۵۰', label: 'کارخانه و مجتمع تولیدی همکار' },
        { value: '۳۷+ سال', label: 'سابقه مستمر از سال ۱۳۶۶' },
      ],
      ctaText: 'مشاهده قطعات به تفکیک صنایع',
      ctaLink: '/#industries',
    },
  ];

  const currentPillar = pillars[activeIndex];

  const handleCtaClick = () => {
    if (currentPillar.ctaAction === 'consult' && onOpenConsult) {
      onOpenConsult();
    } else if (currentPillar.ctaAction === 'visualSearch' && onOpenVisualSearch) {
      onOpenVisualSearch();
    }
  };

  return (
    <section
      id="sanatpish-showcase"
      className="relative w-full py-12 sm:py-16 bg-white text-[#2B313A] border-y border-[#CBD2D8] overflow-hidden"
      dir="rtl"
    >
      {/* Background Subtle Industrial Tech Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#2b313a0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
      <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-orange-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-slate-300/[0.15] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10">
        
        {/* ===================================================================== */}
        {/* 1. SECTION HEADER (Brand Dossier & Slogan: پیش به صنعت)                 */}
        {/* ===================================================================== */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-[#CBD2D8]">
          <div className="space-y-3 text-right max-w-3xl">
            {/* Slogan Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E06518]/10 border border-[#E06518]/25 text-xs font-black text-[#E06518]">
              <Sparkles className="w-3.5 h-3.5 text-[#E06518]" />
              <span>پیش به صنعت | هویت، خدمات و توانمندی‌های صنعت پیش</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#2B313A] tracking-tight leading-tight">
              <span>صنعت پیش؛ تولید، ساخت و تأمین</span>
              <span className="block text-[#E06518] pt-1">
                قطعات خطوط تولید صنایع سراسر کشور
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-[#55565A] font-medium leading-relaxed max-w-2xl text-justify">
              بازرگانی تسمه اطلس از سال ۱۳۶۶ تا امروز با اتکا به کارگاه‌های ساخت، واردات مستقیم برندهای معتبر بین‌المللی نظیر FORZA و SWR و انباری به وسعت بیش از ۳۰ هزار قلم کالا، پشتیبان استوار صنایع ایران است.
            </p>
          </div>

          {/* Quick Heritage Trust Seal Badge */}
          <div className="bg-[#2B313A] text-white p-4 rounded-2xl border border-[#3F4550] shadow-sm flex items-center gap-3.5 shrink-0 self-start lg:self-auto">
            <div className="w-11 h-11 rounded-xl bg-[#E06518] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-orange-300 block">
                تأسیس ۱۳۶۶ | ۳۷+ سال سابقه
              </span>
              <span className="text-xs sm:text-sm font-black text-white block">
                بازرگانی تسمه اطلس (صنعت پیش)
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* OFFICIAL BRAND PARTNERS BAR (FORZA & SWR LOGOS)                      */}
        {/* ===================================================================== */}
        <div className="bg-gradient-to-r from-[#2B313A] via-[#353D4A] to-[#2B313A] p-4 sm:p-5 rounded-2xl border border-[#48505E] shadow-md text-white flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-right">
            <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-orange-300 block">برندهای انحصاری تحت پوشش صنعت پیش</span>
              <h3 className="text-sm sm:text-base font-black text-white">نمایندگی رسمی و واردات مستقیم محصولات FORZA و SWR</h3>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 shrink-0">
            <div className="flex items-center gap-2 px-2 py-1">
              <img src={STORE_ASSETS.logoForza} alt="FORZA Brand" className="h-6 sm:h-7 w-auto object-contain filter drop-shadow" />
              <span className="text-xs font-black text-white">FORZA</span>
            </div>
            <span className="text-xs text-slate-400 font-bold">&</span>
            <div className="flex items-center gap-2 px-2 py-1">
              <img src={STORE_ASSETS.swrLogo} alt="SWR Brand" className="h-6 sm:h-7 w-auto object-contain filter drop-shadow" />
              <span className="text-xs font-black text-white">SWR</span>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. TOP VALUE PROPOSITION STRIP (همکاری با ما | ۴ ستون اعتماد مشتری)      */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#F8F9FA] border border-[#CBD2D8] hover:border-[#E06518] p-3.5 sm:p-4 rounded-xl transition-all shadow-2xs group">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100/80 text-[#E06518] flex items-center justify-center shrink-0">
                <Percent className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-[#2B313A] group-hover:text-[#E06518] transition-colors">
                قیمت رقابتی و شرایط پرداختی
              </span>
            </div>
            <p className="text-[11px] text-[#55565A] leading-relaxed">
              تسهیلات خرید، شرایط تسویه مدت‌دار ویژه کارخانجات و حذف کامل واسطه‌ها.
            </p>
          </div>

          <div className="bg-[#F8F9FA] border border-[#CBD2D8] hover:border-[#E06518] p-3.5 sm:p-4 rounded-xl transition-all shadow-2xs group">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100/80 text-[#E06518] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-[#2B313A] group-hover:text-[#E06518] transition-colors">
                کیفیت سطح یک و واردات مستقیم
              </span>
            </div>
            <p className="text-[11px] text-[#55565A] leading-relaxed">
              برندهای معتبر FORZA و SWR و استانداردهای DIN با شناسنامه فنی معتبر.
            </p>
          </div>

          <div className="bg-[#F8F9FA] border border-[#CBD2D8] hover:border-[#E06518] p-3.5 sm:p-4 rounded-xl transition-all shadow-2xs group">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100/80 text-[#E06518] flex items-center justify-center shrink-0">
                <Warehouse className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-[#2B313A] group-hover:text-[#E06518] transition-colors">
                انبارداری وسیع و تحویل فوری
              </span>
            </div>
            <p className="text-[11px] text-[#55565A] leading-relaxed">
              بیش از ۳۰,۰۰۰ قلم کالا موجود در سوله انبار مرکزی جهت جلوگیری از توقف خط.
            </p>
          </div>

          <div className="bg-[#F8F9FA] border border-[#CBD2D8] hover:border-[#E06518] p-3.5 sm:p-4 rounded-xl transition-all shadow-2xs group">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-orange-100/80 text-[#E06518] flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-black text-[#2B313A] group-hover:text-[#E06518] transition-colors">
                ارسال رایگان به سراسر کشور
              </span>
            </div>
            <p className="text-[11px] text-[#55565A] leading-relaxed">
              تسهیلات ویژه ارسال مطمئن به تمام شهرک‌های صنعتی ایران در ارج نهادن به اعتماد.
            </p>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. SPLIT-PANE INTERACTIVE SHOWCASE (One Image + Menu on Side)          */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch pt-2">
          
          {/* RIGHT COLUMN (In RTL): Interactive Chapter Menu List (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 px-1">
                <span className="text-xs font-black text-[#2B313A]">
                  سرفصل‌های اختصاصی صنعت پیش
                </span>
                <span className="text-[11px] font-mono text-[#777A7D]">
                  {pillars.length} محور توانمندی
                </span>
              </div>

              {pillars.map((pillar, idx) => {
                const isActive = activeIndex === idx;
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`w-full text-right p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 flex items-start gap-3.5 cursor-pointer relative overflow-hidden group ${
                      isActive
                        ? 'bg-white border-[#E06518] shadow-md ring-2 ring-orange-500/10'
                        : 'bg-[#F8F9FA] hover:bg-white border-[#CBD2D8] hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    {/* Active Right Accent Line */}
                    {isActive && (
                      <span className="absolute top-0 bottom-0 right-0 w-1.5 bg-[#E06518]" />
                    )}

                    {/* Number Badge */}
                    <span
                      className={`w-8 h-8 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                        isActive
                          ? 'bg-[#E06518] text-white shadow-xs'
                          : 'bg-white border border-[#CBD2D8] text-[#55565A] group-hover:text-[#2B313A]'
                      }`}
                    >
                      {pillar.menuNum}
                    </span>

                    {/* Text Container */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className={`text-xs sm:text-sm font-extrabold tracking-tight truncate ${
                            isActive ? 'text-[#E06518]' : 'text-[#2B313A] group-hover:text-black'
                          }`}
                        >
                          {pillar.menuTitle}
                        </h4>
                        <ChevronLeft
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isActive
                              ? 'text-[#E06518] -translate-x-1'
                              : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                      </div>
                      <p className="text-[11px] text-[#55565A] line-clamp-1 font-normal">
                        {pillar.menuSubtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Direct Instant Hotline Callout */}
            <div className="mt-4 p-4 rounded-2xl bg-[#2B313A] text-white border border-[#3F4550] shadow-sm flex items-center justify-between gap-3">
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-orange-300 font-bold block">
                  نیاز به تأمین فوری قطعه دارید؟
                </span>
                <span className="text-xs font-bold text-white block">
                  تماس مستقیم با واحد بازرگانی یزد
                </span>
              </div>
              <a
                href="tel:035352547034"
                className="h-9 px-3.5 bg-[#E06518] hover:bg-[#C95210] text-white rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
                dir="ltr"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>۰۳۵-۳۵۲۵۴۷۰۳۴</span>
              </a>
            </div>
          </div>

          {/* LEFT COLUMN (In RTL): The Synchronized Showcase Display (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#CBD2D8] shadow-md p-5 sm:p-7 flex flex-col justify-between space-y-6 relative overflow-hidden transition-all duration-300">
            
            {/* Top Accent Strip */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-[#E06518] to-transparent" />

            <div className="space-y-5">
              {/* Synchronized Hero Image with Badge */}
              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-[#CBD2D8] shadow-inner bg-slate-900 group">
                <img
                  src={currentPillar.image}
                  alt={currentPillar.headline}
                  className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                />
                
                {/* Contrast overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />

                {/* Top Badge */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-[#2B313A]/90 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow-xs">
                    {currentPillar.tag}
                  </span>
                </div>

                {/* Bottom Overlay Label */}
                <div className="absolute bottom-3 right-3 left-3 z-10 flex items-center justify-between text-white">
                  <span className="text-xs sm:text-sm font-extrabold drop-shadow-sm truncate">
                    {currentPillar.badgeText}
                  </span>
                  <div className="flex items-center gap-1 bg-[#E06518] text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono shrink-0 shadow-xs">
                    <span>{currentPillar.menuNum}</span>
                    <span>/</span>
                    <span>۰۶</span>
                  </div>
                </div>
              </div>

              {/* Title & Narrative */}
              <div className="space-y-2 text-right">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E06518]" />
                  <span className="text-xs font-black text-[#E06518]">
                    {currentPillar.subheadline}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#2B313A] leading-snug">
                  {currentPillar.headline}
                </h3>
                <p className="text-xs sm:text-[13px] text-[#55565A] leading-relaxed font-normal text-justify">
                  {currentPillar.narrative}
                </p>
              </div>

              {/* Key Highlights / Bullets */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {currentPillar.bulletPoints.map((point, pIdx) => (
                  <div key={pIdx} className="flex items-start gap-2.5 text-right">
                    <CheckCircle2 className="w-4 h-4 text-[#E06518] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-xs">
                      <strong className="font-bold text-[#2B313A]">{point.title}: </strong>
                      <span className="text-[#55565A] font-normal leading-relaxed">{point.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Proof Metrics & Action Row */}
            <div className="pt-4 border-t border-[#CBD2D8] flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Metrics Pill Boxes */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {currentPillar.metrics.map((m, mIdx) => (
                  <div
                    key={mIdx}
                    className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#F8F9FA] border border-[#CBD2D8] text-center min-w-[110px]"
                  >
                    <span className="block text-sm sm:text-base font-black text-[#2B313A] font-mono">
                      {m.value}
                    </span>
                    <span className="text-[10px] text-[#777A7D] font-medium block">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Action Button */}
              <div className="w-full sm:w-auto">
                {currentPillar.ctaLink ? (
                  <Link
                    to={currentPillar.ctaLink}
                    className="w-full sm:w-auto h-11 px-5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs sm:text-sm font-black rounded-xl shadow-md hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>{currentPillar.ctaText}</span>
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleCtaClick}
                    className="w-full sm:w-auto h-11 px-5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs sm:text-sm font-black rounded-xl shadow-md hover:shadow-orange-500/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <span>{currentPillar.ctaText}</span>
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4. CORPORATE CONTACT & VERIFICATION FOOTER STRIP                      */}
        {/* ===================================================================== */}
        <div className="rounded-2xl bg-[#2B313A] text-white p-4 sm:p-5 border border-[#3F4550] shadow-md flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          {/* Address & Postal Code */}
          <div className="flex items-start gap-2.5 text-right">
            <div className="w-7 h-7 rounded-lg bg-[#E06518]/20 border border-[#E06518]/40 text-[#E06518] flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <span className="font-bold text-white block">
                مرکز بازرگانی اطلس (صنعت پیش):
              </span>
              <span className="text-slate-300 text-[11px] block">
                یزد، بلوار جمهوری، بعد از بیمارستان افشار، جنب بانک سپه | کد پستی: <strong className="font-mono text-orange-300">۸۹۱۷۹۴۵۶۳۹</strong>
              </span>
            </div>
          </div>

          {/* Quick Communication Channels */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Phone */}
            <a
              href="tel:035352547034"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-2 transition-colors font-mono text-xs"
              dir="ltr"
            >
              <Phone className="w-3.5 h-3.5 text-[#E06518]" />
              <span>۰۳۵-۳۵۲۵۴۷۰۳۴</span>
            </a>

            {/* WhatsApp */}
            <a
              href="https://wa.me/989903427027"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white flex items-center gap-2 transition-colors font-mono text-xs shadow-xs"
              dir="ltr"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>۰۹۹۰۳۴۲۷۰۲۷</span>
            </a>

            {/* More details link */}
            <Link
              to="/about"
              className="px-3.5 py-1.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>درباره ما و مجوزها</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
};
