import React from 'react';
import { STORE_ASSETS } from '../../assets/images';
import { Headphones, Zap, ShieldCheck, Sparkles, Building2, Award, Truck, Gift } from 'lucide-react';

interface AuthVisualSidePanelProps {
  customTitle?: string;
  customDescription?: string;
  badgeText?: string;
  bgImage?: string;
  highlights?: string[];
}

export const AuthVisualSidePanel: React.FC<AuthVisualSidePanelProps> = ({
  customTitle = 'خوش آمدید، به صنعت‌پیش',
  customDescription = 'وارد حساب کاربری خود شوید و به سفارش‌ها، استعلام‌ها، پیشنهادهای اختصاصی و خدمات هوشمند صنعتی خود دسترسی پیدا کنید.',
  badgeText = 'سامانه تخصصی تأمین قطعات صنعت‌پیش',
  bgImage,
  highlights,
}) => {
  const activeBg = bgImage || STORE_ASSETS.bannerAuthLogin || STORE_ASSETS.authIndustrialHero;

  return (
    <div className="relative w-full h-full min-h-[460px] md:min-h-full rounded-2xl md:rounded-l-3xl md:rounded-r-none overflow-hidden flex flex-col justify-between p-6 sm:p-8 text-white select-none shadow-2xl bg-[#14181f]">
      {/* Background Image with Dark Industrial Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={activeBg}
          alt="صنعت‌پیش"
          className="w-full h-full object-cover object-center transform scale-105 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#12161f] via-[#1a202c]/85 to-[#12161f]/80 backdrop-blur-[0.5px]" />
        {/* Glowing orange accent aura */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#E06518]/25 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Top Section: Logo & Subtitle */}
      <div className="relative z-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-[11px] text-orange-300 font-bold mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-[#E06518]" />
          <span>{badgeText}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E06518] to-[#C95210] text-white flex items-center justify-center font-black text-xl shadow-lg shadow-[#E06518]/30">
            ص
          </div>
          <div>
            <div className="flex items-center gap-1 font-black text-xl tracking-tight text-white">
              <span className="text-[#E06518]">صنعت‌</span>
              <span className="text-slate-100">پیش</span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              تأمین تخصصی قطعات خطوط تولید و کارخانجات
            </p>
          </div>
        </div>
      </div>

      {/* Center / Main Marketing Copy & Policy Highlights */}
      <div className="relative z-10 my-auto py-6">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight mb-3 text-shadow-sm">
          {customTitle}
        </h2>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-sm mb-4">
          {customDescription}
        </p>

        {/* Custom Bullet Highlights */}
        {highlights && highlights.length > 0 ? (
          <div className="space-y-2 pt-2 border-t border-white/10 text-xs text-slate-200">
            {highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E06518] shrink-0" />
                <span>{h}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-slate-200">
            <Award className="w-4 h-4 text-[#E06518] shrink-0" />
            <span>
              نمایندگی انحصاری تسمه و قطعات برندهای <strong className="text-orange-400 font-bold">FORZA</strong> و <strong className="text-sky-300 font-bold">SWR</strong>
            </span>
          </div>
        )}
      </div>

      {/* Bottom Features Row */}
      <div className="relative z-10 pt-4 border-t border-slate-700/60 grid grid-cols-3 gap-2 text-center text-[10px] sm:text-[11px] text-slate-300">
        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-black/30 backdrop-blur-xs border border-white/10">
          <Truck className="w-4 h-4 text-[#E06518]" />
          <span className="font-bold leading-tight">ارسال سریع سراسری</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-black/30 backdrop-blur-xs border border-white/10">
          <Zap className="w-4 h-4 text-[#E06518]" />
          <span className="font-bold leading-tight">استعلام و قیمت کارخانه</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-black/30 backdrop-blur-xs border border-white/10">
          <ShieldCheck className="w-4 h-4 text-[#E06518]" />
          <span className="font-bold leading-tight">تضمین ۱۰۰٪ اصالت</span>
        </div>
      </div>
    </div>
  );
};
