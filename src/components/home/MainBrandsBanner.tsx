import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { STORE_ASSETS } from '../../assets/images';

export const MainBrandsBanner: React.FC = () => {
  // Subcategories for FORZA (Ordered Left-to-Right matching reference image)
  const forzaCategories = [
    {
      id: 'belts',
      title: 'تسمه‌ها',
      image: STORE_ASSETS.forzaSubBelt || STORE_ASSETS.products.forzaBelt,
      link: '/category/industrial-belts',
    },
    {
      id: 'bearings',
      title: 'بلبرینگ‌ها',
      image: STORE_ASSETS.forzaSubBearing || STORE_ASSETS.products.bearing,
      link: '/category/power-transmission',
    },
    {
      id: 'couplings',
      title: 'کوپلینگ‌ها',
      image: STORE_ASSETS.forzaSubCoupling || STORE_ASSETS.categories.transmission,
      link: '/category/power-transmission',
    },
    {
      id: 'fittings',
      title: 'اتصالات صنعتی',
      image: STORE_ASSETS.forzaSubFittings || STORE_ASSETS.products.ceramicParts,
      link: '/category/production-fittings',
    },
  ];

  // Subcategories for ATLAS (Orange Industrial Accent)
  const atlasCategories = [
    {
      id: 'pulleys',
      title: 'پولی‌ها',
      image: STORE_ASSETS.categories.pulleys || STORE_ASSETS.products.aluPulley,
      link: '/category/power-transmission',
    },
    {
      id: 'belts',
      title: 'تسمه‌ها',
      image: STORE_ASSETS.categories.belts || STORE_ASSETS.products.pvcBelt,
      link: '/category/industrial-belts',
    },
    {
      id: 'sprockets',
      title: 'چرخ زنجیر',
      image: STORE_ASSETS.categories.chains || STORE_ASSETS.products.motor,
      link: '/category/power-transmission',
    },
    {
      id: 'transmission',
      title: 'انتقال قدرت',
      image: STORE_ASSETS.categories.transmission || STORE_ASSETS.products.bearing,
      link: '/category/power-transmission',
    },
  ];

  // Subcategories for SWR (Ordered Left-to-Right matching reference image)
  const swrCategories = [
    {
      id: 'valves',
      title: 'شیرآلات',
      image: STORE_ASSETS.swrSubValve || STORE_ASSETS.products.valve,
      link: '/category/industrial-valves',
    },
    {
      id: 'elbows',
      title: 'اتصالات',
      image: STORE_ASSETS.swrSubElbow || STORE_ASSETS.products.ceramicParts,
      link: '/category/production-fittings',
    },
    {
      id: 'pipes',
      title: 'لوله‌ها',
      image: STORE_ASSETS.swrSubPipes || STORE_ASSETS.products.pipes,
      link: '/category/pipes-flanges',
    },
    {
      id: 'flanges',
      title: 'فلنج‌ها',
      image: STORE_ASSETS.swrSubFlanges || STORE_ASSETS.products.flange,
      link: '/category/pipes-flanges',
    },
  ];

  return (
    <section id="main-brands-section" className="relative w-full overflow-hidden bg-[#414146] text-white border-y border-[#55565A]/80 shadow-2xl py-10 sm:py-14 lg:py-16 select-none">
      {/* Full-Bleed Machinery Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Desktop: Unified Wide Dual Banner */}
        <img
          src={STORE_ASSETS.brandsFullbleedBg || STORE_ASSETS.forzaSwrDualBanner}
          alt="برندهای معتبر جهانی FORZA، ATLAS و SWR"
          className="hidden lg:block w-full h-full object-cover object-center opacity-85"
        />

        {/* Mobile: Dedicated Stacked Machinery Background */}
        <div className="lg:hidden absolute inset-0 flex flex-col">
          <div className="relative w-full h-1/3 overflow-hidden">
            <img
              src={STORE_ASSETS.banners?.forza || STORE_ASSETS.brandsFullbleedBg}
              alt="FORZA Industrial Belts"
              className="w-full h-full object-cover object-left opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#414146]/50 via-[#414146]/70 to-[#414146]" />
            <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[#E06518]/30 rounded-full blur-[80px]" />
          </div>
          <div className="relative w-full h-1/3 overflow-hidden">
            <img
              src={STORE_ASSETS.heroPulley || STORE_ASSETS.brandsFullbleedBg}
              alt="ATLAS Power Transmission"
              className="w-full h-full object-cover object-center opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#414146] via-[#414146]/70 to-[#414146]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-[#EA580C]/35 rounded-full blur-[80px]" />
          </div>
          <div className="relative w-full h-1/3 overflow-hidden">
            <img
              src={STORE_ASSETS.banners?.swr || STORE_ASSETS.brandsFullbleedBg}
              alt="SWR Industrial Valves"
              className="w-full h-full object-cover object-right opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#414146] via-[#414146]/70 to-[#414146]/90" />
            <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#0077FF]/30 rounded-full blur-[80px]" />
          </div>
        </div>

        {/* Smooth Center Vignette */}
        <div
          className="hidden lg:block absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(65,65,70,0.25) 0%, rgba(65,65,70,0.85) 18%, rgba(65,65,70,0.95) 50%, rgba(65,65,70,0.85) 82%, rgba(65,65,70,0.25) 100%)',
          }}
        />
        <div className="hidden lg:block absolute inset-0 bg-gradient-to-t from-[#414146] via-transparent to-[#414146]/90" />

        {/* Coordinated Industrial Dot Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff18_1.2px,transparent_1.2px)] [background-size:24px_24px] pointer-events-none" />

        {/* Ambient Glows */}
        <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 left-[8%] w-72 h-72 bg-[#E06518]/20 rounded-full blur-[100px]" />
        <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#EA580C]/22 rounded-full blur-[110px]" />
        <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-[8%] w-72 h-72 bg-[#0077FF]/20 rounded-full blur-[100px]" />
      </div>

      {/* Bottom Glowing Orange Laser Horizon Line */}
      <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#E06518] to-transparent shadow-[0_0_20px_#E06518] pointer-events-none z-20" />
      <div className="absolute bottom-0 left-1/4 right-1/4 h-6 bg-gradient-to-t from-[#E06518]/25 to-transparent blur-md pointer-events-none z-10" />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Top Centered Header Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto" dir="rtl">
          <h2 className="text-2xl sm:text-3xl lg:text-[38px] font-black text-white tracking-tight leading-tight drop-shadow-md">
            برندهای معتبر جهانی،{' '}
            <span className="text-[#F97316] bg-gradient-to-l from-[#FF8C00] to-[#E06518] bg-clip-text text-transparent">
              در کنار شما
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300/95 leading-relaxed font-normal max-w-xl mx-auto">
            پیش به صنعت با همکاری برندهای مطرح جهانی، تأمین‌کننده قطعات و تجهیزات صنعتی با کیفیت،
            <br className="hidden sm:inline" /> معتبر و با اصالت برای صنایع مختلف کشور است.
          </p>
        </div>

        {/* 3 Brand Columns Grid: FORZA, ATLAS, SWR */}
        <div
          className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6 items-stretch pt-2"
          dir="ltr"
        >
          {/* Vertical Divider Lines for Desktop */}
          <div className="hidden lg:block absolute top-2 bottom-2 left-[33.3%] w-px bg-gradient-to-b from-transparent via-slate-600/40 to-transparent pointer-events-none" />
          <div className="hidden lg:block absolute top-2 bottom-2 right-[33.3%] w-px bg-gradient-to-b from-transparent via-slate-600/40 to-transparent pointer-events-none" />

          {/* ================================================================= */}
          {/* COLUMN 1: FORZA (Orange Industrial Accent)                        */}
          {/* ================================================================= */}
          <div className="relative flex flex-col items-center justify-between space-y-6 rounded-2xl p-5 sm:p-6 lg:p-4 bg-black/30 lg:bg-transparent border border-[#E06518]/25 lg:border-transparent backdrop-blur-[2px] lg:backdrop-blur-none overflow-hidden">
            {/* Mobile Background Atmosphere */}
            <div className="absolute inset-0 pointer-events-none lg:hidden -z-10">
              <img
                src={STORE_ASSETS.banners?.forza || STORE_ASSETS.brandsFullbleedBg}
                alt="FORZA"
                className="w-full h-full object-cover object-left opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#414146] via-[#414146]/70 to-[#414146]/90" />
            </div>

            <div className="flex flex-col items-center space-y-4 w-full">
              {/* FORZA Logo */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="h-24 sm:h-28 flex items-center justify-center p-1">
                  <img src={STORE_ASSETS.logoForza} alt="FORZA" className="h-full w-auto max-w-[190px] sm:max-w-[220px] object-contain filter drop-shadow-md" />
                </div>
                <div className="text-[10px] tracking-[0.24em] text-[#F97316] font-bold uppercase">
                  POWER YOUR INDUSTRY
                </div>
              </div>

              {/* FORZA Description */}
              <p
                dir="rtl"
                className="text-xs text-slate-200/95 leading-6 text-center sm:text-right w-full font-normal min-h-[54px]"
              >
                <strong className="font-bold text-white">فورزا (FORZA)</strong> یکی از برندهای نام‌آشنای جهانی در تولید و تأمین قطعات صنعتی، اتصالات و تجهیزات با کیفیت بالا برای صنایع مختلف است.
              </p>

              {/* FORZA Pill Button */}
              <div className="pt-1 w-full flex justify-center sm:justify-end">
                <Link
                  to="/category/swr-forza-exclusive"
                  className="inline-flex items-center justify-between gap-4 px-5 py-2.5 rounded-full bg-[#0B101B]/80 hover:bg-[#E06518] border border-[#E06518]/80 hover:border-[#E06518] text-[#F97316] hover:text-white text-xs font-bold transition-all duration-300 shadow-[0_0_16px_rgba(224,101,24,0.18)] hover:shadow-[0_0_22px_rgba(224,101,24,0.5)] cursor-pointer group/btn"
                >
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  <span dir="rtl">مشاهده محصولات فورزا</span>
                </Link>
              </div>
            </div>

            {/* FORZA 4 Subcategory Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5 w-full pt-2">
              {forzaCategories.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  className="bg-[#0D1524]/90 hover:bg-[#131F33] border border-slate-700/60 hover:border-[#E06518] rounded-xl p-2 flex flex-col items-center justify-between text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_6px_18px_rgba(224,101,24,0.28)] cursor-pointer group/card aspect-[1/1.18]"
                >
                  <div className="w-full flex-1 flex items-center justify-center overflow-hidden rounded-lg p-0.5">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover/card:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <span
                    dir="rtl"
                    className="text-[10px] font-bold text-slate-200 group-hover/card:text-[#F97316] transition-colors pt-1 truncate w-full"
                  >
                    {item.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* COLUMN 2: ATLAS (Orange / Amber Metallic Accent)                   */}
          {/* ================================================================= */}
          <div className="relative flex flex-col items-center justify-between space-y-6 rounded-2xl p-5 sm:p-6 lg:p-4 bg-gradient-to-b from-[#EA580C]/10 via-black/35 to-black/30 lg:bg-gradient-to-b lg:from-[#EA580C]/15 lg:to-transparent border border-[#F97316]/35 lg:border-[#F97316]/20 backdrop-blur-[2px] lg:backdrop-blur-none overflow-hidden shadow-xl lg:shadow-none">
            {/* Mobile Background Atmosphere */}
            <div className="absolute inset-0 pointer-events-none lg:hidden -z-10">
              <img
                src={STORE_ASSETS.heroPulley || STORE_ASSETS.brandsFullbleedBg}
                alt="ATLAS"
                className="w-full h-full object-cover object-center opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#414146] via-[#414146]/70 to-[#414146]/90" />
            </div>

            <div className="flex flex-col items-center space-y-4 w-full">
              {/* ATLAS Logo */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="h-24 sm:h-28 flex items-center justify-center p-1">
                  <img
                    src={STORE_ASSETS.atlasLogo}
                    alt="اطلس (ATLAS)"
                    className="h-full w-auto max-w-[190px] sm:max-w-[220px] object-contain filter drop-shadow-[0_4px_12px_rgba(249,115,22,0.4)]"
                  />
                </div>
                <div className="text-[10px] tracking-[0.24em] text-[#FF7700] font-bold uppercase">
                  ATLAS POWER TRANSMISSION
                </div>
              </div>

              {/* ATLAS Description */}
              <p
                dir="rtl"
                className="text-xs text-slate-200/95 leading-6 text-center sm:text-right w-full font-normal min-h-[54px]"
              >
                <strong className="font-bold text-white">اطلس (ATLAS)</strong> نامی پیشتاز و تخصصی در حوزه ساخت و تأمین انواع پولی‌های صنعتی، فلکه‌های انتقال قدرت و تسمه‌های سنگین با استاندارد بین‌المللی است.
              </p>

              {/* ATLAS Pill Button */}
              <div className="pt-1 w-full flex justify-center sm:justify-end">
                <Link
                  to="/category/power-transmission"
                  className="inline-flex items-center justify-between gap-4 px-5 py-2.5 rounded-full bg-[#0B101B]/80 hover:bg-[#EA580C] border border-[#F97316] hover:border-[#EA580C] text-[#FF7700] hover:text-white text-xs font-bold transition-all duration-300 shadow-[0_0_18px_rgba(249,115,22,0.25)] hover:shadow-[0_0_24px_rgba(249,115,22,0.6)] cursor-pointer group/btn"
                >
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  <span dir="rtl">مشاهده محصولات اطلس</span>
                </Link>
              </div>
            </div>

            {/* ATLAS 4 Subcategory Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5 w-full pt-2">
              {atlasCategories.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  className="bg-[#0D1524]/90 hover:bg-[#131F33] border border-slate-700/60 hover:border-[#F97316] rounded-xl p-2 flex flex-col items-center justify-between text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_6px_18px_rgba(249,115,22,0.35)] cursor-pointer group/card aspect-[1/1.18]"
                >
                  <div className="w-full flex-1 flex items-center justify-center overflow-hidden rounded-lg p-0.5">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover/card:scale-110 transition-transform duration-300 filter drop-shadow-sm"
                    />
                  </div>
                  <span
                    dir="rtl"
                    className="text-[10px] font-bold text-slate-200 group-hover/card:text-[#FF7700] transition-colors pt-1 truncate w-full"
                  >
                    {item.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* COLUMN 3: SWR (Blue Industrial Accent)                            */}
          {/* ================================================================= */}
          <div className="relative flex flex-col items-center justify-between space-y-6 rounded-2xl p-5 sm:p-6 lg:p-4 bg-black/30 lg:bg-transparent border border-[#0077FF]/25 lg:border-transparent backdrop-blur-[2px] lg:backdrop-blur-none overflow-hidden">
            {/* Mobile Background Atmosphere */}
            <div className="absolute inset-0 pointer-events-none lg:hidden -z-10">
              <img
                src={STORE_ASSETS.banners?.swr || STORE_ASSETS.brandsFullbleedBg}
                alt="SWR"
                className="w-full h-full object-cover object-right opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#414146] via-[#414146]/70 to-[#414146]/90" />
            </div>

            <div className="flex flex-col items-center space-y-4 w-full">
              {/* SWR Logo */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="h-24 sm:h-28 flex items-center justify-center p-1">
                  <img src={STORE_ASSETS.swrLogo} alt="SWR" className="h-full w-auto max-w-[190px] sm:max-w-[220px] object-contain filter drop-shadow-md" />
                </div>
                <div className="text-[10px] tracking-[0.24em] text-[#0088FF] font-bold uppercase">
                  INDUSTRIAL SOLUTIONS
                </div>
              </div>

              {/* SWR Description */}
              <p
                dir="rtl"
                className="text-xs text-slate-200/95 leading-6 text-center sm:text-right w-full font-normal min-h-[54px]"
              >
                <strong className="font-bold text-white">SWR</strong> با ارائه محصولات با کیفیت و فناوری روز دنیا، در زمینه اتصالات، شیرآلات و تجهیزات صنعتی، انتخابی مطمئن برای صنایع مختلف است.
              </p>

              {/* SWR Pill Button */}
              <div className="pt-1 w-full flex justify-center sm:justify-end">
                <Link
                  to="/category/swr-forza-exclusive"
                  className="inline-flex items-center justify-between gap-4 px-5 py-2.5 rounded-full bg-[#0B101B]/80 hover:bg-[#0077FF] border border-[#0077FF]/80 hover:border-[#0077FF] text-[#38BDF8] hover:text-white text-xs font-bold transition-all duration-300 shadow-[0_0_16px_rgba(0,136,255,0.18)] hover:shadow-[0_0_22px_rgba(0,136,255,0.5)] cursor-pointer group/btn"
                >
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  <span dir="rtl">مشاهده محصولات SWR</span>
                </Link>
              </div>
            </div>

            {/* SWR 4 Subcategory Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5 w-full pt-2">
              {swrCategories.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  className="bg-[#0D1524]/90 hover:bg-[#131F33] border border-slate-700/60 hover:border-[#0088FF] rounded-xl p-2 flex flex-col items-center justify-between text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_6px_18px_rgba(0,136,255,0.28)] cursor-pointer group/card aspect-[1/1.18]"
                >
                  <div className="w-full flex-1 flex items-center justify-center overflow-hidden rounded-lg p-0.5">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover/card:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <span
                    dir="rtl"
                    className="text-[10px] font-bold text-slate-200 group-hover/card:text-[#38BDF8] transition-colors pt-1 truncate w-full"
                  >
                    {item.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
