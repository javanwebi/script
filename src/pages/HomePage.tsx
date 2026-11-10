import { HomeCategoryStrip, HomeTrustStrip, HomeForzaBanner } from "../components/storefront/HomeSequence";
import {HomeAiIntroduction,HomeIndustryShowcase,HomeMembership} from '../components/storefront/HomeDiscovery';
import {HomeKnowledge} from './DiscoveryPages';
import {
  HomeAssist,
  IndustrialServices,
  HomeAboutSection,
} from "../components/storefront/HomeOverview";
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Camera,
  Sparkles,
  Headphones,
  Shield,
  ShieldCheck,
  Building,
  Truck,
  Award,
  Share2,
  FileText,
  Calculator,
  Flame,
  Phone,
  CheckCircle2,
  Factory,
  Zap,
  Cpu,
  Gem,
  Wheat,
  Play,
  Mouse,
  Clock,
  Layers,
  Package,
  Settings,
  Building2,
  History,
  FileCheck2,
  Warehouse,
  PhoneCall,
  MapPin,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { CATEGORIES } from "../data/categories";
import { STORE_ASSETS } from "../assets/images";
import { toPersianDigits } from "../utils/formatters";
const LazyVisualSearch = React.lazy(() => import("../components/search/AiVisualPartSearchModal").then(m => ({default:m.AiVisualPartSearchModal})));
const LazyAiConsult = React.lazy(() => import("../components/search/AiConsultModal").then(m => ({default:m.AiConsultModal})));
import { OurClientsSection } from "../components/home/OurClientsSection";

