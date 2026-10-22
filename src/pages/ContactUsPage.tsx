import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { scrollToSectionElement } from '../components/layout/ScrollToTop';
import {
  Phone,
  PhoneCall,
  MapPin,
  Mail,
  Clock,
  Send,
  MessageCircle,
  Headphones,
  Settings,
  Handshake,
  Zap,
  Users,
  BarChart3,
  Calendar,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Navigation,
  Plus,
  Minus,
  LocateFixed,
  Building2,
  Sparkles,
} from 'lucide-react';
import { STORE_ASSETS } from '../assets/images';
import yazdRegionMap from '../assets/images/yazd-region-osm.png';

interface ContactUsPageProps {
  defaultTab?: 'all' | 'factory' | 'offices';
}

interface BranchLocation {
  id: 'yazd_shop' | 'meybod_warehouse' | 'tehran_office';
  shortLabel: string;
  title: string;
  subtitle: string;
  address: string;
  postalCode: string;
  phone: string;
  phoneRaw: string;
  mobile: string;
  mobileRaw: string;
  hours: string;
  lat: number;
  lng: number;
  bbox: string;
  googleMapsUrl: string;
  neshanUrl: string;
}

const BRANCH_LOCATIONS: BranchLocation[] = [
  {
    id: 'yazd_shop',
    shortLabel: 'فروشگاه و دفتر مرکزی یزد (بلوار جمهوری)',
    title: 'صنعت پیش (بازرگانی اطلس)',
    subtitle: 'فروشگاه مرکزی و دفتر مهندسی فروش',
    address:
      'یزد، بلوار جمهوری، بعد از بیمارستان افشار، جنب بانک سپه، بازرگانی اطلس (صنعت پیش)',
    postalCode: '۸۹۱۷۹۴۵۶۳۹',
    phone: '۰۳۵-۳۵۲۵۴۷۰۳',
    phoneRaw: '03535254703',
    mobile: '۰۹۹۰۳۴۲۷۰۲۷',
    mobileRaw: '09903427027',
    hours: 'شنبه تا پنجشنبه ۸:۰۰ تا ۲۰:۰۰',
    lat: 31.9234,
    lng: 54.3418,
    bbox: '54.3318%2C31.9164%2C54.3518%2C31.9304',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=31.9234,54.3418',
    neshanUrl: 'https://neshan.org/maps/@31.9234,54.3418,16z',
  },
  {
    id: 'meybod_warehouse',
    shortLabel: 'انبار مرکزی و کارگاه ساخت میبد',
    title: 'انبار مرکزی و مجتمع لجستیک میبد',
    subtitle: 'دپوی قطعات کاشی و سرامیک و کارگاه آپارات',
    address:
      'استان یزد، میبد، کیلومتر ۳ جاده سنتو، روبروی شهرک صنعتی جهان‌آباد، مجتمع لجستیک صنعت پیش',
    postalCode: '۸۹۶۵۱-۳۴۸۲۱',
    phone: '۰۳۵-۳۵۲۵۴۷۰۳۴',
    phoneRaw: '035352547034',
    mobile: '۰۹۹۰۳۴۲۷۰۲۷',
    mobileRaw: '09903427027',
    hours: 'شبانه‌روزی (ویژه خطوط تولید و سفارشات اورژانسی)',
    lat: 32.2256,
    lng: 54.0185,
    bbox: '54.0050%2C32.2150%2C54.0320%2C32.2360',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=32.2256,54.0185',
    neshanUrl: 'https://neshan.org/maps/@32.2256,54.0185,15z',
  },
  {
    id: 'tehran_office',
    shortLabel: 'دفتر بازرگانی تهران (سعدی جنوبی)',
    title: 'دفتر بازرگانی و فروش سازمانی تهران',
    subtitle: 'امور قراردادها، فاکتور رسمی و ارسال باربری تهران',
    address:
      'تهران، خیابان سعدی جنوبی، روبروی بانک تجارت، پاساژ صدوقی، طبقه ۲، واحد ۲۴',
    postalCode: '۱۱۴۳۷-۶۸۲۹۱',
    phone: '۰۲۱-۳۳۹۲۸۴۵۰',
    phoneRaw: '02133928450',
    mobile: '۰۹۹۰۳۴۲۷۰۲۷',
    mobileRaw: '09903427027',
    hours: 'شنبه تا چهارشنبه ۸:۳۰ تا ۱۷:۳۰ | پنجشنبه ۸:۳۰ تا ۱۳:۳۰',
    lat: 35.6852,
    lng: 51.4231,
    bbox: '51.4150%2C35.6790%2C51.4310%2C35.6910',
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=35.6852,51.4231',
    neshanUrl: 'https://neshan.org/maps/@35.6852,51.4231,16z',
  },
];

