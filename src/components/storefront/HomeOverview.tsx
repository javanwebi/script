import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  MessageCircle,
  ArrowUpLeft,
  ArrowLeft,
  ShieldCheck,
  Factory,
  Layers,
  Headphones,
  Cpu,
  Settings,
  Package,
  Play,
  Users,
  Building2,
  Warehouse,
  Box,
  X,
  CheckCircle2,
} from "lucide-react";
import { STORE_ASSETS } from "../../assets/images";
import { getProductImageUrl } from "../../assets/imagesproducts";

export function HomeAssist({
  onVisual,
  onConsult,
}: {
  onVisual: () => void;
  onConsult: () => void;
}) {
  return (
    <section className="home-assist" aria-label="راهنمای پیدا کردن قطعه">
      <div className="home-assist-intro">
        <span className="store-eyebrow">از نیاز شما تا قطعه مناسب</span>
        <h2>پیدا کردن قطعه، ساده‌تر از همیشه</h2>
        <p>
          کد یا نام قطعه را جستجو کنید؛ برای انتخاب دقیق‌تر، تصویر بفرستید یا
          مشاوره بگیرید.
        </p>
      </div>
      <div className="home-assist-visual" aria-hidden="true">
        <img fetchPriority="low" decoding="async" src={STORE_ASSETS.aiSearchMobile} alt="" loading="lazy" />
        <span>
          <ScanLineGraphic /> از تصویر تا مشخصات قطعه
        </span>
      </div>
      <div className="home-assist-actions">
        <button onClick={onVisual} type="button">
          <Camera size={22} />
          <span>
            <strong>شناسایی با تصویر</strong>
            <small>عکس قطعه را دارید؟</small>
          </span>
          <ArrowUpLeft size={17} />
        </button>
        <button onClick={onConsult} type="button">
          <MessageCircle size={22} />
          <span>
            <strong>مشاوره انتخاب قطعه</strong>
            <small>مشخصات را با هم بررسی کنیم</small>
          </span>
          <ArrowUpLeft size={17} />
        </button>
      </div>
    </section>
  );
}

/**
 * WhySanatPish Section (Image 3 Reference):
 * - Top centered "WHY SANAT PISH" eyebrow with orange accent lines
 * - Header row: Right = "چرا صنعت پیش؟" + subtitle, Left = "معرفی کوتاه | ویدیوی ۱ دقیقه‌ای" video preview card
 * - 3-Column Hub:
 *   - Right 3 Cards: تمرکز بر صنایع اصلی | کیفیت و اصالت کالا | پشتیبانی تخصصی
 *   - Center: 3D Mechanical Core Sphere on glowing orange pedestal with floating glassmorphic part cards & circuit connectors
 *   - Left 3 Cards: تامین سریع و مطمئن | هوش مصنوعی FORZA | تنوع کامل محصولات
 * - Bottom Full-Width Dark Glassmorphic Bar: 4 stats (+5,000 مشتری فعال, +24 صنعت تحت پوشش, +864 تصویر واقعی محصول, +10,000 کد کالای صنعتی) + "درباره صنعت پیش بیشتر بدانید" CTA button
 * - Dedicated responsive mobile layout
 */
