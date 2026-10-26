import React from "react";
import { PartIdentificationLink as Link } from "../search/PartIdentificationProvider";
import {
  ArrowLeft,
  ArrowUpLeft,
  Layers,
  ShieldCheck,
  Factory,
  ClipboardList,
  MessageSquare,
  Upload,
  Headphones,
  ChevronLeft,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { CATEGORIES } from "../../data/categories";
import { ProductImage } from "../product/ProductImage";
import { STORE_ASSETS as A } from "../../assets/images";
import { getProductImageUrl } from "../../assets/imagesproducts";

const categoryArtwork: Record<string, string> = {
  "تسمه و انتقال نیرو": A.categories.belts,
  "پولی و انتقال نیرو": A.categories.pulleys,
  "بلبرینگ و یاتاقان": A.categories.bearings,
};

const groups = [
  "تسمه و انتقال نیرو",
  "پولی و انتقال نیرو",
  "چرخ و رولر",
  "ریل و تجهیزات هدایت",
  "آب‌بندی و قطعات لاستیکی",
  "بلبرینگ و یاتاقان",
];

export function HomeCategoryStrip() {
  // Preserve the original six-card horizontal homepage strip; other groups stay on /categories.
  const categories = groups
    .map(name => CATEGORIES.find(category => category.name === name && category.active !== false))
    .filter((category): category is NonNullable<typeof category> => Boolean(category));
  return (
    <section id="home-categories" className="home-category-strip" aria-label="دسته‌بندی محصولات">
      <div className="home-category-track">
        <Link className="home-category-all" to="/categories">
          <Layers size={24} />
          <strong>
            دسته‌بندی
            <br />
            محصولات
          </strong>
          <span>
            مشاهده همه گروه‌ها <ArrowLeft size={15} />
          </span>
        </Link>
        {categories.map((c) => (
          <Link
            className="home-category-item"
            key={c.slug}
            to={`/category/${c.slug}`}
          >
            <ProductImage
              src={c.image || categoryArtwork[c.name]}
              alt={c.name}
              loading="lazy"
            />
            <strong>{c.name}</strong>
            <small>
              مشاهده قطعات <ArrowUpLeft size={12} />
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function HomeTrustStrip() {
  return (
    <section
      className="home-trust-strip"
      aria-label="پیش از خرید با ما آشنا شوید"
    >
      {[
        {
          Icon: Factory,
          title: "تجربه در کنار تولید",
          text: "آشنایی با مجموعه و توانمندی‌ها",
          to: "/about",
        },
        {
          Icon: ShieldCheck,
          title: "مشخصات، پیش از انتخاب",
          text: "کد، تصویر و اطلاعات فنی کالا",
          to: "/products",
        },
        {
          Icon: ClipboardList,
          title: "درخواست قابل پیگیری",
          text: "ثبت استعلام و پیگیری در پنل",
          to: "/login",
        },
        {
          Icon: MessageSquare,
          title: "راه ارتباطی روشن",
          text: "مشاوره و تماس مستقیم با مجموعه",
          to: "/contact",
        },
      ].map(({ Icon, title, text, to }) => (
        <Link key={title} to={to}>
          <Icon size={25} />
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
          <ArrowUpLeft size={15} />
        </Link>
      ))}
    </section>
  );
}

/**
 * Dual AI Banner Section on Homepage (Image 1 Reference):
 * - Right Card (in RTL): شناسایی قطعه از روی تصویر (Light card with 3D parts in orange scanner frame + آپلود تصویر CTA)
 * - Left Card (in RTL): مشاوره تخصصی FORZA (Rich orange card with 3D FORZA AI robot + soundwave + شروع مشاوره CTA)
 */
export function HomeForzaBanner() {
  const pulleySampleImg = getProductImageUrl("e(38).png");

  return (
    <section
      id="home-forza-ai"
      aria-label="ابزارهای هوش مصنوعی و شناسایی قطعه صنعت پیش"
      className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 my-8 sm:my-12"
      dir="rtl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        {/* =================================================================== */}
        {/* CARD 1 (Right in RTL): شناسایی قطعه از روی تصویر (Light Card)       */}
        {/* =================================================================== */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-l from-[#F7F8FA] via-[#F2F4F7] to-[#EAECEF] border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5">
          {/* Subtle background geometric capsule */}
          <div className="absolute -left-10 -bottom-10 w-64 h-64 rounded-full bg-white/60 blur-2xl pointer-events-none" />

          {/* Text & CTA Column (Right side in RTL) */}
          <div className="relative z-10 w-full sm:w-[54%] text-right space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-1 h-6 sm:h-7 rounded-full bg-[#E06518] shrink-0" />
              <h2 className="text-lg sm:text-xl xl:text-2xl font-black text-[#23262B] tracking-tight">
                شناسایی قطعه از روی تصویر
              </h2>
            </div>

            <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-medium">
              تصویر قطعه را ارسال کنید، در چند
              <br className="hidden sm:inline" /> ثانیه مشابه دقیق آن را پیدا
              می‌کنیم.
            </p>

            <div className="pt-1">
              <Link
                to="/identify-part"
                className="w-full sm:w-auto min-w-[165px] h-11 px-6 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2.5 shadow-md shadow-orange-500/20 hover:shadow-orange-500/35 transition-all active:scale-95"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>آپلود تصویر</span>
              </Link>
            </div>
          </div>

          {/* Scanner Visual Column (Left side in RTL) */}
          <div className="relative z-10 w-full sm:w-[46%] flex items-center justify-center py-2">
            {/* Tilted 3D White Capsule Pedestal */}
            <div className="relative w-52 sm:w-56 h-36 sm:h-40 flex items-center justify-center">
              <div className="absolute inset-2 rounded-[32px] bg-white shadow-[0_16px_35px_rgba(15,23,42,0.08)] border border-white -rotate-6" />

              {/* Orange Viewfinder Corner Brackets */}
              <div className="relative w-44 sm:w-48 h-32 sm:h-36 p-3 flex items-center justify-center">
                {/* Top-Right Bracket */}
                <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#E06518] rounded-tr-lg" />
                {/* Top-Left Bracket */}
                <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#E06518] rounded-tl-lg" />
                {/* Bottom-Right Bracket */}
                <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#E06518] rounded-br-lg" />
                {/* Bottom-Left Bracket */}
                <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#E06518] rounded-bl-lg" />

                {/* Corner Micro Tech Icons */}
                <Sparkles className="absolute top-1.5 left-1.5 w-3 h-3 text-[#E06518]/70" />
                <Maximize2 className="absolute bottom-1.5 right-1.5 w-3 h-3 text-[#E06518]/70" />

                {/* Industrial Parts Image Inside Scanner */}
                <img
                  src={A.categories.pulleys}
                  alt="شناسایی هوشمند قطعات صنعتی از روی تصویر"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = pulleySampleImg;
                  }}
                  className="w-36 sm:w-40 h-28 sm:h-32 object-contain drop-shadow-md relative z-10"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />

                {/* Diagonal Glowing Laser Scan Line */}
                <div className="absolute inset-x-3 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-[#E06518] to-transparent shadow-[0_0_10px_#E06518] -rotate-12 z-20 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* CARD 2 (Left in RTL): مشاوره تخصصی FORZA (Rich Orange Card)         */}
        {/* =================================================================== */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#B83E06] via-[#D9540F] to-[#EC691B] border border-[#C94A0A] shadow-lg shadow-orange-950/15 p-5 sm:p-7 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 text-white">
          {/* Subtle Industrial Grid & Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_50%,rgba(255,180,100,0.28),transparent_60%)] pointer-events-none" />

          {/* Audio Frequency Waveform SVG Behind Robot */}
          <svg
            viewBox="0 0 360 120"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-60 sm:w-72 h-28 opacity-55 pointer-events-none"
            fill="none"
          >
            <path
              d="M0 60 H40 L48 35 L56 85 L64 20 L72 100 L80 42 L88 78 L96 52 L105 60 H230 L238 30 L246 90 L254 15 L262 105 L270 38 L278 82 L286 50 L294 60 H360"
              stroke="#FFB366"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* 3D FORZA Robot Visual (Right side inside the orange card) */}
          <div className="relative z-10 w-full sm:w-[44%] flex items-center justify-center">
            <div className="relative w-40 h-40 sm:w-52 sm:h-52 flex items-center justify-center">
              {/* Glowing Halo Behind Robot */}
              <div className="absolute inset-2 rounded-full bg-orange-300/35 blur-xl pointer-events-none animate-pulse" />

              {/* Futuristic FORZA AI Robot Halo PNG Image */}
              <img
                src={A.forzaAiRobotHalo}
                alt="هوش مصنوعی FORZA"
                className="w-full h-full object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)] relative z-10 transition-transform hover:scale-105 duration-300"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Text & White CTA Column (Left side inside the orange card, right-aligned) */}
          <div className="relative z-10 w-full sm:w-[56%] text-right space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl xl:text-2xl font-black text-white tracking-tight drop-shadow-xs">
              مشاوره تخصصی FORZA
            </h2>

            <p className="text-xs sm:text-[13px] text-orange-50/95 leading-relaxed font-medium">
              سوال فنی دارید؟ با هوش مصنوعی صنعت
              <br className="hidden sm:inline" /> پیش صحبت کنید.
            </p>

            <div className="pt-1">
              <Link
                to="/ai-consult"
                className="w-full sm:w-auto min-w-[175px] h-11 px-5 rounded-xl bg-white hover:bg-orange-50 text-[#E06518] font-black text-xs sm:text-sm inline-flex items-center justify-between gap-3 shadow-md transition-all active:scale-95"
              >
                <Headphones className="w-4 h-4 text-[#E06518] shrink-0" />
                <span>شروع مشاوره</span>
                <ChevronLeft className="w-4 h-4 text-[#E06518] shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