const HERO_PILLARS = [
  {
    id: 'consulting',
    title: 'مشاوره تخصصی',
    subjectValue: 'مشاوره تخصصی و انتخاب قطعه',
    Icon: Headphones,
  },
  {
    id: 'support',
    title: 'پشتیبانی فنی',
    subjectValue: 'پشتیبانی فنی و مهندسی خطوط تولید',
    Icon: Settings,
  },
  {
    id: 'corporate',
    title: 'همکاری سازمانی',
    subjectValue: 'همکاری سازمانی و پروژه‌های بزرگ (B2B)',
    Icon: Handshake,
  },
];

const HERO_RIGHT_FEATURES = [
  {
    id: 'fast',
    title: 'پاسخگویی سریع',
    subtitle: 'در کوتاه‌ترین زمان',
    Icon: Zap,
  },
  {
    id: 'expert',
    title: 'مشاوره تخصصی',
    subtitle: 'توسط تیم مهندسی',
    Icon: Users,
  },
  {
    id: 'longterm',
    title: 'همکاری بلندمدت',
    subtitle: 'با صنایع مختلف',
    Icon: BarChart3,
  },
];

export const ContactUsPage: React.FC<ContactUsPageProps> = ({ defaultTab = 'all' }) => {
  const [searchParams] = useSearchParams();
  const formRef = useRef<HTMLDivElement>(null);
  const workspaceMainRef = useRef<HTMLElement>(null);
  const mapSectionRef = useRef<HTMLDivElement>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<BranchLocation['id']>(
    defaultTab === 'factory' ? 'yazd_shop' : 'yazd_shop'
  );
  const [isMapInteractive, setIsMapInteractive] = useState(true);
  const [mapZoomOffset, setMapZoomOffset] = useState(0);

  // Mobile creative section filter ('all' | 'info' | 'form')
  const [mobileSectionMode, setMobileSectionMode] = useState<'all' | 'info' | 'form'>('all');

  // Visit coordination modal state
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [visitDate, setVisitDate] = useState('فردا صبح (۹:۰۰ الی ۱۲:۰۰)');
  const [visitPurpose, setVisitPurpose] = useState('بازدید حضوری از فروشگاه و مشاهده قطعات');

  // Contact form state
  const [formSubject, setFormSubject] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'تماس با صنعت پیش | آدرس فروشگاه، تلفن و ارتباط مستقیم';
    const tabParam = searchParams.get('tab');
    if (tabParam === 'factory') {
      setSelectedBranchId('meybod_warehouse');
    }
  }, [searchParams]);

  const activeBranch =
    BRANCH_LOCATIONS.find((b) => b.id === selectedBranchId) || BRANCH_LOCATIONS[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSelectTopicAndScroll = (subjectText: string, prefillMsg?: string) => {
    setFormSubject(subjectText);
    if (prefillMsg) {
      setFormMessage(prefillMsg);
    }
    setMobileSectionMode('all');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) return;
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormMessage('');
    }, 4500);
  };

  const handleConfirmVisit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVisitModalOpen(false);
    handleSelectTopicAndScroll(
      'هماهنگی مراجعه حضوری به فروشگاه',
      `درخواست هماهنگی مراجعه حضوری به ${activeBranch.shortLabel} — زمان پیشنهادی: ${visitDate} — موضوع: ${visitPurpose}`
    );
  };

  // Compute dynamic bounding box for OpenStreetMap zoom controls
  const delta = Math.max(0.003, 0.009 - mapZoomOffset * 0.0025);
  const dynamicBbox = `${(activeBranch.lng - delta).toFixed(4)}%2C${(
    activeBranch.lat -
    delta * 0.7
  ).toFixed(4)}%2C${(activeBranch.lng + delta).toFixed(4)}%2C${(
    activeBranch.lat +
    delta * 0.7
  ).toFixed(4)}`;

  return (
    <div
      className="home-refined w-full bg-[#fafafb] text-[#55565A] font-sans pb-10 overflow-x-hidden"
      dir="rtl"
    >
      {/* ===================================================================== */}
      {/* 1. HERO SECTION — EXACT MATCH TO REFERENCE IMAGE + DEDICATED MOBILE   */}
      {/* ===================================================================== */}
      <section
        aria-label="تماس با صنعت پیش"
        className="relative w-full overflow-hidden bg-white lg:bg-[#2B313A] text-[#55565A] lg:text-white border-b border-[#e5e7eb] lg:border-slate-800"
      >
        {/* DESKTOP ARCHITECTURAL BACKGROUND (lg+) */}
        <div className="hidden lg:block absolute inset-0 z-0">
          <img
            src={STORE_ASSETS.whySanatDirectFactory}
            alt="مجتمع و دفتر مرکزی صنعت پیش"
            className="w-full h-full object-cover object-center brightness-[0.82] contrast-[1.05]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E242B]/90 via-[#2B313A]/35 to-[#1E242B]/88" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1E242B]/90 via-transparent to-[#1E242B]/40" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-12 pb-6 sm:pb-8 lg:pb-16">
          {/* ================================================================= */}
          {/* MOBILE VIEW (< lg): CREATIVE, DEDICATED MOBILE HERO               */}
          {/* ================================================================= */}
          <div className="lg:hidden space-y-4">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] min-h-[210px] max-h-[275px] w-full rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-[#2B313A]">
              <img
                src={STORE_ASSETS.whySanatDirectFactory}
                alt="ساختمان و فروشگاه مرکزی صنعت پیش"
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/20" />

              <div className="absolute top-3 right-3 z-20">
                <span className="px-3 py-1 rounded-full bg-[#E06518] text-white text-[11px] font-bold shadow-md inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>پاسخگویی سریع مهندسی</span>
                </span>
              </div>

              <a
                href="tel:03535254703"
                className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white font-mono text-[10px] font-bold border border-white/20 flex items-center gap-1"
                dir="ltr"
              >
                <PhoneCall className="w-3 h-3 text-[#E06518]" />
                <span>035-35254703</span>
              </a>

              <div className="absolute bottom-2.5 right-2.5 left-2.5 z-20 grid grid-cols-3 gap-1.5 bg-[#2B313A]/90 backdrop-blur-md p-2 rounded-xl border border-white/15">
                {HERO_RIGHT_FEATURES.map(({ id, title, subtitle, Icon }) => (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 text-right border-l last:border-l-0 border-white/10 pl-1"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#E06518]/20 border border-[#E06518]/60 flex items-center justify-center text-[#E06518] shrink-0">
                      <Icon className="w-3 h-3" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-white truncate">{title}</div>
                      <div className="text-[8px] text-slate-300 truncate">{subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 text-right pt-0.5">
              <div className="flex items-center gap-1.5 justify-start text-[11px] font-bold text-[#E06518]">
                <span className="w-2 h-2 rounded-full bg-[#E06518]" />
                <span>ارتباط مستقیم با فروشگاه مرکزی یزد و واحد مهندسی</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-[#55565A] leading-snug">
                <span>تماس با </span>
                <span className="text-[#E06518]">صنعت پیش</span>
              </h1>

              <p className="text-xs text-[#74757c] leading-relaxed">
                همیشه آماده شنیدن نظرات، پیشنهادها و همکاری‌های شما هستیم. با ما در مسیر توسعه
                صنایع ایران همراه باشید.
              </p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {HERO_PILLARS.map(({ id, title, subjectValue, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTopicAndScroll(subjectValue)}
                    className="group bg-[#f6f7f9] hover:bg-[#fff0e5] border border-[#e5e7eb] hover:border-[#E06518] rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 text-center transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <span className="w-8 h-8 rounded-lg bg-white border border-[#e5e7eb] group-hover:border-[#E06518]/40 text-[#E06518] flex items-center justify-center shadow-2xs">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-black text-[#55565A] group-hover:text-[#c95c17]">
                      {title}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-1.5 grid grid-cols-3 gap-2">
                <a
                  href="tel:03535254703"
                  className="h-10 px-2 bg-gradient-to-r from-[#C95210] to-[#E06518] text-white font-black text-[11px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                  <span>تماس با مغازه</span>
                </a>
                <a
                  href="https://wa.me/989903427027"
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-2 bg-white border border-[#e5e7eb] text-[#55565A] hover:border-[#E06518] font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#E06518] shrink-0" />
                  <span>واتساپ فنی</span>
                </a>
                <a
                  href={BRANCH_LOCATIONS[0].googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-2 bg-white border border-[#e5e7eb] text-[#55565A] hover:border-[#E06518] font-bold text-[11px] rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                >
                  <Navigation className="w-3.5 h-3.5 text-[#E06518] shrink-0" />
                  <span>لوکیشن مغازه</span>
                </a>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* DESKTOP VIEW (lg+): EXACT REFERENCE IMAGE 3-ZONE HERO COMPOSITION */}
          {/* ================================================================= */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-center min-h-[380px]">
            <div className="lg:col-span-4">
              <div className="bg-[#1E242B]/75 backdrop-blur-md border border-white/15 rounded-2xl p-6 divide-y divide-white/10 shadow-2xl max-w-[330px]">
                {HERO_RIGHT_FEATURES.map(({ id, title, subtitle, Icon }) => (
                  <div
                    key={id}
                    className="py-4 first:pt-1 last:pb-1 flex items-center justify-start gap-4"
                  >
                    <span className="w-12 h-12 rounded-full bg-[#E06518]/15 border border-[#E06518]/60 shadow-[0_0_20px_rgba(224,101,24,0.3)] flex items-center justify-center text-[#E06518] shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <div className="text-right">
                      <div className="text-base font-black text-white">{title}</div>
                      <div className="text-xs text-slate-300 mt-0.5">{subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="bg-[#1E242B]/80 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#E06518] to-[#C95210] flex items-center justify-center text-white shadow-md">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-white tracking-tight">صنعت پیش</div>
                  <div className="text-[11px] text-orange-300 font-bold">
                    بازرگانی اطلس • تاسیس ۱۳۶۶
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-5 text-right">
              <div className="space-y-2">
                <h1 className="text-4xl xl:text-[52px] font-black leading-[1.18] tracking-tight text-white drop-shadow-md">
                  <span className="block">تماس با</span>
                  <span className="block text-[#E06518] pt-1">صنعت پیش</span>
                </h1>
                <div className="w-10 h-1 rounded-full bg-[#E06518]" />
              </div>

              <p className="text-sm xl:text-[15px] text-slate-100 leading-[2.1] font-medium max-w-md">
                همیشه آماده شنیدن نظرات، پیشنهادها و همکاری‌های شما هستیم.
                <br />
                با ما در مسیر توسعه صنایع ایران همراه باشید.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                {HERO_PILLARS.map(({ id, title, subjectValue, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTopicAndScroll(subjectValue)}
                    className="group bg-white/12 hover:bg-white/22 backdrop-blur-md border border-white/20 hover:border-[#E06518] rounded-2xl p-4 flex flex-col items-center justify-center gap-2.5 text-center transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    <Icon className="w-7 h-7 text-[#E06518] group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black text-white">{title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. MOBILE SECTION TAB SWITCHER                                        */}
      {/* ===================================================================== */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-1.5 grid grid-cols-3 gap-1.5 shadow-2xs">
          {[
            { id: 'all', label: 'نمای کامل صفحه' },
            { id: 'info', label: 'آدرس مغازه و نقشه' },
            { id: 'form', label: 'فرم ارسال پیام' },
          ].map((tab) => {
            const active = mobileSectionMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  const mode = tab.id as 'all' | 'info' | 'form';
                  setMobileSectionMode(mode);
                  window.requestAnimationFrame(() => {
                    if (mode === 'form') {
                      scrollToSectionElement(formRef.current, { behavior: 'smooth' });
                    } else {
                      scrollToSectionElement(workspaceMainRef.current, { behavior: 'smooth' });
                    }
                  });
                }}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#C95210] to-[#E06518] text-white shadow-xs'
                    : 'text-[#55565A] hover:bg-[#f6f7f9]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. MAIN 2-COLUMN WORKSPACE (Overlapping Hero on Desktop)              */}
      {/* ===================================================================== */}
      <main
        ref={workspaceMainRef}
        id="contact-workspace-main"
        className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 lg:pt-0 lg:-mt-8 scroll-mt-24"
      >
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-[#e5e7eb] shadow-[0_16px_50px_rgba(43,49,58,0.08)] p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* =============================================================== */}
            {/* RIGHT COLUMN IN RTL (lg:col-span-7): راه‌های ارتباط با ما        */}
            {/* =============================================================== */}
            <div
              className={`lg:col-span-7 space-y-5 ${
                mobileSectionMode === 'form' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="space-y-1 text-right">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-1 rounded-full bg-[#E06518]" />
                  <h2 className="text-xl sm:text-2xl font-black text-[#55565A]">
                    راه‌های ارتباط با ما
                  </h2>
                </div>
                <p className="text-xs sm:text-[13px] text-[#74757c] pr-7">
                  از طریق راه‌های زیر می‌توانید با تیم صنعت پیش و فروشگاه مرکزی در ارتباط باشید.
                </p>
              </div>

              {/* 4 Contact Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#f6f7f9] hover:bg-white rounded-2xl border border-[#e5e7eb] hover:border-[#E06518]/50 p-4 text-center flex flex-col items-center justify-between transition-all shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-[#fff0e5] border border-[#f2d8c3] text-[#E06518] flex items-center justify-center mb-2.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs sm:text-[13px] font-black text-[#55565A] mb-1.5">
                    ساعات کاری
                  </h3>
                  <div className="text-[11px] text-[#74757c] leading-relaxed">
                    <div>شنبه تا پنجشنبه</div>
                    <div className="font-bold text-[#55565A] mt-0.5">۸:۰۰ تا ۲۰:۰۰</div>
                  </div>
                </div>

                <div className="bg-[#f6f7f9] hover:bg-white rounded-2xl border border-[#e5e7eb] hover:border-[#E06518]/50 p-4 text-center flex flex-col items-center justify-between transition-all shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-[#fff0e5] border border-[#f2d8c3] text-[#E06518] flex items-center justify-center mb-2.5">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs sm:text-[13px] font-black text-[#55565A] mb-1.5">
                    آدرس فروشگاه مرکزی
                  </h3>
                  <p className="text-[11px] text-[#74757c] leading-relaxed">
                    یزد، بلوار جمهوری، بعد از بیمارستان افشار، جنب بانک سپه
                  </p>
                </div>

                <div className="bg-[#f6f7f9] hover:bg-white rounded-2xl border border-[#e5e7eb] hover:border-[#E06518]/50 p-4 text-center flex flex-col items-center justify-between transition-all shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-[#fff0e5] border border-[#f2d8c3] text-[#E06518] flex items-center justify-center mb-2.5">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs sm:text-[13px] font-black text-[#55565A] mb-1.5">
                    تلفن تماس
                  </h3>
                  <div className="space-y-0.5">
                    <a
                      href="tel:03535254703"
                      className="block text-xs font-black text-[#55565A] hover:text-[#E06518] font-mono transition-colors"
                      dir="ltr"
                    >
                      ۰۳۵-۳۵۲۵۴۷۰۳
                    </a>
                    <a
                      href="tel:09903427027"
                      className="block text-[11px] font-bold text-[#E06518] font-mono"
                      dir="ltr"
                    >
                      ۰۹۹۰۳۴۲۷۰۲۷
                    </a>
                    <div className="text-[10px] text-[#74757c]">همه‌روزه ۸ تا ۲۰</div>
                  </div>
                </div>

                <div className="bg-[#f6f7f9] hover:bg-white rounded-2xl border border-[#e5e7eb] hover:border-[#E06518]/50 p-4 text-center flex flex-col items-center justify-between transition-all shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-[#fff0e5] border border-[#f2d8c3] text-[#E06518] flex items-center justify-center mb-2.5">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs sm:text-[13px] font-black text-[#55565A] mb-1.5">
                    ایمیل
                  </h3>
                  <div className="space-y-1">
                    <div
                      className="text-[11px] font-mono text-[#74757c] truncate max-w-[130px]"
                      dir="ltr"
                    >
                      info@sanatpish.com
                    </div>
                    <a
                      href="mailto:info@sanatpish.com"
                      className="inline-block text-[11px] font-black text-[#E06518] hover:text-[#C95210] transition-colors"
                    >
                      ارسال ایمیل
                    </a>
                  </div>
                </div>
              </div>

              {/* Shop Location on Interactive Map */}
              <div ref={mapSectionRef} id="contact-map-section" className="space-y-2.5 scroll-mt-24">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#55565A]">
                    <MapPin className="w-4 h-4 text-[#E06518]" />
                    <span>موقعیت روی نقشه:</span>
                    <span className="text-[#E06518]">{activeBranch.shortLabel}</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#f6f7f9] border border-[#e5e7eb] rounded-xl p-1">
                    {BRANCH_LOCATIONS.map((branch) => {
                      const isCurrent = branch.id === activeBranch.id;
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setSelectedBranchId(branch.id);
                            setMapZoomOffset(0);
                            window.requestAnimationFrame(() => {
                              scrollToSectionElement(mapSectionRef.current, { behavior: 'smooth' });
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#E06518] text-white shadow-2xs'
                              : 'text-[#55565A] hover:bg-white'
                          }`}
                        >
                          {branch.id === 'yazd_shop'
                            ? 'فروشگاه یزد (بلوار جمهوری)'
                            : branch.id === 'meybod_warehouse'
                              ? 'انبار میبد'
                              : 'دفتر تهران'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative h-[235px] sm:h-[265px] w-full rounded-2xl overflow-hidden border border-[#e5e7eb] bg-[#eef0f2] shadow-xs">
                  {isMapInteractive ? (
                    <iframe
                      key={`${activeBranch.id}-${mapZoomOffset}`}
                      title={`نقشه ${activeBranch.title}`}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${dynamicBbox}&layer=mapnik&marker=${activeBranch.lat}%2C${activeBranch.lng}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full border-0 filter contrast-[0.98]"
                    />
                  ) : (
                    <img
                      src={yazdRegionMap}
                      alt="نقشه فروشگاه مرکزی صنعت پیش در بلوار جمهوری یزد"
                      className="w-full h-full object-cover"
                    />
                  )}

                  <div className="pointer-events-none absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-[#e5e7eb] rounded-2xl px-3.5 py-2.5 shadow-lg max-w-[270px] sm:max-w-xs">
                    <span className="w-9 h-9 rounded-xl bg-[#E06518] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <MapPin className="w-5 h-5" />
                    </span>
                    <div className="text-right min-w-0">
                      <div className="text-xs sm:text-[13px] font-black text-[#55565A] truncate">
                        {activeBranch.title}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-[#74757c] leading-snug line-clamp-2 mt-0.5">
                        {activeBranch.address}
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMapZoomOffset((z) => Math.min(z + 1, 2))}
                      aria-label="بزرگ‌نمایی نقشه"
                      className="w-8 h-8 rounded-lg bg-white/95 hover:bg-[#E06518] text-[#55565A] hover:text-white border border-slate-200 shadow-md flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapZoomOffset((z) => Math.max(z - 1, -2))}
                      aria-label="کوچک‌نمایی نقشه"
                      className="w-8 h-8 rounded-lg bg-white/95 hover:bg-[#E06518] text-[#55565A] hover:text-white border border-slate-200 shadow-md flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMapZoomOffset(0);
                        setIsMapInteractive(true);
                      }}
                      aria-label="بازنشانی موقعیت مغازه"
                      className="w-8 h-8 rounded-lg bg-white/95 hover:bg-[#E06518] text-[#E06518] hover:text-white border border-slate-200 shadow-md flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <LocateFixed className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center gap-1.5">
                    <a
                      href={activeBranch.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-3 rounded-lg bg-[#E06518] hover:bg-[#C95210] text-white text-[11px] font-bold shadow-md inline-flex items-center gap-1.5 transition-all"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>مسیریابی گوگل‌مپ</span>
                    </a>
                    <a
                      href={activeBranch.neshanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 px-2.5 rounded-lg bg-white/95 hover:bg-white text-[#55565A] hover:text-[#E06518] border border-slate-200 text-[11px] font-bold shadow-md inline-flex items-center gap-1 transition-all"
                    >
                      <span>مسیریابی نشان</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeBranch.address, 'map-address')}
                      className="h-8 px-2.5 rounded-lg bg-white/95 hover:bg-white text-[#55565A] hover:text-[#E06518] border border-slate-200 text-[11px] font-bold shadow-md inline-flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {copiedKey === 'map-address' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">آدرس کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#E06518]" />
                          <span>کپی آدرس مغازه</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* In-Person Visit Coordination Card */}
              <div className="rounded-2xl bg-[#f6f7f9] border border-[#e5e7eb] overflow-hidden grid grid-cols-1 sm:grid-cols-12 items-stretch shadow-2xs">
                <div className="sm:col-span-6 p-5 flex flex-col justify-center items-start text-right space-y-2.5 order-2 sm:order-1">
                  <h3 className="text-base sm:text-lg font-black text-[#55565A]">
                    هماهنگی مراجعه حضوری
                  </h3>
                  <p className="text-xs text-[#74757c] leading-relaxed">
                    برای بازدید از فروشگاه و مشاهده محصولات از نزدیک در یزد (بلوار جمهوری، بعد از
                    بیمارستان افشار)، می‌توانید هماهنگی لازم را انجام دهید.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsVisitModalOpen(true)}
                      className="h-10 px-4 rounded-xl bg-white hover:bg-[#E06518] text-[#E06518] hover:text-white border border-[#E06518] font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>درخواست هماهنگی</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-6 relative min-h-[165px] sm:min-h-[185px] bg-[#2B313A] order-1 sm:order-2 overflow-hidden">
                  <img
                    src={STORE_ASSETS.partsWarehouseVault}
                    alt="نمایشگاه و فروشگاه حضوری صنعت پیش"
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2B313A]/40 via-transparent to-transparent" />
                  <div className="absolute bottom-2.5 left-2.5 bg-[#2B313A]/85 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/15">
                    فروشگاه و نمایشگاه قطعات • بلوار جمهوری یزد
                  </div>
                </div>
              </div>
            </div>

            {/* =============================================================== */}
            {/* LEFT COLUMN IN RTL (lg:col-span-5): ارسال پیام به صنعت پیش       */}
            {/* =============================================================== */}
            <div
              ref={formRef}
              className={`lg:col-span-5 ${
                mobileSectionMode === 'info' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="bg-white rounded-3xl border border-[#e5e7eb] shadow-[0_8px_30px_rgba(43,49,58,0.06)] p-5 sm:p-7 space-y-5">
                <div className="space-y-1 text-right">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-1 rounded-full bg-[#E06518]" />
                    <h2 className="text-xl sm:text-2xl font-black text-[#55565A]">
                      ارسال پیام به صنعت پیش
                    </h2>
                  </div>
                  <p className="text-xs text-[#74757c] leading-relaxed">
                    درخواست خود را ارسال کنید. کارشناسان ما در اسرع وقت با شما تماس خواهند گرفت.
                  </p>
                </div>

                {isSubmitted ? (
                  <div
                    role="status"
                    className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3 animate-in fade-in"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-black text-[#55565A]">
                      پیام شما با موفقیت ثبت شد
                    </h3>
                    <p className="text-xs text-[#74757c] leading-relaxed">
                      کارشناسان فروش و مهندسی صنعت پیش در کوتاه‌ترین زمان با شماره{' '}
                      <span className="font-mono font-bold text-[#55565A]" dir="ltr">
                        {formPhone}
                      </span>{' '}
                      تماس خواهند گرفت.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="space-y-4 text-right">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-subject"
                        className="block text-xs font-bold text-[#55565A]"
                      >
                        موضوع درخواست <span className="text-[#E06518]">*</span>
                      </label>
                      <select
                        id="contact-subject"
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        required
                        className="w-full h-11 px-3.5 rounded-xl bg-[#fafafb] border border-[#e5e7eb] focus:bg-white focus:border-[#E06518] text-xs font-medium text-[#55565A] outline-none transition-colors"
                      >
                        <option value="" disabled>
                          انتخاب موضوع
                        </option>
                        <option value="مشاوره تخصصی و انتخاب قطعه">
                          مشاوره تخصصی و انتخاب قطعه
                        </option>
                        <option value="استعلام قیمت و موجودی (پیش‌فاکتور رسمی)">
                          استعلام قیمت و موجودی (پیش‌فاکتور رسمی)
                        </option>
                        <option value="پشتیبانی فنی و مهندسی خطوط تولید">
                          پشتیبانی فنی و مهندسی خطوط تولید
                        </option>
                        <option value="همکاری سازمانی و پروژه‌های بزرگ (B2B)">
                          همکاری سازمانی و پروژه‌های بزرگ (B2B)
                        </option>
                        <option value="هماهنگی مراجعه حضوری به فروشگاه">
                          هماهنگی مراجعه حضوری به فروشگاه یزد
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-name"
                        className="block text-xs font-bold text-[#55565A]"
                      >
                        نام و نام خانوادگی <span className="text-[#E06518]">*</span>
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="نام و نام خانوادگی"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#fafafb] border border-[#e5e7eb] focus:bg-white focus:border-[#E06518] text-xs text-[#55565A] placeholder:text-slate-400 outline-none transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="contact-phone"
                          className="block text-xs font-bold text-[#55565A]"
                        >
                          شماره تماس <span className="text-[#E06518]">*</span>
                        </label>
                        <input
                          id="contact-phone"
                          type="tel"
                          required
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
                          dir="ltr"
                          className="w-full h-11 px-3.5 rounded-xl bg-[#fafafb] border border-[#e5e7eb] focus:bg-white focus:border-[#E06518] text-xs text-[#55565A] placeholder:text-slate-400 outline-none transition-colors text-right font-mono"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="contact-email"
                          className="block text-xs font-bold text-[#55565A]"
                        >
                          ایمیل
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="example@mail.com"
                          dir="ltr"
                          className="w-full h-11 px-3.5 rounded-xl bg-[#fafafb] border border-[#e5e7eb] focus:bg-white focus:border-[#E06518] text-xs text-[#55565A] placeholder:text-slate-400 outline-none transition-colors text-left font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-bold text-[#55565A]"
                      >
                        متن پیام <span className="text-[#E06518]">*</span>
                      </label>
                      <textarea
                        id="contact-message"
                        rows={4}
                        required
                        value={formMessage}
                        onChange={(e) => setFormMessage(e.target.value)}
                        placeholder="شرح درخواست خود را بنویسید ..."
                        className="w-full p-3.5 rounded-xl bg-[#fafafb] border border-[#e5e7eb] focus:bg-white focus:border-[#E06518] text-xs text-[#55565A] placeholder:text-slate-400 outline-none transition-colors resize-none leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-[#C95210] to-[#E06518] hover:from-[#C2410C] hover:to-[#C95210] text-white font-black text-xs sm:text-sm rounded-xl shadow-[0_6px_18px_rgba(224,101,24,0.32)] hover:shadow-[0_8px_22px_rgba(224,101,24,0.45)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>ارسال پیام</span>
                    </button>

                    <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#74757c]">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>اطلاعات شما به صورت محرمانه نگهداری خواهد شد.</span>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* 4. BOTTOM CORPORATE B2B BANNER                                        */}
      {/* ===================================================================== */}
      <section
        aria-label="همکاری سازمانی و پروژه‌های بزرگ"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8"
      >
        <div className="relative rounded-3xl overflow-hidden bg-[#1E242B] text-white border border-slate-700/80 shadow-lg">
          <img
            src={STORE_ASSETS.forzaSubBearing}
            alt="همکاری سازمانی و تامین قطعات خطوط تولید"
            className="absolute inset-y-0 left-0 w-full sm:w-3/5 h-full object-cover object-left opacity-35 sm:opacity-55 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#1E242B] via-[#1E242B]/92 to-[#1E242B]/40 pointer-events-none" />

          <div className="relative z-10 p-6 sm:p-8 lg:px-10 lg:py-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="space-y-2 text-right max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#E06518]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>واحد فروش شرکتی و قراردادهای تامین سالانه (Vendor List)</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white">
                برای همکاری سازمانی و پروژه‌های بزرگ
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                تیم فروش سازمانی صنعت پیش آماده بررسی نیازهای ویژه صنایع، صدور پیش‌فاکتور رسمی و
                تامین مستمر پروژه‌های شماست.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() =>
                  handleSelectTopicAndScroll(
                    'همکاری سازمانی و پروژه‌های بزرگ (B2B)',
                    'درخواست مذاکره و دریافت شرایط همکاری سازمانی / تامین قطعات خط تولید:'
                  )
                }
                className="w-full sm:w-auto h-11 px-5 rounded-xl bg-white/10 hover:bg-[#E06518] text-white border border-white/25 hover:border-[#E06518] backdrop-blur-md font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 group"
              >
                <span>ارتباط با واحد فروش سازمانی</span>
                <ArrowLeft className="w-4 h-4 text-[#E06518] group-hover:text-white" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. IN-PERSON VISIT SCHEDULING MODAL                                   */}
      {/* ===================================================================== */}
      {isVisitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="visit-modal-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl border border-[#e5e7eb] shadow-2xl max-w-md w-full p-6 space-y-4 text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#fff0e5] text-[#E06518] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </span>
                <h3 id="visit-modal-title" className="text-base font-black text-[#55565A]">
                  هماهنگی مراجعه حضوری به فروشگاه
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVisitModalOpen(false)}
                className="text-xs font-bold text-[#74757c] hover:text-[#55565A] px-2 py-1 rounded-lg bg-[#f6f7f9] cursor-pointer"
              >
                بستن
              </button>
            </div>

            <div className="rounded-xl bg-[#f6f7f9] border border-[#e5e7eb] p-3 text-xs space-y-1">
              <div className="font-black text-[#55565A]">آدرس فروشگاه مرکزی (مغازه):</div>
              <div className="text-[#74757c] leading-relaxed">{BRANCH_LOCATIONS[0].address}</div>
              <div className="text-[#E06518] font-bold pt-0.5">
                ساعات حضور: شنبه تا پنجشنبه ۸:۰۰ الی ۲۰:۰۰
              </div>
            </div>

            <form onSubmit={handleConfirmVisit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#55565A]">
                  بازه زمانی مراجعه حضوری:
                </label>
                <select
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#fafafb] border border-[#e5e7eb] text-xs text-[#55565A] outline-none focus:border-[#E06518]"
                >
                  <option value="امروز (ساعات کاری ۸ تا ۲۰)">امروز (ساعات کاری ۸ تا ۲۰)</option>
                  <option value="فردا صبح (۸:۰۰ الی ۱۳:۰۰)">فردا صبح (۸:۰۰ الی ۱۳:۰۰)</option>
                  <option value="فردا عصر (۱۴:۰۰ الی ۲۰:۰۰)">فردا عصر (۱۴:۰۰ الی ۲۰:۰۰)</option>
                  <option value="هماهنگی تلفنی برای روزهای آینده">
                    هماهنگی تلفنی برای روزهای آینده
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#55565A]">هدف مراجعه:</label>
                <select
                  value={visitPurpose}
                  onChange={(e) => setVisitPurpose(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#fafafb] border border-[#e5e7eb] text-xs text-[#55565A] outline-none focus:border-[#E06518]"
                >
                  <option value="بازدید حضوری از فروشگاه و مشاهده قطعات">
                    بازدید حضوری از فروشگاه و مشاهده قطعات
                  </option>
                  <option value="تحویل نمونه قطعه جهت تطبیق فنی و کولیس‌کشی">
                    تحویل نمونه قطعه جهت تطبیق فنی و کولیس‌کشی
                  </option>
                  <option value="تحویل حضوری سفارش ثبت‌شده">تحویل حضوری سفارش ثبت‌شده</option>
                  <option value="جلسه حضوری فروش سازمانی و قرارداد">
                    جلسه حضوری فروش سازمانی و قرارداد
                  </option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-gradient-to-r from-[#C95210] to-[#E06518] text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ثبت در فرم هماهنگی</span>
                </button>
                <a
                  href="tel:03535254703"
                  className="h-11 px-4 bg-[#f6f7f9] hover:bg-[#fff0e5] text-[#55565A] hover:text-[#E06518] border border-[#e5e7eb] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-[#E06518]" />
                  <span>تماس تلفنی</span>
                </a>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactUsPage;