export function WhySanatPish() {
  const [introVideoOpen, setIntroVideoOpen] = useState(false);

  const rightPillars = [
    {
      id: "industries",
      title: "تمرکز بر صنایع اصلی",
      subtitle: "تامین قطعات تخصصی برای +۲۴ صنعت کلیدی کشور",
      image: STORE_ASSETS.industries.ceramic,
      Icon: Factory,
      link: "/industries",
    },
    {
      id: "quality",
      title: "کیفیت و اصالت کالا",
      subtitle: "همکاری با برندهای معتبر و تضمین کیفیت و استاندارد",
      image: STORE_ASSETS.whySanatQc,
      Icon: ShieldCheck,
      link: "/brands",
    },
    {
      id: "support",
      title: "پشتیبانی تخصصی",
      subtitle: "همراهی مهندسی از انتخاب تا نصب و بهره‌برداری",
      image: STORE_ASSETS.engineerWhyAtlas,
      Icon: Headphones,
      link: "/contact",
    },
  ];

  const leftPillars = [
    {
      id: "fast-supply",
      title: "تامین سریع و مطمئن",
      subtitle: "دسترسی به هزاران قطعه صنعتی با موجودی واقعی و ارسال سریع",
      image: STORE_ASSETS.whySanatExpressDelivery,
      Icon: Package,
      link: "/products",
    },
    {
      id: "forza-ai",
      title: "هوش مصنوعی FORZA",
      subtitle: "شناسایی قطعه از روی تصویر و مشاوره تخصصی ۲۴ ساعته",
      image: STORE_ASSETS.aiCyborgHero,
      Icon: Cpu,
      link: "/ai-consult",
    },
    {
      id: "full-variety",
      title: "تنوع کامل محصولات",
      subtitle: "از تسمه و پولی تا پروفیل، شیلنگ و هزاران قطعه دیگر",
      image: STORE_ASSETS.categories.belts,
      Icon: Settings,
      link: "/categories",
    },
  ];

  const floatingParts = [
    {
      id: "fp-belt",
      img: STORE_ASSETS.products.forzaBelt,
      fallback: getProductImageUrl("e(859).png"),
      pos: "top-2 right-6 sm:right-8 -rotate-6",
    },
    {
      id: "fp-coupling",
      img: getProductImageUrl("e(38).png"),
      fallback: STORE_ASSETS.products.aluPulley,
      pos: "top-6 left-4 sm:left-6 rotate-6",
    },
    {
      id: "fp-bearing",
      img: getProductImageUrl("e(383).png"),
      fallback: STORE_ASSETS.products.bearing,
      pos: "top-1/2 -translate-y-1/2 left-0 sm:left-2 -rotate-3",
    },
    {
      id: "fp-pulley",
      img: getProductImageUrl("e(165).png"),
      fallback: STORE_ASSETS.categories.pulleys,
      pos: "bottom-14 right-2 sm:right-4 rotate-6",
    },
    {
      id: "fp-bushing",
      img: getProductImageUrl("e(168).png"),
      fallback: STORE_ASSETS.products.ceramicRoller,
      pos: "bottom-12 left-6 sm:left-8 -rotate-6",
    },
  ];

  return (
    <section
      id="home-why-sanat-pish"
      aria-labelledby="why-sanat-pish-title"
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#F9FAFB] via-[#F2F4F7] to-[#E9EDF2] border-y border-slate-200/80 py-6 sm:py-12 my-4 sm:my-8"
      dir="rtl"
    >
      {/* Subtle Architectural Factory Background Silhouette */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <img fetchPriority="low" decoding="async"
          src={STORE_ASSETS.industries.bgPlant}
          alt=""
          className="w-full h-full object-cover object-center filter grayscale"
          loading="lazy"
        />
      </div>

      {/* Central Ambient Orange Radial Glow */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[520px] h-[320px] sm:h-[520px] rounded-full bg-[#E06518]/12 blur-3xl pointer-events-none z-0" />

      <div className="relative z-10 max-w-[1340px] mx-auto px-3.5 sm:px-6 lg:px-8">
        {/* ================================================================= */}
        {/* 1. TOP CENTERED EYEBROW: —— WHY SANAT PISH ——                     */}
        {/* ================================================================= */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2.5 sm:mb-6">
          <span className="w-8 sm:w-16 h-[1.5px] bg-gradient-to-l from-[#E06518] to-transparent" />
          <span
            className="text-[9px] sm:text-xs font-mono font-bold tracking-[0.2em] sm:tracking-[0.28em] text-slate-500 uppercase"
            dir="ltr"
          >
            WHY SANAT PISH
          </span>
          <span className="w-8 sm:w-16 h-[1.5px] bg-gradient-to-r from-[#E06518] to-transparent" />
        </div>

        {/* ================================================================= */}
        {/* 2. HEADER ROW: Title & Subtitle (Right) + Video Preview (Left)    */}
        {/* ================================================================= */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-3 sm:gap-5 mb-5 sm:mb-10">
          {/* Right Title & Subtitle */}
          <div className="text-center lg:text-right space-y-1 sm:space-y-2 max-w-xl">
            <h2
              id="why-sanat-pish-title"
              className="text-2xl sm:text-4xl lg:text-[44px] font-black text-[#1E2024] tracking-tight leading-tight"
            >
              چرا <span className="text-[#E06518]">صنعت پیش</span>؟
            </h2>
            <p className="text-[11px] sm:text-sm lg:text-[15px] text-slate-600 leading-relaxed font-medium">
              ترکیبی از تجربه صنعتی، تامین گسترده و هوش مصنوعی
              <br className="hidden sm:inline" /> برای حرکت بی‌وقفه خطوط تولید
              شما
            </p>
          </div>

          {/* Left Video Preview Card (معرفی کوتاه | ویدیوی ۱ دقیقه‌ای) */}
          <button
            type="button"
            onClick={() => setIntroVideoOpen(true)}
            className="group w-full sm:w-auto bg-white/95 hover:bg-white backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-[#E06518] p-1.5 sm:p-2.5 shadow-xs hover:shadow-md transition-all flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3.5 cursor-pointer"
          >
            {/* Video Thumbnail on Right */}
            <div className="relative w-24 sm:w-44 h-11 sm:h-18 rounded-lg sm:rounded-xl overflow-hidden border border-[#E06518]/60 shrink-0 bg-slate-900">
              <img fetchPriority="low" decoding="async"
                src={STORE_ASSETS.industries.ceramic}
                alt="معرفی کوتاه صنعت پیش"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/30 backdrop-blur-xs border border-white/80 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Play className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 fill-white ml-0.5" />
                </span>
              </div>
            </div>

            {/* Text & Play Icon on Left */}
            <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2">
              <div className="text-right">
                <div className="text-[11px] sm:text-sm font-black text-[#23262B] group-hover:text-[#E06518] transition-colors">
                  معرفی کوتاه
                </div>
                <div className="text-[9px] sm:text-[11px] text-slate-500 font-medium mt-0.5">
                  ویدیوی ۱ دقیقه‌ای
                </div>
              </div>
              <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-[#E06518]/70 text-[#E06518] group-hover:bg-[#E06518] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <Play className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 fill-current ml-0.5" />
              </span>
            </div>
          </button>
        </div>

        {/* ================================================================= */}
        {/* 3. MAIN 3-COLUMN HUB (Right 3 Cards + Center Core + Left 3 Cards) */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 lg:gap-4 items-center">
          {/* CENTER COLUMN ON MOBILE (Futuristic Levitating Orbital Engine) */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center py-1 sm:py-4 order-1 lg:order-2">
            <div className="relative w-44 h-44 sm:w-84 sm:h-84 flex items-center justify-center">
              {/* Outer Technical HUD Rings */}
              <svg
                viewBox="0 0 340 340"
                className="absolute inset-0 w-full h-full pointer-events-none opacity-60 sm:opacity-100"
                fill="none"
              >
                <circle
                  cx="170"
                  cy="155"
                  r="138"
                  stroke="#CBD5E1"
                  strokeWidth="1"
                  strokeDasharray="6 6"
                />
                <circle
                  cx="170"
                  cy="155"
                  r="118"
                  stroke="#E06518"
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />
                {/* Glowing Energy Arc */}
                <path
                  d="M 55 155 A 115 115 0 0 1 285 155"
                  stroke="#E06518"
                  strokeWidth="2"
                  strokeDasharray="18 10"
                />
              </svg>

              {/* Central Levitating Orbital Engine Assembly Image */}
              <div className="relative z-10 w-32 h-32 sm:w-64 sm:h-64 flex items-center justify-center">
                <img fetchPriority="low" decoding="async"
                  src={STORE_ASSETS.levitatingOrbitalEngine}
                  alt="موتور لویتاسیون صنعتی - صنعت پیش"
                  className="w-full h-full object-contain drop-shadow-[0_12px_28px_rgba(224,101,24,0.35)] relative z-10 transition-transform hover:scale-105 duration-300"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Floating Translucent Glassmorphic Part Cards Around Sphere (Desktop / Tablet) */}
              {floatingParts.map((fp) => (
                <div
                  key={fp.id}
                  className={`hidden sm:flex absolute ${fp.pos} z-20 w-13 h-13 sm:w-15 sm:h-15 rounded-xl bg-white/80 backdrop-blur-md border border-white shadow-lg p-1.5 items-center justify-center transform-gpu`}
                >
                  <img fetchPriority="low" decoding="async"
                    src={fp.img}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = fp.fallback;
                    }}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}

              {/* Glowing 3-Tier Industrial Base Pedestal */}
              <div className="absolute -bottom-2 sm:-bottom-3 inset-x-6 flex flex-col items-center pointer-events-none z-10">
                <div className="w-28 sm:w-48 h-2 sm:h-3 rounded-full bg-gradient-to-r from-slate-700 via-[#E06518] to-slate-700 shadow-[0_0_15px_#E06518]" />
                <div className="w-36 sm:w-60 h-2.5 sm:h-4 rounded-full bg-gradient-to-b from-slate-700 to-slate-900 border border-orange-400/50 -mt-1" />
                <div className="w-44 sm:w-68 h-1.5 sm:h-2.5 rounded-full bg-gradient-to-r from-transparent via-[#E06518] to-transparent opacity-85" />
              </div>
            </div>
          </div>

          {/* COMBINED COMPACT GRID FOR MOBILE (2 columns on mobile, 1 column on lg) */}
          <div className="lg:col-span-8 order-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3.5 lg:contents">
            {/* RIGHT PILLARS IN RTL */}
            <div className="space-y-2 sm:space-y-3.5 lg:space-y-4 lg:col-span-4 lg:order-1">
              {rightPillars.map(({ id, title, subtitle, image, Icon, link }) => (
                <Link
                  key={id}
                  to={link}
                  className="group relative bg-white/95 hover:bg-white backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-[#E06518]/60 shadow-2xs hover:shadow-md p-2 sm:p-3.5 flex items-center justify-between gap-2.5 transition-all"
                >
                  {/* Right Photo */}
                  <div className="w-13 h-13 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100">
                    <img fetchPriority="low" decoding="async"
                      src={image}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Middle Title & Subtitle */}
                  <div className="flex-1 text-right min-w-0">
                    <h3 className="text-xs sm:text-[15px] font-black text-[#23262B] group-hover:text-[#E06518] transition-colors truncate">
                      {title}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 leading-snug sm:leading-relaxed mt-0.5 sm:mt-1 line-clamp-2">
                      {subtitle}
                    </p>
                  </div>

                  {/* Left Soft-Orange Icon Box */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-white to-[#FFF1E6] border border-orange-100 text-[#E06518] shadow-[0_3px_10px_rgba(224,101,24,.10)] flex items-center justify-center shrink-0 group-hover:bg-[#E06518] group-hover:text-white group-hover:border-[#E06518] transition-all">
                    <Icon className="w-[19px] h-[19px] sm:w-[22px] sm:h-[22px]" strokeWidth={1.8} />
                  </div>

                  {/* Desktop Orange Circuit Node Connector Line */}
                  <span className="hidden lg:flex items-center absolute -left-5 top-1/2 -translate-y-1/2 pointer-events-none z-20">
                    <span className="w-2 h-2 rounded-full bg-[#E06518]" />
                    <span className="w-4 h-[1.5px] bg-[#E06518]" />
                  </span>
                </Link>
              ))}
            </div>

            {/* LEFT PILLARS IN RTL */}
            <div className="space-y-2 sm:space-y-3.5 lg:space-y-4 lg:col-span-4 lg:order-3">
              {leftPillars.map(({ id, title, subtitle, image, Icon, link }) => (
                <Link
                  key={id}
                  to={link}
                  className="group relative bg-white/95 hover:bg-white backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-[#E06518]/60 shadow-2xs hover:shadow-md p-2 sm:p-3.5 flex items-center justify-between gap-2.5 transition-all"
                >
                  {/* Desktop Orange Circuit Node Connector Line */}
                  <span className="hidden lg:flex items-center absolute -right-5 top-1/2 -translate-y-1/2 pointer-events-none z-20">
                    <span className="w-4 h-[1.5px] bg-[#E06518]" />
                    <span className="w-2 h-2 rounded-full bg-[#E06518]" />
                  </span>

                  {/* Right Photo */}
                  <div className="w-13 h-13 sm:w-20 sm:h-20 rounded-lg sm:rounded-xl overflow-hidden shrink-0 border border-slate-200/80 bg-slate-100">
                    <img fetchPriority="low" decoding="async"
                      src={image}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Middle Title & Subtitle */}
                  <div className="flex-1 text-right min-w-0">
                    <h3 className="text-xs sm:text-[15px] font-black text-[#23262B] group-hover:text-[#E06518] transition-colors truncate">
                      {title}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 leading-snug sm:leading-relaxed mt-0.5 sm:mt-1 line-clamp-2">
                      {subtitle}
                    </p>
                  </div>

                  {/* Left Soft-Orange Icon Box */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-white to-[#FFF1E6] border border-orange-100 text-[#E06518] shadow-[0_3px_10px_rgba(224,101,24,.10)] flex items-center justify-center shrink-0 group-hover:bg-[#E06518] group-hover:text-white group-hover:border-[#E06518] transition-all">
                    <Icon className="w-[19px] h-[19px] sm:w-[22px] sm:h-[22px]" strokeWidth={1.8} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. BOTTOM FULL-WIDTH DARK GLASSMORPHIC STATS & CTA BAR            */}
        {/* ================================================================= */}
        <div className="mt-5 sm:mt-12 relative rounded-xl sm:rounded-3xl overflow-hidden bg-[#35383E]/95 backdrop-blur-xl border border-white/15 shadow-xl text-white">
          {/* Glowing Factory Line Perspective Image on the Left Side of Bar */}
          <div className="absolute inset-y-0 left-0 w-full sm:w-2/5 z-0 pointer-events-none opacity-25 sm:opacity-65">
            <img fetchPriority="low" decoding="async"
              src={STORE_ASSETS.industries.ceramic}
              alt=""
              className="w-full h-full object-cover object-left"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#35383E]/80 to-[#35383E]" />
          </div>

          <div className="relative z-10 p-3.5 sm:px-7 sm:py-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5 sm:gap-6">
            {/* Rightmost on Desktop / Bottom on Mobile: Solid Orange CTA Button */}
            <div className="order-2 lg:order-1 shrink-0">
              <Link
                to="/about"
                className="w-full lg:w-auto h-9 sm:h-12 px-4 sm:px-6 rounded-lg sm:rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-[11px] sm:text-sm flex items-center justify-center gap-2 sm:gap-2.5 shadow-md shadow-orange-500/25 transition-all active:scale-95 whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>درباره صنعت پیش بیشتر بدانید</span>
              </Link>
            </div>

            {/* 4 Key Industrial Metrics (2x2 Grid on Mobile, 4 Columns on Desktop) */}
            <div className="order-1 lg:order-2 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-white/15">
              {/* Stat 1: +5,000 مشتری فعال */}
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 pt-1 sm:pt-0 sm:pr-4">
                <div className="text-right">
                  <div
                    className="text-base sm:text-2xl font-black tracking-tight tabular-nums text-white"
                    dir="ltr"
                  >
                    +5,000
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-300 font-medium mt-0.5">
                    مشتری فعال
                  </div>
                </div>
                <Users className="w-4 h-4 sm:w-6 sm:h-6 text-[#E06518] shrink-0" />
              </div>

              {/* Stat 2: +24 صنعت تحت پوشش */}
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 pt-1 sm:pt-0 sm:pr-5">
                <div className="text-right">
                  <div
                    className="text-base sm:text-2xl font-black tracking-tight tabular-nums text-white"
                    dir="ltr"
                  >
                    +24
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-300 font-medium mt-0.5">
                    صنعت تحت پوشش
                  </div>
                </div>
                <Building2 className="w-4 h-4 sm:w-6 sm:h-6 text-slate-300 shrink-0" />
              </div>

              {/* Stat 3: +864 تصویر واقعی محصول */}
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 pt-1.5 sm:pt-0 sm:pr-5">
                <div className="text-right">
                  <div
                    className="text-base sm:text-2xl font-black tracking-tight tabular-nums text-white"
                    dir="ltr"
                  >
                    +864
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-300 font-medium mt-0.5">
                    تصویر واقعی محصول
                  </div>
                </div>
                <Warehouse className="w-4 h-4 sm:w-6 sm:h-6 text-slate-300 shrink-0" />
              </div>

              {/* Stat 4: +10,000 کد کالای صنعتی */}
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 pt-1.5 sm:pt-0 sm:pr-5">
                <div className="text-right">
                  <div
                    className="text-base sm:text-2xl font-black tracking-tight tabular-nums text-white"
                    dir="ltr"
                  >
                    +10,000
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-300 font-medium mt-0.5">
                    کد کالای صنعتی
                  </div>
                </div>
                <Box className="w-4 h-4 sm:w-6 sm:h-6 text-[#E06518] shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SHORT INTRO VIDEO / OVERVIEW MODAL                                */}
      {/* ================================================================= */}
      {introVideoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIntroVideoOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-right space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-[#E06518]">
                  معرفی کوتاه مجموعه
                </span>
                <h3 className="text-base sm:text-lg font-black text-[#23262B]">
                  صنعت پیش؛ با پشتوانه بازرگانی تسمه اطلس از سال ۱۳۶۶
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIntroVideoOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden h-52 bg-slate-900 border border-slate-200">
              <img fetchPriority="low" decoding="async" loading="lazy"
                src={STORE_ASSETS.whySanatDirectFactory}
                alt="مجموعه صنعت پیش"
                className="w-full h-full object-cover opacity-85"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-5 flex flex-col justify-end text-white">
                <div className="text-sm font-black">
                  تأمین، ساخت و مهندسی قطعات خطوط تولید کشور
                </div>
                <p className="text-xs text-slate-200 mt-1">
                  بیش از ۱۰,۰۰۰ کد کالای صنعتی، ۸۶۴ خانواده تصویری مستند و پوشش
                  ۲۴ صنعت کلیدی کشور
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700 font-bold">
              {[
                "تأمین مستقیم برندهای معتبر صنعتی",
                "شناسایی هوشمند قطعه با FORZA AI",
                "ساخت و مهندسی معکوس قطعات سفارشی",
                "ارسال سریع به کارخانجات سراسر کشور",
              ].map((point) => (
                <div
                  key={point}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#E06518] shrink-0" />
                  <span>{point}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                to="/about"
                className="h-10 px-5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-2"
              >
                <span>مشاهده صفحه درباره ما</span>
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIntroVideoOpen(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ScanLineGraphic() {
  return <Camera size={18} />;
}

export function IndustrialServices() {
  const services = [
    {
      image: STORE_ASSETS.partsWarehouseVault,
      Icon: Layers,
      title: "تأمین قطعات خطوط تولید",
      text: "تسمه، پولی، بلبرینگ و قطعات انتقال قدرت؛ کالاها را با تصویر، کد و مشخصات فنی بررسی کنید.",
      to: "/products",
      action: "مشاهده محصولات",
    },
    {
      image: STORE_ASSETS.whySanatCadEngineering,
      Icon: Factory,
      title: "ساخت و مهندسی قطعات",
      text: "برای قطعات سفارشی، نمونه یا نقشه خود را ارائه کنید تا امکان ساخت و مشخصات مورد نیاز بررسی شود.",
      to: "/contact",
      action: "درخواست مشاوره ساخت",
    },
    {
      image: STORE_ASSETS.whySanatQc,
      Icon: ShieldCheck,
      title: "همراه انتخاب فنی شما",
      text: "برای انتخاب قطعه متناسب با دستگاه و شرایط کار، مشخصات و نیاز خط تولیدتان را با ما در میان بگذارید.",
      to: "/contact",
      action: "ارتباط با کارشناسان",
    },
  ];
  return (
    <section className="home-services" aria-labelledby="home-services-title">
      <div className="store-section-heading">
        <div>
          <span className="store-eyebrow">
            صنعت پیش؛ با پشتوانه بازرگانی تسمه اطلس
          </span>
          <h2 id="home-services-title">از تأمین تا ساخت، کنار خط تولید شما</h2>
          <p>
            قطعه مناسب را پیدا کنید، مشخصات را بررسی کنید و مسیر خرید را در پنل
            خود دنبال کنید.
          </p>
        </div>
        <Link to="/about" className="store-btn-secondary">
          آشنایی با صنعت پیش <ArrowUpLeft size={17} />
        </Link>
      </div>
      <div className="home-services-grid">
        {services.map(({ image, Icon, title, text, to, action }, i) => (
          <article key={title}>
            <div className="home-services-photo">
              <img fetchPriority="low" decoding="async" src={image} alt={title} loading="lazy" />
              <span className="home-services-number">۰{i + 1}</span>
            </div>
            <div className="home-services-body">
              <span className="home-services-icon">
                <Icon size={23} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to={to}>
                {action}
                <ArrowUpLeft size={17} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="home-purchase-path" aria-label="مسیر خرید">
        <strong>مسیر روشن خرید</strong>
        {[
          "پیدا کردن کد یا خانواده قطعه",
          "بررسی تصویر، مشخصات و قیمت",
          "ثبت سفارش و پیگیری در پنل",
        ].map((text, i) => (
          <span key={text}>
            <b>{i + 1}</b>
            {text}
          </span>
        ))}
      </div>
    </section>
  );
}


/**
 * Dedicated homepage introduction for Sanat Pish.
 * Keeps the company story separate from the existing "Why Sanat Pish" section.
 */
const HOME_ABOUT_CAPABILITIES = [
  {
    title: "تأمین قطعات صنعتی",
    description: "تسمه، پولی، یاتاقان و تجهیزات موردنیاز خطوط تولید.",
    Icon: Package,
  },
  {
    title: "ساخت و مهندسی معکوس",
    description: "بررسی نمونه و همراهی در طراحی و ساخت قطعات خاص و کمیاب.",
    Icon: Settings,
  },
  {
    title: "مشاوره فنی و انتخاب",
    description: "توجه به ابعاد، جنس، کاربرد و شرایط واقعی کار.",
    Icon: Layers,
  },
  {
    title: "پشتیبانی و پیگیری سفارش",
    description: "همراهی در مسیر استعلام، ثبت سفارش و پیگیری مراحل.",
    Icon: Headphones,
  },
] as const;

const HOME_ABOUT_WORKFLOW = [
  {
    number: "01",
    title: "شناخت نیاز",
    description: "دریافت اطلاعات و شناخت مسئله خط تولید",
  },
  {
    number: "02",
    title: "بررسی فنی",
    description: "بررسی ابعاد، جنس، کاربرد و مشخصات قطعه",
  },
  {
    number: "03",
    title: "تأمین یا ساخت",
    description: "انتخاب مسیر مناسب برای تهیه قطعه",
  },
  {
    number: "04",
    title: "پیگیری سفارش",
    description: "همراهی تا مرحله تحویل و پاسخ‌گویی",
  },
] as const;

export function HomeAboutSection() {
  return (
    <section
      id="home-about-sanat-pish"
      aria-labelledby="home-about-sanat-pish-title"
      dir="rtl"
      className="relative isolate overflow-hidden bg-[#F6F7F8] py-12 sm:py-16 lg:py-20"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(85,86,90,.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(85,86,90,.035)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute right-0 top-0 h-full w-[3px] bg-[#E06518]/65" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Authentic factory and engineering imagery */}
          <div className="relative order-1 min-w-0 pb-7 sm:pb-9 lg:pb-10">
            <div
              aria-hidden="true"
              className="absolute -bottom-1 -left-2 right-3 top-3 rounded-[20px] border border-[#E06518]/35 sm:-left-3 sm:right-5"
            />
            <div className="group relative aspect-[1.16/1] overflow-hidden rounded-[18px] border border-slate-200 bg-slate-200 shadow-[0_18px_48px_rgba(31,41,55,.14)] sm:aspect-[1.3/1] sm:rounded-[22px] lg:aspect-[1.12/1]">
              <img
                fetchPriority="low"
                decoding="async"
                loading="lazy"
                src={STORE_ASSETS.whySanatDirectFactory}
                alt="فضای صنعتی و مجموعه تأمین قطعات صنعت پیش"
                className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.035]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171B21]/80 via-[#171B21]/5 to-transparent" />
              <span
                dir="ltr"
                className="absolute bottom-14 left-4 select-none text-[clamp(4.5rem,10vw,8.5rem)] font-black leading-none tracking-[-0.08em] text-white/15 sm:bottom-16 sm:left-7"
              >
                1366
              </span>
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 sm:inset-x-6 sm:bottom-6">
                <div className="min-w-0 text-right text-white">
                  <span dir="ltr" className="block text-[9px] font-bold tracking-[0.28em] text-orange-200 sm:text-[10px]">
                    SANAT PISH
                  </span>
                  <strong className="mt-1 block text-sm font-black sm:text-lg">
                    پیش به صنعت؛ همراه خطوط تولید
                  </strong>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-[#2B313A]/65 text-white backdrop-blur-sm sm:h-12 sm:w-12">
                  <Factory size={23} strokeWidth={1.7} />
                </span>
              </div>
            </div>

            <div className="absolute -bottom-1 left-3 z-20 w-[48%] max-w-[250px] overflow-hidden rounded-[14px] border-[5px] border-[#F6F7F8] bg-white shadow-[0_12px_28px_rgba(31,41,55,.18)] sm:left-7 sm:rounded-[16px]">
              <div className="group relative aspect-[1.22/1] overflow-hidden">
                <img
                  fetchPriority="low"
                  decoding="async"
                  loading="lazy"
                  src={STORE_ASSETS.whySanatCadEngineering}
                  alt="بخش مهندسی و طراحی قطعات صنعتی"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 bg-[#2B313A]/90 px-2.5 py-2 text-right text-[9px] font-black text-white sm:px-3 sm:text-[11px]">
                  ساخت و مهندسی معکوس
                </div>
              </div>
            </div>

            <div className="absolute -top-3 right-3 z-20 sm:right-7">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_10px_24px_rgba(31,41,55,.12)] sm:gap-3 sm:px-4">
                <span className="h-9 w-1 rounded-full bg-[#E06518] sm:h-11" />
                <span className="text-right">
                  <span className="block text-[9px] font-semibold text-slate-500 sm:text-[10px]">
                    پیشینه فعالیت
                  </span>
                  <strong className="block text-lg font-black leading-tight text-[#2B313A] sm:text-xl">
                    ۱۳۶۶
                  </strong>
                </span>
                <Building2 size={21} className="text-[#E06518]" strokeWidth={1.8} />
              </div>
            </div>
          </div>

          {/* Company story and practical capabilities */}
          <div className="order-2 min-w-0 text-right">
            <div className="flex items-center gap-3">
              <span className="h-[2px] w-8 bg-[#E06518]" />
              <span className="text-[11px] font-black text-[#E06518] sm:text-xs">
                درباره صنعت پیش
              </span>
              <span dir="ltr" className="border-r border-slate-300 pr-3 text-[9px] font-bold tracking-[0.18em] text-slate-400">
                ABOUT US
              </span>
            </div>

            <h2
              id="home-about-sanat-pish-title"
              className="mt-4 text-[clamp(1.8rem,3.6vw,2.8rem)] font-black leading-[1.55] tracking-tight text-[#252A30]"
            >
              از تجربه‌ای ریشه‌دار تا راهکارهای مهندسی برای
              <span className="mr-2 inline-block text-[#E06518]">
                صنعت ایران
              </span>
            </h2>

            <div className="mt-4 h-1 w-16 rounded-full bg-[#E06518]" />

            <div className="mt-5 space-y-3.5 text-[13px] leading-[2.15] text-slate-600 sm:text-sm sm:leading-[2.2]">
              <p>
                ریشه فعالیت صنعت پیش به بازرگانی تسمه اطلس بازمی‌گردد؛ مسیری که از سال ۱۳۶۶ آغاز شده است. این پیشینه امروز در قالب مجموعه‌ای متمرکز بر تأمین تخصصی قطعات و تجهیزات خطوط تولید، ساخت قطعات سفارشی و ارائه راهکارهای مهندسی ادامه پیدا کرده است.
              </p>
              <p>
                نیاز هر خط تولید با خط دیگر متفاوت است. در فرایند انتخاب قطعه، نام و کد کالا تنها بخشی از اطلاعات‌اند؛ ابعاد، جنس، کاربرد و شرایط واقعی کار نیز باید در کنار هم بررسی شوند. هدف ما ساده‌تر کردن مسیر دسترسی صنعتگران به قطعه مناسب است؛ از شناخت نیاز و بررسی مشخصات تا پیشنهاد مسیر تأمین یا ساخت و پیگیری سفارش.
              </p>
              <p>
                در کنار کاتالوگ تخصصی محصولات، جست‌وجوی تصویری و مشاوره هوشمند FORZA نیز برای آسان‌تر شدن فرایند پیدا کردن قطعه و ارتباط با کارشناسان صنعت پیش در دسترس قرار گرفته‌اند.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {HOME_ABOUT_CAPABILITIES.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_14px_rgba(31,41,55,.035)] transition-colors hover:border-[#E06518]/45 sm:p-3.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-100 bg-[#FFF3EA] text-[#E06518]">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-xs font-black leading-6 text-[#2B313A] sm:text-[13px]">
                      {title}
                    </strong>
                    <span className="mt-0.5 block text-[10px] leading-6 text-slate-500 sm:text-[11px]">
                      {description}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/about"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E06518] px-5 py-3 text-xs font-black text-white transition-colors hover:bg-[#C95210] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E06518]"
              >
                <span>آشنایی بیشتر با صنعت پیش</span>
                <ArrowLeft size={17} />
              </Link>
              <Link
                to="/industries"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-xs font-bold text-[#42474D] transition-colors hover:border-[#E06518]/60 hover:bg-orange-50/60 hover:text-[#C95210] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E06518]"
              >
                مشاهده صنایع تحت پوشش
                <ArrowLeft size={16} className="text-[#E06518]" />
              </Link>
            </div>
          </div>
        </div>

        {/* A concise visual path from customer need to delivery */}
        <div className="mt-14 border-y border-[#434B55] bg-[#2B313A] px-5 py-6 sm:mt-16 sm:px-7 sm:py-8 lg:px-9">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <span dir="ltr" className="text-[9px] font-bold tracking-[0.24em] text-[#FF9B59] sm:text-[10px]">
                HOW WE WORK
              </span>
              <h3 className="mt-1 text-lg font-black text-white sm:text-2xl">
                از شناخت نیاز تا تأمین یا ساخت قطعه
              </h3>
            </div>
            <p className="max-w-xl text-[11px] leading-7 text-slate-300 sm:text-xs sm:leading-7">
              هر درخواست صنعتی مسیر خودش را دارد؛ مراحل همکاری با توجه به مشخصات و کاربرد قطعه پیش می‌رود.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-6 lg:grid-cols-4">
            {HOME_ABOUT_WORKFLOW.map((step, index) => (
              <div
                key={step.number}
                className="min-w-0 border-r-2 border-r-[#E06518] py-1 pr-3 sm:pr-4 lg:border-b-0"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span dir="ltr" className="font-mono text-xs font-black tracking-wider text-[#FF9B59]">
                    {step.number}
                  </span>
                  {index < HOME_ABOUT_WORKFLOW.length - 1 ? (
                    <ArrowLeft size={15} className="text-white/35" />
                  ) : (
                    <CheckCircle2 size={16} className="text-[#FF9B59]" />
                  )}
                </div>
                <strong className="block text-xs font-black text-white sm:text-sm">
                  {step.title}
                </strong>
                <p className="mt-1.5 text-[10px] leading-6 text-slate-300 sm:text-[11px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
