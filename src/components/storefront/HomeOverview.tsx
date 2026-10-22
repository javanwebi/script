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
        <img src={STORE_ASSETS.aiSearchMobile} alt="" loading="lazy" />
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
        <img
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
              <img
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
                <img
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
                  <img
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
                    <img
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
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#FFF4EB] border border-[#FBD5B5] text-[#E06518] flex items-center justify-center shrink-0 group-hover:bg-[#E06518] group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
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
                    <img
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
                  <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#FFF4EB] border border-[#FBD5B5] text-[#E06518] flex items-center justify-center shrink-0 group-hover:bg-[#E06518] group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
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
            <img
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
              <img
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
              <img src={image} alt={title} loading="lazy" />
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
