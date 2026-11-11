import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpLeft, BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ARTICLES } from "../../data/siteContent";

export function HomeKnowledge() {
  const articlesScrollRef = useRef<HTMLDivElement>(null);
  const featuredArticles = ARTICLES.slice(0, 4);

  const scrollArticles = (direction: "prev" | "next") => {
    articlesScrollRef.current?.scrollBy({
      left: direction === "next" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <section
      aria-labelledby="home-knowledge-heading"
      className="mx-auto my-10 max-w-[1320px] px-4 sm:my-14 sm:px-6 lg:px-8"
      dir="rtl"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 shrink-0 rounded-full bg-[#E56B1E] sm:h-7" />
          <div>
            <h2 id="home-knowledge-heading" className="text-lg font-black tracking-tight text-[#23262B] sm:text-xl lg:text-2xl">
              دانشنامه فنی صنعت پیش
            </h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">
              راهنماهای کاربردی برای انتخاب و نگهداری قطعات
            </p>
          </div>
        </div>
        <Link to="/knowledge" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#E56B1E] transition-colors hover:text-[#C95210] sm:text-sm">
          <span>مشاهده همه راهنماها</span><ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative">
        <button type="button" onClick={() => scrollArticles("prev")} aria-label="راهنمای قبلی" className="absolute -right-4 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:border-[#E56B1E] hover:bg-orange-50 hover:text-[#E56B1E] sm:flex">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => scrollArticles("next")} aria-label="راهنمای بعدی" className="absolute -left-4 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:border-[#E56B1E] hover:bg-orange-50 hover:text-[#E56B1E] sm:flex">
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
          <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-[#172936] p-5 text-white shadow-sm lg:col-span-4">
            <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#E56B1E]/20 blur-3xl" />
            <div className="relative flex h-36 w-28 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-inner sm:h-40 sm:w-32">
              <div className="absolute inset-2 rounded-lg border border-white/10" />
              <div className="relative flex flex-col items-center gap-3 text-center">
                <BookOpen className="h-10 w-10 text-[#ff9b59]" strokeWidth={1.4} />
                <span className="text-[9px] font-black tracking-[.22em] text-white/80">SANAT PISH</span>
                <span className="h-1 w-12 rounded-full bg-[#E56B1E]" />
                <span className="text-[10px] font-bold text-white/90">ONLINE CATALOG</span>
              </div>
            </div>
            <div className="relative z-10 flex-1 space-y-2 text-right">
              <span className="text-[10px] font-bold text-[#ffad76]">کاتالوگ آنلاین</span>
              <h3 className="text-base font-black leading-snug sm:text-lg">قطعه را در کاتالوگ پیدا کنید</h3>
              <p className="text-xs leading-6 text-slate-300">خانواده‌ها، برندها و کدهای فنی را جستجو و مشخصات محصولات را بررسی کنید.</p>
              <Link to="/products" className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#C95210]">
                <Search className="h-4 w-4" /> مشاهده کاتالوگ
              </Link>
            </div>
          </div>

          <div ref={articlesScrollRef} className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:col-span-8 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
            {featuredArticles.map((article) => (
              <Link key={article.slug} to={`/knowledge/${article.slug}`} className="group flex min-w-[230px] snap-start flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition hover:border-[#E56B1E]/60 hover:shadow-md sm:min-w-[240px] lg:min-w-0">
                <div>
                  <div className="h-32 w-full overflow-hidden bg-slate-100 sm:h-36">
                    <img src={article.image} alt={article.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-3.5 text-right">
                    <span className="text-[10px] font-bold text-[#E56B1E]">{article.category}</span>
                    <h3 className="mt-1 line-clamp-2 text-xs font-extrabold leading-relaxed text-[#23262B] transition-colors group-hover:text-[#E56B1E] sm:text-[13px]">{article.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-slate-500">{article.summary}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3.5 pb-3 pt-1">
                  <span className="text-[10px] font-medium text-slate-400">{article.minutes} دقیقه مطالعه</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#E56B1E]">مطالعه <ArrowUpLeft className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-1 pt-3 sm:hidden">
          <span className="text-[11px] font-medium text-slate-400">برای دیدن راهنماهای بیشتر به چپ بکشید</span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => scrollArticles("prev")} aria-label="راهنمای قبلی" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs active:scale-95"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => scrollArticles("next")} aria-label="راهنمای بعدی" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-2xs active:scale-95"><ChevronLeft className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeKnowledge;