import { HighUtilityProductsSection } from "../components/home/HighUtilityProductsSection";
import { MainBrandsBanner } from "../components/home/MainBrandsBanner";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  // Modals state
  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);
  const [isConsultOpen, setIsConsultOpen] = useState(false);

  // Hero Slider
  const [activeSlide, setActiveSlide] = useState(1);
  const totalSlides = 3;

  // ---------------------------------------------------------------------------
  // Hero Carousel Data & Automatic 5s Slide Switching
  // ---------------------------------------------------------------------------
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [mobileHeroSlideIndex, setMobileHeroSlideIndex] = useState(0);

  interface HeroSlideItem {
    id: number;
    image: string;
    tag: string;
    eyebrow: string;
    titlePart1: string;
    titlePart2: string;
    description: string;
    statsBadge: {
      value: string;
      label: string;
    };
    primaryBtn: {
      text: string;
      link?: string;
      action?: "visualSearch" | "consult";
    };
    secondaryBtn: {
      text: string;
      link?: string;
      action?: "visualSearch" | "consult";
    };
    badge: {
      title: string;
      subtitle: string;
    };
  }

  const heroSlides: HeroSlideItem[] = [
    {
      id: 1,
      image: STORE_ASSETS.heroSteelCoils || STORE_ASSETS.heroPulley,
      tag: "تولید و بازرگانی قطعات صنعتی",
      eyebrow: "پیش به صنعت | بازرگانی تسمه اطلس از سال ۱۳۶۶",
      titlePart1: "صنعت پیش؛ همراه قدرتمند",
      titlePart2: "صنایع و خطوط تولید ایران",
      description:
        "سازنده و تأمین‌کننده مستقیم قطعات صنعتی، برندهای معتبر اطلس، FORZA و SWR برای فروشگاه‌ها، کارخانجات و خطوط تولید.",
      statsBadge: {
        value: "+۳۰,۰۰۰",
        label: "قلم کالای موجود در انبار",
      },
      primaryBtn: {
        text: "مشاهده کاتالوگ قطعات",
        link: "/products",
      },
      secondaryBtn: {
        text: "مشاوره هوشمند قطعه",
        action: "consult",
      },
      badge: {
        title: "ارسال رایگان به سراسر کشور | پیش به صنعت",
        subtitle: "پشتوانه ۳۷ سال تجربه صنعتی از سال ۱۳۶۶",
      },
    },
    {
      id: 2,
      image: STORE_ASSETS.forzaSwrDualBanner || STORE_ASSETS.heroPulley,
      tag: "نمایندگی رسمی و انحصاری",
      eyebrow: "کیفیت سطح یک و استانداردهای معتبر بین‌المللی DIN و ISO",
      titlePart1: "سیستم‌های انتقال قدرت",
      titlePart2: "با استانداردهای FORZA و SWR",
      description:
        "تأمین مستقیم و بدون واسطه انواع پولی‌های صنعتی، فلکه چدنی، تسمه‌های دنده‌ای و شیاردار، بلبرینگ و یاتاقان با برگه آنالیز متالوژی و تضمین کتبی اصالت.",
      statsBadge: {
        value: "DIN / ISO",
        label: "استاندارد بین‌المللی متالوژی",
      },
      primaryBtn: {
        text: "مشاهده قطعات FORZA و SWR",
        link: "/category/swr-forza-exclusive",
      },
      secondaryBtn: {
        text: "استعلام فوری قیمت و موجودی",
        action: "consult",
      },
      badge: {
        title: "تضمین اصالت قطعات و گارانتی تعویض",
        subtitle: "خرید دست‌اول و شرایط تسویه مدت‌دار",
      },
    },
    {
      id: 3,
      image: STORE_ASSETS.partsWarehouseVault || STORE_ASSETS.heroBanner,
      tag: "انبار مرکزی و دپوی استراتژیک",
      eyebrow: "شبکه توزیع و لجستیک اکسپرس در سراسر کشور",
      titlePart1: "توقف خط تولید، هرگز!",
      titlePart2: "ارسال فوری در کمتر از ۲۴ ساعت",
      description:
        "انتخاب روش ارسال و پیگیری سفارش قطعات از پنل مشتریان صنعت پیش.",
      statsBadge: {
        value: "< ۲۴h",
        label: "تحویل در محل کارخانه",
      },
      primaryBtn: {
        text: "شناسایی قطعه با هوش مصنوعی",
        action: "visualSearch",
      },
      secondaryBtn: {
        text: "تماس با واحد فروش فوری",
        action: "consult",
      },
      badge: {
        title: "ارسال رایگان و اکسپرس به سراسر کشور",
        subtitle: "پشتیبانی ۲۴ ساعته خطوط تولید",
      },
    },
    {
      id: 4,
      image:
        STORE_ASSETS.whySanatCadEngineering ||
        STORE_ASSETS.reverseEngineeringLab,
      tag: "تولید، ساخت و مهندسی معکوس",
      eyebrow: "سامانه مکانیزه شناسایی هوشمند و ساخت قطعات سفارشی",
      titlePart1: "کارگاه ساخت و مهندسی معکوس",
      titlePart2: "قطعات کمیاب و تحریمی خطوط تولید",
      description:
        "اسکن سه‌بعدی اپتیکال، ماشین‌کاری CNC و ساخت دقیق قطعات تحریمی خطوط کاشی و سرامیک، سیمان، فولاد و غذایی با تضمین عملکرد و گارانتی کتبی.",
      statsBadge: {
        value: "۱۰۰٪",
        label: "تطبیق با نقشه فابریک",
      },
      primaryBtn: {
        text: "ارسال نقشه و استعلام ساخت",
        action: "consult",
      },
      secondaryBtn: {
        text: "مشاهده دسته‌بندی قطعات",
        link: "/categories",
      },
      badge: {
        title: "کارگاه تخصصی تولید و ماشین‌کاری",
        subtitle: "تست‌های NDT و سختی‌سنجی متالوژی",
      },
    },
  ];

  // Mobile carousel: keep the previous storefront structure and place all campaign copy inside each banner.
  // These are existing optimized industrial WebP assets already used by the site.
  const mobileHeroSlides = [
    {
      id: "delivery",
      image: STORE_ASSETS.heroPulley,
      badge: "بازار بزرگ قطعات صنعتی",
      title: "توقف خط تولید، هرگز!",
      highlight: "ارسال فوری در کمتر از ۲۴ ساعت",
      description: "تأمین، سفارش و تحویل سریع قطعات صنعتی برای تداوم تولید شما",
      alt: "چرخ‌دنده‌ها و قطعات صنعتی برای تأمین فوری صنعت پیش",
    },
    {
      id: "supply",
      image: STORE_ASSETS.heroSteelCoils,
      badge: "تأمین تخصصی صنایع",
      title: "تأمین مطمئن قطعات صنعتی",
      highlight: "برای خطوط تولید",
      description: "دسترسی به کاتالوگ قطعات، برندها و مشخصات فنی موردنیاز صنعت",
      alt: "تصویر صنعتی از تجهیزات و قطعات فلزی",
    },
    {
      id: "tracking",
      image: STORE_ASSETS.whySanatExpressDelivery,
      badge: "خدمات مشتریان صنعت پیش",
      title: "پیگیری سفارش",
      highlight: "از پنل مشتریان",
      description: "وضعیت سفارش، مراحل ارسال و سوابق خرید را شفاف دنبال کنید",
      alt: "ارسال و تحویل سفارش قطعات صنعتی",
    },
    {
      id: "engineering",
      image: STORE_ASSETS.whySanatCadEngineering,
      badge: "تولید و مهندسی معکوس",
      title: "ساخت قطعات کمیاب",
      highlight: "و تحریمی خطوط تولید",
      description: "بررسی فنی، مهندسی معکوس و ساخت قطعات سفارشی صنعتی",
      alt: "مهندسی و طراحی قطعات صنعتی سفارشی",
    },
  ] as const;

  // 5-second automatic slide interval
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setMobileHeroSlideIndex((prev) => (prev + 1) % mobileHeroSlides.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, [mobileHeroSlides.length]);

  const handleNextSlide = () => {
    setHeroSlideIndex((prev) => (prev + 1) % heroSlides.length);
  };

  const handlePrevSlide = () => {
    setHeroSlideIndex(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
    );
  };

  const handleMobileNextSlide = () => {
    setMobileHeroSlideIndex((prev) => (prev + 1) % mobileHeroSlides.length);
  };

  const handleMobilePrevSlide = () => {
    setMobileHeroSlideIndex((prev) => (prev - 1 + mobileHeroSlides.length) % mobileHeroSlides.length);
  };

  // Mobile Touch Gestures for Hero Carousel
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    // In RTL, swipe left (diff > 40) moves forward to the next mobile banner.
    if (diff > 40) {
      handleMobileNextSlide();
    } else if (diff < -40) {
      handleMobilePrevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const activeMobileHeroSlide = mobileHeroSlides[mobileHeroSlideIndex];

  // Industries carousel scroll tracking
  const industriesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Categories carousel scroll tracking
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const handleCatScrollLeft = () => {
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollBy({ left: -260, behavior: "smooth" });
    }
  };

  const handleCatScrollRight = () => {
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollBy({ left: 260, behavior: "smooth" });
    }
  };

  const checkIndustriesScroll = () => {
    const el = industriesScrollRef.current;
    if (!el) return;
    const scrolled = Math.abs(el.scrollLeft) > 10;
    setCanScrollRight(scrolled);
  };

  const handleScrollLeft = () => {
    const el = industriesScrollRef.current;
    if (el) {
      el.scrollBy({ left: -320, behavior: "smooth" });
      setCanScrollRight(true);
    }
  };

  const handleScrollRight = () => {
    const el = industriesScrollRef.current;
    if (el) {
      el.scrollBy({ left: 320, behavior: "smooth" });
      setTimeout(checkIndustriesScroll, 350);
    }
  };

  // 6 Covered Industries matching user requirements
  const coveredIndustries = [
    {
      id: 1,
      title: "صنعت کاشی و سرامیک",
      image: STORE_ASSETS.industries.ceramic,
      icon: Flame,
      link: "/category/ceramic-tiles",
    },
    {
      id: 2,
      title: "صنعت نساجی و پارچه",
      image: STORE_ASSETS.industries.textile,
      icon: Cpu,
      link: "/category/textile-machinery",
    },
    {
      id: 3,
      title: "صنعت بسته‌بندی و کارتنسازی",
      image: STORE_ASSETS.industries.robotArm,
      icon: Package,
      link: "/category/packaging-carton",
    },
    {
      id: 4,
      title: "صنایع غذایی و نوشیدنی",
      image: STORE_ASSETS.industries.foodBottles,
      icon: Wheat,
      link: "/category/food-beverage",
    },
    {
      id: 5,
      title: "صنعت ماشین‌سازی و تجهیزات صنعتی",
      image: STORE_ASSETS.industries.manufacturing,
      icon: Factory,
      link: "/category/machinery-equipment",
    },
    {
      id: 6,
      title: "صنایع لاستیک و پلاستیک",
      image: STORE_ASSETS.industries.bgPlant || STORE_ASSETS.categories.belts,
      icon: Settings,
      link: "/category/rubber-plastics",
    },
  ];

  return (
    <div className="home-refined w-full text-right font-sans pb-6 overflow-x-hidden relative">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION - RESPONSIVE CINEMATIC DESKTOP & DEDICATED MOBILE BANNER   */}
      {/* ========================================================================= */}
      <section
        id="home-hero"
        className="home-hero relative w-full overflow-hidden bg-white lg:bg-[#55565A] text-[#37383b] lg:text-white border-b border-slate-200 lg:border-slate-800/80 h-auto min-h-0 lg:h-[530px] xl:h-[570px] flex flex-col justify-between select-none shrink-0"
      >
        {/* Only the active hero downloads; native image priority also works on desktop. */}
        {heroSlides.map((slide, idx) => {
          const isActive = idx === heroSlideIndex;
          return (
            <img
              key={`desktop-bg-${slide.id}`}
              src={isActive ? slide.image : undefined}
              alt=""
              aria-hidden="true"
              loading={isActive ? "eager" : "lazy"}
              fetchPriority={isActive ? "high" : "low"}
              decoding="async"
              className={`hidden lg:block absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100 z-0 scale-100" : "opacity-0 -z-10 scale-105"
              }`}
            />
          );
        })}

        {/* DESKTOP OVERLAYS: Light, subtle gradient for text contrast while keeping 100% image clarity and brightness */}
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-l from-black/70 via-black/20 to-transparent pointer-events-none z-10" />
        <div className="hidden lg:block absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none z-10" />

        {/* DESKTOP HERO SIDE CHEVRON BUTTONS (Placed directly on the edges of the hero image) */}
        <button
          type="button"
          onClick={handlePrevSlide}
          className="hidden lg:flex absolute right-4 xl:right-8 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-[#55565A]/75 hover:bg-[#E06518] border border-white/20 hover:border-[#E06518] text-white items-center justify-center backdrop-blur-md shadow-2xl transition-all cursor-pointer active:scale-90 group"
          aria-label="اسلاید قبلی"
        >
          <ChevronRight className="w-5 h-5 group-hover:scale-110 transition-transform text-white" />
        </button>

        <button
          type="button"
          onClick={handleNextSlide}
          className="hidden lg:flex absolute left-4 xl:left-8 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-[#55565A]/75 hover:bg-[#E06518] border border-white/20 hover:border-[#E06518] text-white items-center justify-center backdrop-blur-md shadow-2xl transition-all cursor-pointer active:scale-90 group"
          aria-label="اسلاید بعدی"
        >
          <ChevronLeft className="w-5 h-5 group-hover:scale-110 transition-transform text-white" />
        </button>

        {/* Top & Middle Content Container */}
        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 lg:pt-12 pb-4 sm:pb-6 lg:pb-10 flex-1 flex flex-col justify-center">
          {/* ================================================================= */}
          {/* DESKTOP VIEW (lg+): ORIGINAL FULL-BLEED CINEMATIC HERO LAYOUT     */}
          {/* ================================================================= */}
          <div className="hidden lg:block">
            <div
              key={`desktop-hero-${heroSlideIndex}`}
              className="max-w-xl lg:max-w-2xl space-y-4 sm:space-y-6 transition-all duration-500 ease-out animate-in fade-in slide-in-from-right-3"
            >
              {/* Top Eyebrow Tag */}
              <div className="flex items-center gap-2 justify-start">
                <span className="w-6 sm:w-8 h-[2px] bg-[#E06518]" />
                <span className="text-[11px] sm:text-[13px] font-bold text-orange-400/90 tracking-wide line-clamp-1">
                  {heroSlides[heroSlideIndex].eyebrow}
                </span>
              </div>

              {/* Main Headline (With Fade & Shift to Right on Scroll) */}
              <div
                className="transition-all duration-100 ease-out will-change-transform"
                style={{
                  opacity: 1,
                  transform: "none",
                }}
              >
                <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-black leading-[1.25] sm:leading-[1.18] tracking-tight text-white drop-shadow-md">
                  <span>{heroSlides[heroSlideIndex].titlePart1}</span>
                  <span className="block text-[#E06518] pt-1.5">
                    {heroSlides[heroSlideIndex].titlePart2}
                  </span>
                </h1>
              </div>

              {/* Action Buttons & Subtitle */}
              <div className="pt-2 sm:pt-4 space-y-3.5 sm:space-y-5">
                {/* Subtitle Description */}
                <p className="text-xs sm:text-[15px] text-slate-200/95 leading-relaxed max-w-xl font-normal min-h-[38px] sm:min-h-[48px]">
                  {heroSlides[heroSlideIndex].description}
                </p>

                {/* Action Buttons Row */}
                <div className="pt-1 flex items-center gap-3.5">
                  {/* Primary Button */}
                  {heroSlides[heroSlideIndex].primaryBtn.link ? (
                    <Link
                      to={heroSlides[heroSlideIndex].primaryBtn.link!}
                      className="h-12 sm:h-13 px-6 sm:px-8 bg-gradient-to-r from-[#C95210] to-[#E06518] hover:from-[#C2410C] hover:to-[#C95210] text-white font-black text-xs sm:text-sm rounded-xl shadow-[0_6px_18px_rgba(249,115,22,0.35)] hover:shadow-[0_8px_22px_rgba(249,115,22,0.5)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-95"
                    >
                      <span>{heroSlides[heroSlideIndex].primaryBtn.text}</span>
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-white" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          heroSlides[heroSlideIndex].primaryBtn.action ===
                          "visualSearch"
                        ) {
                          setIsVisualSearchOpen(true);
                        } else if (
                          heroSlides[heroSlideIndex].primaryBtn.action ===
                          "consult"
                        ) {
                          navigate("/ai-consult");
                        }
                      }}
                      className="h-12 sm:h-13 px-6 sm:px-8 bg-gradient-to-r from-[#C95210] to-[#E06518] hover:from-[#C2410C] hover:to-[#C95210] text-white font-black text-xs sm:text-sm rounded-xl shadow-[0_6px_18px_rgba(249,115,22,0.35)] hover:shadow-[0_8px_22px_rgba(249,115,22,0.5)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-95"
                    >
                      <Camera className="w-4 h-4 text-white" />
                      <span>{heroSlides[heroSlideIndex].primaryBtn.text}</span>
                    </button>
                  )}

                  {/* Secondary Button */}
                  {heroSlides[heroSlideIndex].secondaryBtn.action ===
                  "consult" ? (
                    <button
                      type="button"
                      onClick={() => navigate("/ai-consult")}
                      className="h-12 sm:h-13 px-5 sm:px-7 bg-[#55565A]/70 hover:bg-[#55565A]/85 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/20 hover:border-orange-500/70 backdrop-blur-md transition-all flex items-center justify-center gap-2.5 cursor-pointer group shadow-md active:scale-95"
                    >
                      <span className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[#E06518] group-hover:scale-110 transition-transform">
                        <Play className="w-3 h-3 fill-[#E06518] text-[#E06518] ml-0.5" />
                      </span>
                      <span>
                        {heroSlides[heroSlideIndex].secondaryBtn.text}
                      </span>
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsVisualSearchOpen(true)}
                      className="h-12 sm:h-13 px-5 sm:px-7 bg-[#55565A]/70 hover:bg-[#55565A]/85 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/20 hover:border-orange-500/70 backdrop-blur-md transition-all flex items-center justify-center gap-2.5 cursor-pointer group shadow-md active:scale-95"
                    >
                      <span>
                        {heroSlides[heroSlideIndex].secondaryBtn.text}
                      </span>
                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                  )}
                </div>
              </div>

              {/* Slide Navigation Dots with 5-Second Timer Progress Bar & Controls */}
              <div className="pt-3 sm:pt-4 flex items-center justify-start gap-3">
                <div className="flex items-center gap-2 bg-[#55565A]/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  {heroSlides.map((slide, idx) => {
                    const isActive = idx === heroSlideIndex;
                    return (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setHeroSlideIndex(idx)}
                        className={`relative h-2 rounded-full transition-all duration-300 overflow-hidden cursor-pointer ${
                          isActive
                            ? "w-8 bg-orange-500/30"
                            : "w-2 bg-white/30 hover:bg-white/50"
                        }`}
                        aria-label={`اسلاید ${idx + 1}`}
                      >
                        {isActive && (
                          <div
                            key={`progress-desktop-${idx}-${heroSlideIndex}`}
                            className="absolute inset-0 bg-[#E06518] rounded-full"
                            style={{
                              animation: "heroProgress 5s linear forwards",
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Slide Counter (01 / 04) */}
                <span className="text-[11px] font-mono font-bold text-slate-300">
                  0{heroSlideIndex + 1} / 0{heroSlides.length}
                </span>

                {/* Prev / Next Arrows */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="w-7 h-7 rounded-full bg-[#55565A]/70 hover:bg-[#E06518] border border-white/15 hover:border-[#E06518] text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                    aria-label="اسلاید قبلی"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="w-7 h-7 rounded-full bg-[#55565A]/70 hover:bg-[#E06518] border border-white/15 hover:border-[#E06518] text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
                    aria-label="اسلاید بعدی"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: large image-backed carousel; all campaign copy is designed inside each banner. */}
          <div className="lg:hidden w-full space-y-3.5" dir="rtl">
            <div
              className="mobile-home-hero relative isolate w-full aspect-[1.68/1] min-h-[198px] max-h-[248px] overflow-hidden rounded-[20px] border border-slate-200 bg-[#20262d] shadow-[0_8px_24px_rgba(24,32,42,.16)]"
              role="region"
              aria-label="بنرهای اسلایدی صفحه اصلی"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                key={activeMobileHeroSlide.id}
                src={activeMobileHeroSlide.image}
                alt={activeMobileHeroSlide.alt}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover object-center animate-in fade-in duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-[#151b22]/95 via-[#151b22]/68 to-[#151b22]/5" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

              <span className="absolute right-3 top-3 z-20 max-w-[72%] rounded-full border border-white/15 bg-[#E06518] px-3 py-1.5 text-[9px] font-extrabold text-white shadow-lg">
                {activeMobileHeroSlide.badge}
              </span>
              <span className="absolute left-3 top-3 z-20 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[9px] font-bold text-white/90 backdrop-blur-sm">
                {toPersianDigits(mobileHeroSlideIndex + 1)} از {toPersianDigits(mobileHeroSlides.length)}
              </span>

              <div
                key={activeMobileHeroSlide.id + "-copy"}
                className="absolute inset-0 z-10 flex flex-col justify-center px-4 pb-5 pt-8 text-right animate-in fade-in slide-in-from-right-2 duration-500"
              >
                <div className="w-[84%] max-w-[310px]">
                  <h2 className="text-[clamp(18px,5.2vw,25px)] font-black leading-[1.48] tracking-tight text-white drop-shadow-md">
                    <span className="block">{activeMobileHeroSlide.title}</span>
                    <span className="mt-0.5 block text-[#FF9B59]">{activeMobileHeroSlide.highlight}</span>
                  </h2>
                  <p className="mt-2 max-w-[290px] text-[10px] font-medium leading-[1.9] text-white/90 line-clamp-2">
                    {activeMobileHeroSlide.description}
                  </p>
                  <span className="mt-2.5 block h-[3px] w-12 rounded-full bg-[#E06518] shadow-[0_0_12px_rgba(224,101,24,.55)]" />
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1.5" aria-label="انتخاب اسلاید">
                {mobileHeroSlides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setMobileHeroSlideIndex(idx)}
                    aria-label={`نمایش بنر ${idx + 1}`}
                    aria-pressed={idx === mobileHeroSlideIndex}
                    className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                      idx === mobileHeroSlideIndex
                        ? "w-6 bg-[#F47725] shadow-[0_0_8px_rgba(244,119,37,.6)]"
                        : "w-1.5 bg-white/65 hover:bg-white"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleMobilePrevSlide}
                aria-label="بنر قبلی"
                className="absolute bottom-1.5 left-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-black/35 text-white shadow-md backdrop-blur-sm active:scale-90"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleMobileNextSlide}
                aria-label="بنر بعدی"
                className="absolute bottom-1.5 right-2 z-20 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-black/35 text-white shadow-md backdrop-blur-sm active:scale-90"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mobile-hero-actions grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setIsVisualSearchOpen(true)}
                className="mobile-hero-action flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-[#D95F14] bg-gradient-to-l from-[#E96C1B] to-[#C9500E] px-4 py-3 text-[12px] font-extrabold text-white shadow-[0_5px_16px_rgba(213,91,20,.22)] transition active:scale-[.985]"
              >
                <Camera size={19} strokeWidth={2} />
                <span>شناسایی قطعه با هوش مصنوعی</span>
                <ArrowLeft size={16} />
              </button>
              <Link
                to="/contact"
                className="mobile-hero-action flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px] font-bold text-[#55565A] shadow-[0_3px_12px_rgba(28,35,45,.06)] transition hover:border-orange-200 hover:text-[#C95B17] active:scale-[.985]"
              >
                <PhoneCall size={18} strokeWidth={1.9} />
                <span>تماس با واحد فروش فوری</span>
                <ArrowLeft size={15} className="text-slate-400" />
              </Link>
            </div>
          </div>
        </div>

        {/* Far Left Vertical Scroll Visual Indicator (آیکون ماوس اسکرول + نشانگر برای دسکتاپ) */}
        <div className="absolute left-6 lg:left-8 top-1/2 -translate-y-1/2 z-20 hidden lg:flex flex-col items-center gap-2.5 text-slate-400">
          <div className="flex flex-col items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <span className="w-1.5 h-4 rounded-full bg-[#E06518] shadow-[0_0_6px_#E06518]" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
          </div>

          <div className="w-5 h-8 rounded-full border-2 border-white/35 flex items-start justify-center pt-1">
            <span className="w-1 h-1.5 rounded-full bg-white/80 animate-bounce" />
          </div>
          <span className="text-[8px] font-mono font-bold tracking-[0.2em] text-slate-400 uppercase rotate-180 [writing-mode:vertical-lr]">
            SCROLL
          </span>
        </div>

        {/* Bottom Left Badge on Desktop */}
        <div
          key={`badge-${heroSlideIndex}`}
          className="absolute left-4 sm:left-8 bottom-8 z-20 hidden lg:flex items-center gap-2 bg-[#55565A]/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 shadow-md transition-all duration-500 animate-in fade-in"
        >
          <div className="w-1.5 h-5 bg-[#E06518] rounded-full" />
          <div className="text-right">
            <div className="text-[11px] font-bold text-white">
              {heroSlides[heroSlideIndex].badge.title}
            </div>
            <div className="text-[9px] text-slate-400 font-medium">
              {heroSlides[heroSlideIndex].badge.subtitle}
            </div>
          </div>
          <ArrowLeft className="w-3 h-3 text-orange-400 mr-1" />
        </div>
      </section>
      <HomeCategoryStrip />
      <OurClientsSection />
      <div id="home-utility-products" className="home-sequence-products"><HighUtilityProductsSection /></div>
      <HomeIndustryShowcase />
      <section id="home-brands" className="home-brands-kept" aria-label="برندهای همکار صنعت پیش"><div className="editorial-wrap home-brands-heading"><div><span className="store-eyebrow">شناخت برند، انتخاب آگاهانه</span><h2>برندها در امتداد حرکت صنعت</h2></div><Link to="/brands" className="editorial-text-link">آشنایی با همه برندها <ArrowLeft size={17}/></Link></div><MainBrandsBanner /></section>
      <HomeForzaBanner />
      <HomeAboutSection />
      <HomeKnowledge />
      <HomeMembership />
      {isVisualSearchOpen && <React.Suspense fallback={null}>
        <LazyVisualSearch isOpen onClose={() => setIsVisualSearchOpen(false)} />
      </React.Suspense>}
      {isConsultOpen && <React.Suspense fallback={null}>
        <LazyAiConsult isOpen onClose={() => setIsConsultOpen(false)} />
      </React.Suspense>}
    </div>
  );
};
